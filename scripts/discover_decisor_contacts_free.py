#!/usr/bin/env python3
"""Confirma e-mails profissionais por SMTP, rejeitando domínios catch-all."""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import random
import re
import smtplib
import socket
import string
import subprocess
import unicodedata

import psycopg2
from psycopg2.extras import Json, RealDictCursor


PRIORITY_ROLES = (
    "GERENTE_PROJETOS", "GERENTE_SUPRIMENTOS", "GERENTE_COMPRAS",
    "GERENTE_ENGENHARIA", "COORDENADOR_OBRAS", "COORDENADOR_MANUTENCAO",
    "GERENTE_INDUSTRIAL", "SUPPLY_CHAIN", "ENGENHEIRO_MECANICO_CIVIL",
)


def connect(readonly=False):
    options = "-c search_path=engenharia,public"
    if readonly:
        options += " -c default_transaction_read_only=on"
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME") or os.getenv("POSTGRES_DB", "wins_agro"),
        user=os.getenv("DB_USER") or os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("DB_PASSWORD") or os.getenv("POSTGRES_PASSWORD", ""),
        options=options,
        application_name="decisor_contact_discovery_free",
    )


def ascii_words(name):
    value = unicodedata.normalize("NFKD", name or "")
    value = value.encode("ascii", "ignore").decode().lower()
    return re.findall(r"[a-z0-9]+", value)


def patterns(name, domain):
    words = ascii_words(name)
    if len(words) < 2:
        return []
    first, last = words[0], words[-1]
    locals_ = (
        f"{first}.{last}", f"{first}{last}", f"{first[0]}{last}",
        f"{first}{last[0]}", f"{first}_{last}", f"{first}-{last}",
    )
    return list(dict.fromkeys(f"{local}@{domain}" for local in locals_))


def mx_hosts(domain):
    result = subprocess.run(
        ["dig", "+short", "MX", domain],
        capture_output=True, text=True, timeout=8, check=False,
    )
    rows = []
    for line in result.stdout.splitlines():
        parts = line.split()
        if len(parts) >= 2 and parts[0].isdigit():
            rows.append((int(parts[0]), parts[1].rstrip(".")))
    return [host for _, host in sorted(rows)]


def verify(row, timeout):
    candidates = patterns(row["nome"], row["dominio"])
    hosts = mx_hosts(row["dominio"])
    if not candidates or not hosts:
        return row, "SEM_MX_OU_PADRAO", None, candidates, None
    random_local = "winshub-check-" + "".join(
        random.choices(string.ascii_lowercase + string.digits, k=18)
    )
    for host in hosts[:3]:
        try:
            smtp = smtplib.SMTP(host, 25, timeout=timeout)
            smtp.ehlo_or_helo_if_needed()
            smtp.mail("verify@winshub.com.br")
            random_code, _ = smtp.rcpt(f"{random_local}@{row['dominio']}")
            if 200 <= random_code < 300:
                smtp.quit()
                return row, "CATCH_ALL", None, candidates, None
            accepted = []
            tested = []
            for email in candidates:
                smtp.rset()
                smtp.mail("verify@winshub.com.br")
                code, _ = smtp.rcpt(email)
                tested.append({"email": email, "smtp_code": code})
                if 200 <= code < 300:
                    accepted.append(email)
            smtp.quit()
            if len(accepted) == 1:
                return row, "MAILBOX_VERIFIED", accepted[0], tested, None
            if len(accepted) > 1:
                return row, "MULTIPLOS_ACEITOS", None, tested, None
            return row, "NAO_ENCONTRADO", None, tested, None
        except (OSError, socket.timeout, smtplib.SMTPException) as exc:
            error = type(exc).__name__
            continue
    return row, "INCONCLUSIVO", None, candidates, error


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=10000)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--timeout", type=float, default=12)
    ap.add_argument("--all-roles", action="store_true")
    args = ap.parse_args()
    with connect(True) as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            WITH targets AS (
              SELECT DISTINCT ON (d.cnpj,d.nome_key,ed.dominio)
                d.cnpj,d.nome,d.cargo,d.tipo_cargo,ed.dominio,d.nome_key
              FROM (
                SELECT d.*,o.id obra_ref,
                  COALESCE(NULLIF(regexp_replace(o.cnpj_executora,'\\D','','g'),''),
                           NULLIF(regexp_replace(o.cnpj,'\\D','','g'),'')) cnpj,
                  regexp_replace(upper(unaccent(d.nome)),'[^A-Z0-9]','','g') nome_key
                FROM engenharia.decisores_obra d
                JOIN engenharia.obras o ON o.id=d.obra_id
                WHERE d.excluido_em IS NULL
                  AND NULLIF(btrim(coalesce(d.email,'')),'') IS NULL
                  AND COALESCE(d.hipotese_replicacao,'')
                      <> 'REPLICADO_PROVAVEL_FALSO_POSITIVO'
              ) d
              JOIN engenharia.empresa_dominios ed
                ON regexp_replace(ed.cnpj,'\\D','','g')=d.cnpj
              LEFT JOIN engenharia.decisor_contact_discovery a
                ON a.cnpj=d.cnpj AND a.nome=d.nome AND a.dominio=ed.dominio
              WHERE ed.dominio IS NOT NULL AND a.cnpj IS NULL
                AND (%s OR d.tipo_cargo=ANY(%s))
              ORDER BY d.cnpj,d.nome_key,ed.dominio,d.confianca_match DESC NULLS LAST
            )
            SELECT cnpj,nome,cargo,tipo_cargo,dominio
            FROM targets ORDER BY cnpj,nome LIMIT %s
            """,
            (args.all_roles, list(PRIORITY_ROLES), args.limit),
        )
        rows = cur.fetchall()
    totals = {"targets": len(rows)}
    with connect(False) as conn, conn.cursor() as cur:
        with concurrent.futures.ThreadPoolExecutor(args.workers) as pool:
            for index, result in enumerate(
                pool.map(lambda row: verify(row, args.timeout), rows), 1
            ):
                row, status, email, tested, error = result
                cur.execute(
                    """
                    INSERT INTO engenharia.decisor_contact_discovery
                      (cnpj,nome,dominio,cargo,email_confirmado,email_status,
                       candidatos_testados,fonte,erro)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,
                            'SMTP_DIRETO_CATCHALL_CONTROLADO',%s)
                    ON CONFLICT(cnpj,nome,dominio) DO UPDATE SET
                      email_confirmado=EXCLUDED.email_confirmado,
                      email_status=EXCLUDED.email_status,
                      candidatos_testados=EXCLUDED.candidatos_testados,
                      consultado_em=now(),erro=EXCLUDED.erro
                    """,
                    (
                        row["cnpj"], row["nome"], row["dominio"], row["cargo"],
                        email, status, Json(tested), error,
                    ),
                )
                totals[status] = totals.get(status, 0) + 1
                if email:
                    cur.execute(
                        """
                        UPDATE engenharia.decisores_obra d SET
                          email=%s,email_status='MAILBOX_VERIFIED',
                          email_verify_result='SMTP_RCPT_RANDOM_REJECTED',
                          email_verificado_em=now(),
                          observacoes=concat_ws(E'\\n',NULLIF(d.observacoes,''),
                            'E-mail corporativo confirmado via SMTP; endereço aleatório no mesmo domínio foi rejeitado.')
                        FROM engenharia.obras o
                        WHERE o.id=d.obra_id
                          AND COALESCE(
                            NULLIF(regexp_replace(o.cnpj_executora,'\\D','','g'),''),
                            NULLIF(regexp_replace(o.cnpj,'\\D','','g'),'')
                          )=%s
                          AND regexp_replace(upper(unaccent(d.nome)),'[^A-Z0-9]','','g')
                              =regexp_replace(upper(unaccent(%s)),'[^A-Z0-9]','','g')
                          AND NULLIF(btrim(coalesce(d.email,'')),'') IS NULL
                        """,
                        (email, row["cnpj"], row["nome"]),
                    )
                if index % 25 == 0:
                    conn.commit()
                    print(json.dumps({"progress": index, **totals}), flush=True)
        conn.commit()
    print(json.dumps(totals, ensure_ascii=False))


if __name__ == "__main__":
    main()
