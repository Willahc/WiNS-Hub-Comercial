#!/usr/bin/env python3
"""Busca contatos nominais da Fila A em documentos públicos indexados."""

from __future__ import annotations

import argparse
import concurrent.futures
import html
import json
import os
import re
import subprocess
import tempfile
import time
import unicodedata
import urllib.parse
import urllib.request
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse

import psycopg2
from psycopg2.extras import RealDictCursor


EMAIL = re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", re.I)
PHONE = re.compile(
    r"(?<!\d)(?:\+?55\D*)?(?:\(?\d{2}\)?\D*)"
    r"(?:9?\d{4})\D*(?:\d{4})(?!\d)"
)
BLOCKED = re.compile(
    r"(linkedin|facebook|instagram|rocketreach|contactout|signalhire|"
    r"econodata|casadosdados|cnpj\.biz|guiapj|radaris|wikipedia|yahoo)",
    re.I,
)
ROLE_TYPES = (
    "GERENTE_PROJETOS", "GERENTE_SUPRIMENTOS", "GERENTE_COMPRAS",
    "GERENTE_ENGENHARIA", "COORDENADOR_OBRAS", "COORDENADOR_MANUTENCAO",
    "GERENTE_INDUSTRIAL", "SUPPLY_CHAIN", "ENGENHEIRO_MECANICO_CIVIL",
    "PROJETISTA",
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
        application_name="fila_a_document_search_free",
    )


def norm(value):
    value = unicodedata.normalize("NFKD", value or "")
    value = value.encode("ascii", "ignore").decode().upper()
    return re.sub(r"[^A-Z0-9]", "", value)


def fetch(url, timeout, limit=4_000_000):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 WiNSHub/1.5"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return (
                response.geturl(), response.headers.get("Content-Type", ""),
                response.read(limit),
            )
    except (HTTPError, URLError, TimeoutError, OSError):
        return None, None, None


def yahoo_urls(query, timeout):
    url = "https://search.yahoo.com/search?p=" + urllib.parse.quote(query)
    _, _, body = fetch(url, timeout)
    if not body:
        return []
    page = body.decode("utf-8", "ignore")
    urls = []
    for encoded in re.findall(r"/RU=([^/]+)/RK=", page):
        candidate = urllib.parse.unquote(encoded)
        host = (urlparse(candidate).hostname or "").lower()
        if candidate.startswith("http") and not BLOCKED.search(host):
            if candidate not in urls:
                urls.append(candidate)
    return urls[:8]


def document_text(url, timeout):
    final, ctype, body = fetch(url, timeout)
    if not body:
        return final, None
    if "pdf" in (ctype or "").lower() or urlparse(final or url).path.lower().endswith(".pdf"):
        with tempfile.NamedTemporaryFile(suffix=".pdf") as source:
            source.write(body)
            source.flush()
            result = subprocess.run(
                ["pdftotext", "-layout", source.name, "-"],
                capture_output=True, text=True, timeout=timeout, check=False,
            )
        return final, result.stdout[:2_000_000]
    decoded = body.decode("utf-8", "ignore")
    decoded = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", decoded)
    return final, html.unescape(re.sub(r"(?s)<[^>]+>", " ", decoded))


def nearby_contact(text, name):
    compact_name = norm(name)
    if not compact_name or compact_name not in norm(text):
        return None, None, None
    # Localiza pelo primeiro e último nome no texto original para preservar contatos.
    words = re.findall(r"[A-Za-zÀ-ÿ]+", name)
    pattern = re.compile(
        re.escape(words[0]) + r".{0,180}?" + re.escape(words[-1]), re.I | re.S
    )
    matches = list(pattern.finditer(text))
    emails, phones, evidence = [], [], None
    for match in matches[:10]:
        window = text[max(0, match.start() - 700):match.end() + 700]
        evidence = re.sub(r"\s+", " ", window).strip()[:700]
        emails.extend(e.lower().rstrip(".,;") for e in EMAIL.findall(window))
        for phone_match in PHONE.finditer(window):
            prefix = window[max(0, phone_match.start() - 80):phone_match.start()]
            if re.search(r"\b(tel(?:efone)?|fone|celular|whats(?:app)?|ramal)\b", prefix, re.I):
                phones.append(re.sub(r"\D", "", phone_match.group(0)))
    emails = list(dict.fromkeys(e for e in emails if len(e) <= 254))
    phones = list(dict.fromkeys(p for p in phones if 10 <= len(p) <= 13))
    return (
        emails[0] if len(emails) == 1 else None,
        phones[0] if len(phones) == 1 else None,
        evidence,
    )


def search(row, timeout):
    company = row["empresa"] or ""
    query = f'"{row["nome"]}" "{company}" email telefone'
    urls = yahoo_urls(query, timeout)
    analyzed = 0
    for url in urls:
        final, text = document_text(url, timeout)
        if not text:
            continue
        analyzed += 1
        if norm(row["nome"]) not in norm(text):
            continue
        email, phone, evidence = nearby_contact(text, row["nome"])
        if email or phone:
            return row, "MATCH_REVIEW", email, phone, final, evidence, analyzed, query
    return row, "NAO_LOCALIZADO", None, None, None, None, analyzed, query


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=10000)
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--timeout", type=float, default=12)
    ap.add_argument("--all-roles", action="store_true")
    args = ap.parse_args()
    with connect(True) as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            WITH ranked AS (
              SELECT d.nome,d.cargo,d.tipo_cargo,o.empresa,o.valor_estimado,
                COALESCE(NULLIF(regexp_replace(o.cnpj_executora,'\\D','','g'),''),
                         NULLIF(regexp_replace(o.cnpj,'\\D','','g'),'')) cnpj,
                COALESCE(ed.dominio,'') dominio,
                row_number() OVER (
                  PARTITION BY COALESCE(
                    NULLIF(regexp_replace(o.cnpj_executora,'\\D','','g'),''),
                    NULLIF(regexp_replace(o.cnpj,'\\D','','g'),'')
                  ),regexp_replace(upper(unaccent(d.nome)),'[^A-Z0-9]','','g')
                  ORDER BY o.valor_estimado DESC NULLS LAST,
                           d.confianca_match DESC NULLS LAST
                ) rn
              FROM engenharia.decisores_obra d
              JOIN engenharia.obras o ON o.id=d.obra_id
              LEFT JOIN engenharia.empresa_dominios ed
                ON regexp_replace(ed.cnpj,'\\D','','g')=COALESCE(
                  NULLIF(regexp_replace(o.cnpj_executora,'\\D','','g'),''),
                  NULLIF(regexp_replace(o.cnpj,'\\D','','g'),''))
              WHERE d.excluido_em IS NULL
                AND COALESCE(d.hipotese_replicacao,'')
                    <> 'REPLICADO_PROVAVEL_FALSO_POSITIVO'
                AND o.classificacao_computed IN ('OURO','PRATA')
                AND o.valor_estimado>=10000000
                AND (%s OR d.tipo_cargo=ANY(%s))
                AND COALESCE(
                  NULLIF(regexp_replace(o.cnpj_executora,'\\D','','g'),''),
                  NULLIF(regexp_replace(o.cnpj,'\\D','','g'),'')
                ) IS NOT NULL
                AND (NULLIF(d.email,'') IS NULL OR NULLIF(d.telefone,'') IS NULL)
            )
            SELECT r.* FROM ranked r
            LEFT JOIN engenharia.decisor_document_searches s
              ON s.cnpj=r.cnpj AND s.nome=r.nome AND s.dominio=r.dominio
            WHERE r.rn=1 AND s.cnpj IS NULL
            ORDER BY r.valor_estimado DESC NULLS LAST,r.nome
            LIMIT %s
            """,
            (args.all_roles, list(ROLE_TYPES), args.limit),
        )
        rows = cur.fetchall()
    totals = {"targets": len(rows)}
    with connect(False) as conn, conn.cursor() as cur:
        with concurrent.futures.ThreadPoolExecutor(args.workers) as pool:
            futures = [pool.submit(search, row, args.timeout) for row in rows]
            for index, future in enumerate(concurrent.futures.as_completed(futures), 1):
                row, status, email, phone, url, evidence, analyzed, query = future.result()
                cur.execute(
                    """
                    INSERT INTO engenharia.decisor_document_searches
                      (cnpj,nome,dominio,cargo,consulta,status,email_encontrado,
                       telefone_encontrado,fonte_url,evidencia,resultados_analisados)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT(cnpj,nome,dominio) DO NOTHING
                    """,
                    (
                        row["cnpj"], row["nome"], row["dominio"], row["cargo"],
                        query, status, email, phone, url, evidence, analyzed,
                    ),
                )
                totals[status] = totals.get(status, 0) + 1
                if index % 20 == 0:
                    conn.commit()
                    print(json.dumps({"progress": index, **totals}), flush=True)
                time.sleep(0.15)
        conn.commit()
    print(json.dumps(totals, ensure_ascii=False))


if __name__ == "__main__":
    main()
