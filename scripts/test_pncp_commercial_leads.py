#!/usr/bin/env python3
"""Auditoria somente leitura: contratação PNCP -> vencedora/contratada principal."""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import re
import socket
import time
from dataclasses import asdict, dataclass
from datetime import date, datetime
from typing import Any
from urllib.parse import urlparse
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import psycopg2
from psycopg2.extras import RealDictCursor


PNCP_ID = re.compile(
    r"^(?:PNCP:)?(?P<cnpj>\d{14})-\d+-(?P<sequence>\d+)/(?P<year>\d{4})$"
)
API = "https://pncp.gov.br/api/pncp/v1"
BAD_DOMAINS = re.compile(
    r"(?:^|\.)(?:gov\.br|jus\.br|org\.br|edu\.br|mil\.br|gmail\.com|"
    r"hotmail\.com|outlook\.com|yahoo\.com(?:\.br)?|facebook\.com|"
    r"instagram\.com|linkedin\.com|youtube\.com|jusbrasil\.com\.br|"
    r"econodata\.com\.br|cnpj\.biz)$",
    re.I,
)
LEGAL_STOPWORDS = {
    "LTDA", "S/A", "SA", "S.A", "EIRELI", "ME", "EPP", "SPE", "CONSORCIO",
    "CONSTRUCOES", "CONSTRUCAO", "ENGENHARIA", "SERVICOS", "COMERCIO", "DE",
    "DA", "DO", "DAS", "DOS", "E",
}


@dataclass
class Finding:
    obra_id: str
    pncp_id: str
    nome: str
    valor_estimado: float
    fonte: str
    data_publicacao: str | None
    situacao: str
    empresa_alvo_nome: str | None = None
    empresa_alvo_cnpj: str | None = None
    evidencia: str | None = None
    data_resultado: str | None = None
    detalhe: str | None = None


def get_json(
    path: str, *, timeout: float, absolute: bool = False
) -> tuple[int, Any]:
    target = path if absolute else f"{API}/{path}"
    request = Request(
        target, headers={"User-Agent": "WiNSHubEngineering/1.1"}
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            body = response.read()
            return response.status, json.loads(body) if body else None
    except HTTPError as exc:
        body = exc.read()
        try:
            payload = json.loads(body) if body else None
        except json.JSONDecodeError:
            payload = None
        return exc.code, payload


def first_page(path: str, *, timeout: float) -> tuple[int, list[dict[str, Any]]]:
    separator = "&" if "?" in path else "?"
    status, payload = get_json(
        f"{path}{separator}pagina=1&tamanhoPagina=50", timeout=timeout
    )
    if isinstance(payload, list):
        return status, payload
    if isinstance(payload, dict):
        data = payload.get("data")
        return status, data if isinstance(data, list) else []
    return status, []


def supplier_from_contract(contract: dict[str, Any]) -> tuple[str | None, str | None]:
    return (
        contract.get("nomeRazaoSocialFornecedor")
        or contract.get("nomeRazaoSocialContratado")
        or contract.get("fornecedorNome"),
        contract.get("niFornecedor")
        or contract.get("niContratado")
        or contract.get("fornecedorNi"),
    )


def inspect(row: dict[str, Any], timeout: float) -> Finding:
    finding = Finding(
        obra_id=str(row["id"]),
        pncp_id=row["id_externo"],
        nome=row["nome"],
        valor_estimado=float(row["valor_estimado"]),
        fonte=row["fonte"],
        data_publicacao=(
            row["data_publicacao"].isoformat()
            if isinstance(row["data_publicacao"], (date, datetime))
            else None
        ),
        situacao="SEM_RESULTADO",
    )
    match = PNCP_ID.match(row["id_externo"] or "")
    if not match:
        finding.situacao = "ID_INVALIDO"
        return finding

    cnpj, year, sequence = (
        match.group("cnpj"),
        match.group("year"),
        str(int(match.group("sequence"))),
    )
    try:
        contract_status, contracts = first_page(
            f"orgaos/{cnpj}/contratos/contratacao/{year}/{sequence}",
            timeout=timeout,
        )
        if contracts:
            for contract in contracts:
                name, supplier_id = supplier_from_contract(contract)
                if name or supplier_id:
                    finding.situacao = "CONTRATO_PUBLICADO"
                    finding.empresa_alvo_nome = name
                    finding.empresa_alvo_cnpj = supplier_id
                    finding.evidencia = "CONTRATO_PNCP"
                    finding.detalhe = str(
                        contract.get("numeroControlePNCP")
                        or contract.get("numeroContratoEmpenho")
                        or ""
                    )
                    return finding
            finding.situacao = "CONTRATO_SEM_FORNECEDOR"
            finding.evidencia = "CONTRATO_PNCP"
            finding.detalhe = f"{len(contracts)} contrato(s)"

        item_status, items = first_page(
            f"orgaos/{cnpj}/compras/{year}/{sequence}/itens", timeout=timeout
        )
        if item_status != 200:
            finding.situacao = "ERRO_PNCP"
            finding.detalhe = f"itens HTTP {item_status}"
            return finding

        result_items = [item for item in items if item.get("temResultado")]
        for item in result_items:
            number = item.get("numeroItem")
            status, results = first_page(
                f"orgaos/{cnpj}/compras/{year}/{sequence}/itens/{number}/resultados",
                timeout=timeout,
            )
            if status != 200:
                continue
            active = [
                result
                for result in results
                if result.get("situacaoCompraItemResultadoId") in (None, 1)
            ]
            ordered = sorted(
                active,
                key=lambda result: (
                    result.get("ordemClassificacaoSrp")
                    or result.get("ordemClassificacao")
                    or 999999
                ),
            )
            if ordered:
                winner = ordered[0]
                finding.situacao = "RESULTADO_PUBLICADO"
                finding.empresa_alvo_nome = winner.get("nomeRazaoSocialFornecedor")
                finding.empresa_alvo_cnpj = winner.get("niFornecedor")
                finding.evidencia = "RESULTADO_ITEM_PNCP"
                finding.data_resultado = winner.get("dataResultado")
                finding.detalhe = f"item {number}"
                return finding

        if result_items:
            finding.situacao = "RESULTADO_SEM_FORNECEDOR"
            finding.detalhe = f"{len(result_items)} item(ns) marcado(s) com resultado"
        elif contract_status not in (200, 404):
            finding.detalhe = f"contratos HTTP {contract_status}"
        else:
            names = sorted(
                {
                    str(item.get("situacaoCompraItemNome"))
                    for item in items
                    if item.get("situacaoCompraItemNome")
                }
            )
            finding.detalhe = ", ".join(names) or "itens sem situação"
        return finding
    except (TimeoutError, socket.timeout, URLError, json.JSONDecodeError) as exc:
        finding.situacao = "ERRO_REDE"
        finding.detalhe = type(exc).__name__
        return finding


def valid_cnpj(value: str | None) -> bool:
    digits = re.sub(r"\D", "", value or "")
    if len(digits) != 14 or digits == digits[0] * 14:
        return False
    numbers = [int(number) for number in digits]
    for length in (12, 13):
        weights = list(range(length - 7, 1, -1)) + list(range(9, 1, -1))
        total = sum(numbers[index] * weights[index] for index in range(length))
        check = 11 - total % 11
        if check >= 10:
            check = 0
        if numbers[length] != check:
            return False
    return True


def company_tokens(name: str | None) -> set[str]:
    normalized = re.sub(r"[^A-Z0-9 ]", " ", (name or "").upper())
    return {
        token for token in normalized.split()
        if len(token) >= 4 and token not in LEGAL_STOPWORDS
    }


def registrable_domain(url: str | None) -> str | None:
    if not url:
        return None
    parsed = urlparse(url if "://" in url else f"https://{url}")
    host = (parsed.hostname or "").lower().removeprefix("www.")
    if not host or BAD_DOMAINS.search(host):
        return None
    parts = host.split(".")
    if len(parts) < 2:
        return None
    if len(parts) >= 3 and parts[-1] == "br" and parts[-2] in {
        "com", "net", "ind", "eng", "agr",
    }:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:])


def domain_matches_company(domain: str, name: str | None) -> bool:
    label = domain.split(".")[0].upper()
    tokens = company_tokens(name)
    return any(token in label or label in token for token in tokens if len(token) >= 5)


def enrich_company(
    cnpj: str, expected_name: str | None, *, timeout: float
) -> dict[str, Any]:
    enriched: dict[str, Any] = {
        "cnpj_valido": valid_cnpj(cnpj),
        "cnpj_situacao": None,
        "cnpj_razao_social": None,
        "dominio": None,
        "dominio_status": "NAO_ENCONTRADO",
        "dominio_fonte": None,
    }
    if not enriched["cnpj_valido"]:
        enriched["cnpj_situacao"] = "DV_INVALIDO"
        return enriched

    status, company = get_json(
        f"https://brasilapi.com.br/api/cnpj/v1/{cnpj}", timeout=timeout,
        absolute=True,
    )
    if status == 200 and isinstance(company, dict):
        enriched["cnpj_situacao"] = company.get("descricao_situacao_cadastral")
        enriched["cnpj_razao_social"] = company.get("razao_social")
        email_domain = registrable_domain(
            (company.get("email") or "").split("@")[-1]
            if "@" in (company.get("email") or "")
            else None
        )
        official_name = company.get("razao_social") or expected_name
        if email_domain and domain_matches_company(email_domain, official_name):
            enriched.update({
                "dominio": email_domain,
                "dominio_status": "CANDIDATO_VALIDADO",
                "dominio_fonte": "BRASILAPI_EMAIL",
            })

    key = os.getenv("SERPER_API_KEY", "").strip()
    if not enriched["dominio"] and key:
        query_name = enriched["cnpj_razao_social"] or expected_name or ""
        payload = json.dumps({
            "q": f'"{query_name}" "{cnpj}"',
            "gl": "br", "hl": "pt-br", "num": 10,
        }).encode()
        request = Request(
            "https://google.serper.dev/search",
            data=payload,
            headers={"X-API-KEY": key, "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urlopen(request, timeout=timeout) as response:
                search = json.loads(response.read())
            for result in search.get("organic") or []:
                domain = registrable_domain(result.get("link"))
                if domain and domain_matches_company(domain, query_name):
                    enriched.update({
                        "dominio": domain,
                        "dominio_status": "CANDIDATO_VALIDADO",
                        "dominio_fonte": "SERPER_RAZAO_CNPJ",
                    })
                    break
        except (HTTPError, URLError, TimeoutError, socket.timeout, json.JSONDecodeError):
            enriched["dominio_status"] = "ERRO_BUSCA"
    return enriched


def connect(*, readonly: bool = True):
    options = "-c search_path=engenharia,public"
    if readonly:
        options += " -c default_transaction_read_only=on"
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME", "wins_agro"),
        user=os.getenv("DB_USER") or os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("DB_PASSWORD") or os.getenv("POSTGRES_PASSWORD", ""),
        connect_timeout=10,
        application_name="pncp_commercial_lead_readonly_test",
        options=options,
    )


def persist_targets(
    findings: list[Finding], *, enrich: bool, timeout: float
) -> dict[str, int]:
    targets = [
        finding for finding in findings
        if finding.empresa_alvo_cnpj and finding.evidencia
    ]
    metrics = {"targets": 0, "cnpj_validated": 0, "domains": 0}
    with connect(readonly=False) as connection, connection.cursor() as cursor:
        for finding in findings:
            retry_interval = (
                "1 hour" if finding.situacao in {"ERRO_REDE", "ERRO_PNCP"}
                else "1 day" if finding.situacao == "SEM_RESULTADO"
                else "7 days"
            )
            cursor.execute(
                """
                INSERT INTO engenharia.pncp_commercial_scans (
                    obra_id, pncp_id, situacao, detalhe, proxima_consulta_em
                ) VALUES (%s,%s,%s,%s,now() + %s::interval)
                ON CONFLICT (obra_id) DO UPDATE SET
                    pncp_id=EXCLUDED.pncp_id,
                    situacao=EXCLUDED.situacao,
                    detalhe=EXCLUDED.detalhe,
                    consultado_em=now(),
                    proxima_consulta_em=EXCLUDED.proxima_consulta_em,
                    tentativas=pncp_commercial_scans.tentativas + 1
                """,
                (
                    finding.obra_id, finding.pncp_id, finding.situacao,
                    finding.detalhe, retry_interval,
                ),
            )
        connection.commit()
        for finding in targets:
            cnpj = re.sub(r"\D", "", finding.empresa_alvo_cnpj or "")
            if len(cnpj) != 14:
                continue
            company = (
                enrich_company(cnpj, finding.empresa_alvo_nome, timeout=timeout)
                if enrich else {
                    "cnpj_valido": valid_cnpj(cnpj),
                    "cnpj_situacao": None,
                    "cnpj_razao_social": None,
                    "dominio": None,
                    "dominio_status": None,
                    "dominio_fonte": None,
                }
            )
            evidence_rank = 2 if finding.evidencia == "CONTRATO_PNCP" else 1
            cursor.execute(
                """
                INSERT INTO engenharia.pncp_commercial_targets (
                    obra_id, pncp_id, fornecedor_cnpj, fornecedor_nome, estagio,
                    evidencia_tipo, evidencia_id, data_resultado,
                    cnpj_valido, cnpj_situacao, cnpj_razao_social,
                    cnpj_validado_em, dominio, dominio_status, dominio_fonte,
                    dominio_validado_em, detalhes
                ) VALUES (
                    %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                    CASE WHEN %s THEN now() END,%s,%s,%s,
                    CASE WHEN %s IS NOT NULL THEN now() END,
                    jsonb_build_object('auditor','pncp-commercial-v1')
                )
                ON CONFLICT (obra_id, fornecedor_cnpj) DO UPDATE SET
                    fornecedor_nome = COALESCE(EXCLUDED.fornecedor_nome,
                                               pncp_commercial_targets.fornecedor_nome),
                    estagio = CASE
                        WHEN EXCLUDED.evidencia_tipo = 'CONTRATO_PNCP'
                            THEN EXCLUDED.estagio
                        ELSE pncp_commercial_targets.estagio
                    END,
                    evidencia_tipo = CASE
                        WHEN EXCLUDED.evidencia_tipo = 'CONTRATO_PNCP'
                            THEN EXCLUDED.evidencia_tipo
                        ELSE pncp_commercial_targets.evidencia_tipo
                    END,
                    evidencia_id = COALESCE(EXCLUDED.evidencia_id,
                                             pncp_commercial_targets.evidencia_id),
                    data_resultado = COALESCE(EXCLUDED.data_resultado,
                                               pncp_commercial_targets.data_resultado),
                    ultima_verificacao_em = now(),
                    cnpj_valido = COALESCE(EXCLUDED.cnpj_valido,
                                           pncp_commercial_targets.cnpj_valido),
                    cnpj_situacao = COALESCE(EXCLUDED.cnpj_situacao,
                                             pncp_commercial_targets.cnpj_situacao),
                    cnpj_razao_social = COALESCE(EXCLUDED.cnpj_razao_social,
                                                 pncp_commercial_targets.cnpj_razao_social),
                    cnpj_validado_em = COALESCE(EXCLUDED.cnpj_validado_em,
                                                pncp_commercial_targets.cnpj_validado_em),
                    dominio = COALESCE(EXCLUDED.dominio,
                                       pncp_commercial_targets.dominio),
                    dominio_status = COALESCE(EXCLUDED.dominio_status,
                                              pncp_commercial_targets.dominio_status),
                    dominio_fonte = COALESCE(EXCLUDED.dominio_fonte,
                                             pncp_commercial_targets.dominio_fonte),
                    dominio_validado_em = COALESCE(EXCLUDED.dominio_validado_em,
                                                   pncp_commercial_targets.dominio_validado_em)
                """,
                (
                    finding.obra_id, finding.pncp_id, cnpj,
                    finding.empresa_alvo_nome, finding.situacao,
                    finding.evidencia, finding.detalhe, finding.data_resultado,
                    company["cnpj_valido"], company["cnpj_situacao"],
                    company["cnpj_razao_social"], enrich,
                    company["dominio"], company["dominio_status"],
                    company["dominio_fonte"], company["dominio"],
                ),
            )
            cursor.execute(
                """
                UPDATE engenharia.obras
                   SET empresa_executora = COALESCE(%s, empresa_executora),
                       cnpj_executora = %s,
                       dominio_executora = COALESCE(%s, dominio_executora),
                       executora_status = %s,
                       executora_fonte = %s,
                       executora_atualizada_em = now()
                 WHERE id = %s
                   AND (
                       cnpj_executora IS NULL
                       OR cnpj_executora = %s
                       OR %s >= CASE executora_fonte
                           WHEN 'CONTRATO_PNCP' THEN 2 ELSE 1 END
                   )
                """,
                (
                    finding.empresa_alvo_nome, cnpj, company["dominio"],
                    finding.situacao, finding.evidencia, finding.obra_id,
                    cnpj, evidence_rank,
                ),
            )
            metrics["targets"] += 1
            metrics["cnpj_validated"] += int(bool(company["cnpj_valido"]))
            metrics["domains"] += int(bool(company["dominio"]))
            connection.commit()
            if enrich:
                time.sleep(0.2)
    return metrics


def enrich_existing_targets(
    *, limit: int, result_days: int, timeout: float
) -> dict[str, int]:
    with connect(readonly=True) as connection, connection.cursor(
        cursor_factory=RealDictCursor
    ) as cursor:
        cursor.execute(
            """
            SELECT DISTINCT ON (fornecedor_cnpj)
                   fornecedor_cnpj, fornecedor_nome
              FROM engenharia.pncp_commercial_targets
             WHERE estagio='RESULTADO_PUBLICADO'
               AND data_resultado >= current_date - %s
               AND (
                   cnpj_validado_em IS NULL
                   OR dominio_validado_em IS NULL
               )
             ORDER BY fornecedor_cnpj, data_resultado DESC NULLS LAST
             LIMIT %s
            """,
            (result_days, limit),
        )
        companies = cursor.fetchall()

    metrics = {
        "companies": len(companies), "active": 0, "domains": 0, "errors": 0
    }
    with connect(readonly=False) as connection, connection.cursor() as cursor:
        for company_row in companies:
            cnpj = company_row["fornecedor_cnpj"]
            try:
                company = enrich_company(
                    cnpj, company_row["fornecedor_nome"], timeout=timeout
                )
            except Exception:
                metrics["errors"] += 1
                continue
            cursor.execute(
                """
                UPDATE engenharia.pncp_commercial_targets
                   SET cnpj_valido=%s,
                       cnpj_situacao=%s,
                       cnpj_razao_social=%s,
                       cnpj_validado_em=now(),
                       dominio=COALESCE(%s,dominio),
                       dominio_status=COALESCE(%s,dominio_status),
                       dominio_fonte=COALESCE(%s,dominio_fonte),
                       dominio_validado_em=CASE
                           WHEN %s IS NOT NULL THEN now()
                           ELSE dominio_validado_em
                       END
                 WHERE fornecedor_cnpj=%s
                """,
                (
                    company["cnpj_valido"], company["cnpj_situacao"],
                    company["cnpj_razao_social"], company["dominio"],
                    company["dominio_status"], company["dominio_fonte"],
                    company["dominio"], cnpj,
                ),
            )
            connection.commit()
            metrics["active"] += int(company["cnpj_situacao"] == "ATIVA")
            metrics["domains"] += int(bool(company["dominio"]))
            time.sleep(0.2)
    return metrics


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--days", type=int, default=365)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--timeout", type=float, default=20)
    parser.add_argument("--output")
    parser.add_argument("--persist", action="store_true")
    parser.add_argument("--enrich", action="store_true")
    parser.add_argument("--year-min", type=int)
    parser.add_argument("--year-max", type=int)
    parser.add_argument("--approved-only", action="store_true")
    parser.add_argument("--only-unscanned", action="store_true")
    parser.add_argument("--gold-only", action="store_true")
    parser.add_argument("--enrich-existing", action="store_true")
    parser.add_argument("--result-days", type=int, default=30)
    args = parser.parse_args()

    if args.enrich_existing:
        print(json.dumps(
            enrich_existing_targets(
                limit=args.limit, result_days=args.result_days,
                timeout=args.timeout,
            ),
            ensure_ascii=False, indent=2,
        ))
        return 0

    with connect(readonly=True) as connection, connection.cursor(
        cursor_factory=RealDictCursor
    ) as cursor:
        cursor.execute(
            """
            WITH base AS (
                SELECT DISTINCT ON (
                           regexp_replace(id_externo, '^PNCP:', '')
                       )
                       id, id_externo, nome, valor_estimado, fonte,
                       data_publicacao, engineering_collected_at
                  FROM engenharia.obras
                 WHERE fonte LIKE 'pncp%%'
                   AND valor_estimado >= 100000
                   AND id_externo ~ '^(PNCP:)?[0-9]{14}-[0-9]+-[0-9]+/[0-9]{4}$'
                   AND COALESCE(data_publicacao, criado_em::date)
                       >= current_date - %s
                   AND (%s IS NULL OR
                        split_part(regexp_replace(id_externo, '^PNCP:', ''), '/', 2)::int >= %s)
                   AND (%s IS NULL OR
                        split_part(regexp_replace(id_externo, '^PNCP:', ''), '/', 2)::int <= %s)
                   AND (NOT %s OR visivel OR status_portao = 'APROVADA')
                   AND (NOT %s OR classificacao_computed = 'OURO')
                   AND (NOT %s OR NOT EXISTS (
                       SELECT 1
                         FROM engenharia.pncp_commercial_scans scan
                        WHERE scan.obra_id = obras.id
                   ))
                 ORDER BY regexp_replace(id_externo, '^PNCP:', ''),
                          engineering_collected_at DESC NULLS LAST,
                          criado_em DESC
            )
            SELECT id, id_externo, nome, valor_estimado, fonte, data_publicacao
              FROM base
             ORDER BY data_publicacao DESC NULLS LAST, valor_estimado DESC
             LIMIT %s
            """,
            (
                args.days,
                args.year_min, args.year_min,
                args.year_max, args.year_max,
                args.approved_only,
                args.gold_only,
                args.only_unscanned,
                args.limit,
            ),
        )
        rows = cursor.fetchall()

    with concurrent.futures.ThreadPoolExecutor(
        max_workers=max(1, args.workers)
    ) as executor:
        findings = list(executor.map(lambda row: inspect(row, args.timeout), rows))

    counts: dict[str, int] = {}
    for finding in findings:
        counts[finding.situacao] = counts.get(finding.situacao, 0) + 1
    report = {
        "generated_at": datetime.now().astimezone().isoformat(),
        "readonly": True,
        "sample_size": len(findings),
        "counts": dict(sorted(counts.items())),
        "commercial_targets": [
            asdict(finding)
            for finding in findings
            if finding.empresa_alvo_nome or finding.empresa_alvo_cnpj
        ],
        "findings": [asdict(finding) for finding in findings],
    }
    if args.persist:
        report["persistence"] = persist_targets(
            findings, enrich=args.enrich, timeout=args.timeout
        )
    output = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as handle:
            handle.write(output + "\n")
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
