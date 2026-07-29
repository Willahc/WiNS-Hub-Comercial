#!/usr/bin/env python3
"""Enriquece entidades ObrasGov com busca pública e confirmação na BrasilAPI."""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import re
import subprocess
import time
import unicodedata
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import psycopg2


CNPJ_RE = re.compile(r"\b\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}\b")


def norm(value):
    text = unicodedata.normalize("NFKD", value or "")
    return re.sub(r"[^A-Z0-9]", "", text.encode("ascii", "ignore").decode().upper())


def connect():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME") or os.getenv("POSTGRES_DB", "wins_agro"),
        user=os.getenv("DB_USER") or os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("DB_PASSWORD") or os.getenv("POSTGRES_PASSWORD", ""),
        application_name="obrasgov_municipal_cnpj_enrichment",
        options="-c search_path=engenharia,public",
    )


def fetch_company(cnpj, timeout):
    request = Request(
        f"https://brasilapi.com.br/api/cnpj/v1/{cnpj}",
        headers={"User-Agent": "WiNSHubEngineering/1.3"},
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            return json.loads(response.read())
    except (HTTPError, OSError, TimeoutError, json.JSONDecodeError):
        return None


def discover(target, timeout):
    company, state, works = target
    query = urlencode({
        "q": company, "uf": state, "status": "ATIVA", "matriz": "1",
    })
    result = subprocess.run(
        [
            "curl", "-sS", "-A", "Mozilla/5.0", "--max-time", str(timeout),
            f"https://cnpjbrasil.inf.br/buscar?{query}",
        ],
        capture_output=True, text=True, timeout=timeout + 5, check=False,
    )
    candidates = []
    for raw in CNPJ_RE.findall(result.stdout):
        cnpj = re.sub(r"\D", "", raw)
        if cnpj not in candidates:
            candidates.append(cnpj)
    matches = []
    for cnpj in candidates[:8]:
        payload = fetch_company(cnpj, timeout)
        if not payload:
            continue
        if (
            norm(payload.get("razao_social")) == norm(company)
            and (payload.get("uf") or "").upper() == state
            and (payload.get("descricao_situacao_cadastral") or "").upper() == "ATIVA"
            and (payload.get("descricao_identificador_matriz_filial") or "").upper() == "MATRIZ"
        ):
            matches.append(cnpj)
    return company, state, works, sorted(set(matches)), len(candidates)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--timeout", type=int, default=20)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    with connect() as connection, connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT empresa, uf, count(*) AS obras
              FROM obras
             WHERE fonte = 'obrasgov_100k'
               AND COALESCE(
                     NULLIF(regexp_replace(cnpj, '\\D', '', 'g'), ''),
                     NULLIF(regexp_replace(cnpj_executora, '\\D', '', 'g'), '')
                   ) IS NULL
               AND uf IS NOT NULL
             GROUP BY empresa, uf
             ORDER BY count(*) DESC, empresa
             LIMIT %s
            """,
            (args.limit,),
        )
        targets = cursor.fetchall()

        results = []
        started = time.monotonic()
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
            futures = [pool.submit(discover, target, args.timeout) for target in targets]
            for index, future in enumerate(concurrent.futures.as_completed(futures), 1):
                results.append(future.result())
                if index % 25 == 0:
                    print(f"consultadas={index}/{len(targets)}", flush=True)

        resolved = ambiguous = no_match = updated = 0
        for company, state, works, matches, candidate_count in results:
            if len(matches) == 1:
                resolved += 1
                cnpj = matches[0]
                cursor.execute(
                    """
                    UPDATE obras
                       SET cnpj = %s, cnpj_status = 'VALIDO',
                           validacao_data = current_date,
                           validacao_metodo = 'BUSCA_PUBLICA_BRASILAPI_CONTRATANTE_UF',
                           observacoes_validacao = concat_ws(
                             E'\\n', NULLIF(observacoes_validacao, ''),
                             'CNPJ matriz ativo descoberto em busca pública e '
                             'confirmado por razão social exata e UF na BrasilAPI; '
                             'não representa outra unidade nem executora.'
                           )
                     WHERE fonte = 'obrasgov_100k'
                       AND empresa = %s AND uf = %s
                       AND COALESCE(
                             NULLIF(regexp_replace(cnpj, '\\D', '', 'g'), ''),
                             NULLIF(regexp_replace(cnpj_executora, '\\D', '', 'g'), '')
                           ) IS NULL
                    """,
                    (cnpj, company, state),
                )
                updated += cursor.rowcount
            elif len(matches) > 1:
                ambiguous += 1
            else:
                no_match += 1

        if args.dry_run:
            connection.rollback()
        else:
            connection.commit()
        print(json.dumps({
            "targets": len(targets), "resolved_entities": resolved,
            "ambiguous_entities": ambiguous, "no_match_entities": no_match,
            "updated_works": updated, "dry_run": args.dry_run,
            "elapsed_seconds": round(time.monotonic() - started, 1),
        }))


if __name__ == "__main__":
    main()
