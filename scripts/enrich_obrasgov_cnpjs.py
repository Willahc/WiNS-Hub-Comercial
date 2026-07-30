#!/usr/bin/env python3
"""Recupera CNPJs de contratantes e executores diretamente da API ObrasGov."""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import re
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import psycopg2


ENDPOINT = "https://api-publica.obrasgov.gestao.gov.br/obras/projeto-investimento"


def connect():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME") or os.getenv("POSTGRES_DB", "wins_agro"),
        user=os.getenv("DB_USER") or os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("DB_PASSWORD") or os.getenv("POSTGRES_PASSWORD", ""),
        application_name="obrasgov_cnpj_enrichment",
        options="-c search_path=engenharia,public",
    )


def clean_cnpj(value):
    digits = re.sub(r"\D", "", str(value or ""))
    return digits if len(digits) == 14 else None


def valid_cnpj(value):
    digits = clean_cnpj(value)
    if not digits or digits == digits[0] * 14:
        return False
    numbers = [int(char) for char in digits]
    for size in (12, 13):
        weights = list(range(size - 7, 1, -1)) + list(range(9, 1, -1))
        total = sum(numbers[index] * weights[index] for index in range(size))
        check = 11 - total % 11
        if check >= 10:
            check = 0
        if numbers[size] != check:
            return False
    return True


def fetch(item, timeout):
    obra_id, external_id = item
    source_id = external_id.removeprefix("OBRASGOV:")
    target = f"{ENDPOINT}?{urlencode({'id_projeto_investimento': source_id})}"
    request = Request(target, headers={"User-Agent": "WiNSHubEngineering/1.3"})
    try:
        with urlopen(request, timeout=timeout) as response:
            payload = json.loads(response.read())
        record = (payload.get("data") or [None])[0]
        if not record:
            return obra_id, source_id, None, None, "NOT_FOUND"
        responsible = clean_cnpj(record.get("cnpj_organizacao_resp"))
        executors = record.get("executores") or []
        executor = clean_cnpj((executors[0] if executors else {}).get("cnpj_executor"))
        if responsible and not valid_cnpj(responsible):
            responsible = None
        if executor and not valid_cnpj(executor):
            executor = None
        return obra_id, source_id, responsible, executor, "SUCCESS"
    except Exception as exc:  # A falha individual não interrompe o lote.
        return obra_id, source_id, None, None, f"ERROR:{type(exc).__name__}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=12)
    parser.add_argument("--timeout", type=float, default=20)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    with connect() as connection, connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id::text, id_externo
              FROM obras
             WHERE fonte = 'obrasgov_100k'
               AND id_externo LIKE 'OBRASGOV:%%'
               AND COALESCE(
                     NULLIF(regexp_replace(cnpj, '\\D', '', 'g'), ''),
                     NULLIF(regexp_replace(cnpj_executora, '\\D', '', 'g'), '')
                   ) IS NULL
             ORDER BY valor_estimado DESC NULLS LAST, id
             LIMIT %s
            """,
            (args.limit,),
        )
        targets = cursor.fetchall()

        results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
            futures = [pool.submit(fetch, item, args.timeout) for item in targets]
            for index, future in enumerate(concurrent.futures.as_completed(futures), 1):
                results.append(future.result())
                if index % 100 == 0:
                    print(f"consultadas={index}/{len(targets)}", flush=True)

        stats = {"responsible": 0, "executor_distinct": 0, "not_found": 0, "errors": 0}
        for obra_id, source_id, responsible, executor, status in results:
            if status == "NOT_FOUND":
                stats["not_found"] += 1
            elif status.startswith("ERROR:"):
                stats["errors"] += 1
            if not responsible:
                continue
            stats["responsible"] += 1
            distinct_executor = executor if executor and executor != responsible else None
            if distinct_executor:
                stats["executor_distinct"] += 1
            cursor.execute(
                """
                UPDATE obras
                   SET cnpj = %s,
                       cnpj_status = 'VALIDO',
                       cnpj_executora = COALESCE(cnpj_executora, %s),
                       executora_fonte = CASE WHEN %s IS NOT NULL
                                             THEN 'API_OBRASGOV'
                                             ELSE executora_fonte END,
                       executora_atualizada_em = CASE WHEN %s IS NOT NULL
                                                      THEN now()
                                                      ELSE executora_atualizada_em END,
                       validacao_data = current_date,
                       validacao_metodo = 'API_OBRASGOV',
                       observacoes_validacao = concat_ws(
                         E'\\n', NULLIF(observacoes_validacao, ''),
                         %s
                       )
                 WHERE id = %s::uuid
                   AND COALESCE(
                         NULLIF(regexp_replace(cnpj, '\\D', '', 'g'), ''),
                         NULLIF(regexp_replace(cnpj_executora, '\\D', '', 'g'), '')
                       ) IS NULL
                """,
                (
                    responsible,
                    distinct_executor,
                    distinct_executor,
                    distinct_executor,
                    (
                        "CNPJ do órgão responsável/contratante recuperado diretamente "
                        f"da API ObrasGov para o projeto {source_id}; executora distinta "
                        "mantida em campo separado quando informada."
                    ),
                    obra_id,
                ),
            )

        if args.dry_run:
            connection.rollback()
        else:
            connection.commit()
        print(json.dumps({"targets": len(targets), **stats, "dry_run": args.dry_run}))


if __name__ == "__main__":
    main()
