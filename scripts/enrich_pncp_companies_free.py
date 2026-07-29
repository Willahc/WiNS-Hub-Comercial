#!/usr/bin/env python3
"""Enriquece empresas PNCP exclusivamente com fontes públicas/gratuitas."""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import re
import socket
import time
from dataclasses import dataclass
from datetime import date
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

import psycopg2
from psycopg2.extras import Json, RealDictCursor


FREE_DOMAINS = {
    "gmail.com", "hotmail.com", "outlook.com", "yahoo.com",
    "yahoo.com.br", "live.com", "icloud.com", "uol.com.br",
    "bol.com.br", "terra.com.br",
}
ADMIN_QUALIFICATIONS = (
    "ADMINISTRADOR", "TITULAR", "PRESIDENTE", "DIRETOR",
    "EMPRESÁRIO", "EMPRESARIO",
)


@dataclass
class Result:
    cnpj: str
    status: str
    payload: dict
    error: str | None = None


def connect(readonly: bool = False):
    options = "-c search_path=engenharia,public"
    if readonly:
        options += " -c default_transaction_read_only=on"
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME") or os.getenv("POSTGRES_DB", "wins_agro"),
        user=os.getenv("DB_USER") or os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("DB_PASSWORD") or os.getenv("POSTGRES_PASSWORD", ""),
        connect_timeout=10,
        application_name="pncp_free_company_enrichment",
        options=options,
    )


def clean_email(value):
    email = (value or "").strip().lower()
    return email if re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email) else None


def email_domain(email, allow_government=False):
    if not email:
        return None
    domain = email.rsplit("@", 1)[1].lower().removeprefix("www.")
    if domain in FREE_DOMAINS or (domain.endswith(".gov.br") and not allow_government):
        return None
    return domain


def domain_resolves(domain):
    try:
        socket.getaddrinfo(domain, 443)
        return True
    except socket.gaierror:
        return False


def normalize_open_cnpj(payload):
    address = payload.get("address") or {}
    company = payload.get("company") or {}
    phones = payload.get("phones") or []
    emails = payload.get("emails") or []
    members = company.get("members") or []
    return {
        "cnpj": payload.get("taxId"),
        "razao_social": company.get("name"),
        "nome_fantasia": payload.get("alias"),
        "descricao_situacao_cadastral": (payload.get("status") or {}).get("text"),
        "email": next((item.get("address") for item in emails
                       if item.get("ownership") == "CORPORATE"), None),
        "ddd_telefone_1": (
            f"{phones[0].get('area', '')}{phones[0].get('number', '')}"
            if phones else None
        ),
        "ddd_telefone_2": (
            f"{phones[1].get('area', '')}{phones[1].get('number', '')}"
            if len(phones) > 1 else None
        ),
        "logradouro": address.get("street"), "numero": address.get("number"),
        "complemento": address.get("details"), "bairro": address.get("district"),
        "municipio": address.get("city"), "uf": address.get("state"),
        "cep": address.get("zip"),
        "capital_social": company.get("equity"),
        "porte": (company.get("size") or {}).get("text"),
        "descricao_cnae_fiscal": (payload.get("mainActivity") or {}).get("text"),
        "qsa": [
            {
                "nome_socio": (member.get("person") or {}).get("name"),
                "qualificacao_socio": (member.get("role") or {}).get("text"),
                "data_entrada_sociedade": member.get("since"),
                "identificador_de_socio": (member.get("person") or {}).get("type"),
            }
            for member in members
        ],
        "_source_url": f"https://open.cnpja.com/office/{payload.get('taxId')}",
        "_source": "OPEN_CNPJ",
    }


def fetch_brasil_api(cnpj: str, timeout: float, fast_fail: bool = False) -> Result:
    url = f"https://brasilapi.com.br/api/cnpj/v1/{cnpj}"
    for attempt in range(1 if fast_fail else 8):
        request = Request(url, headers={"User-Agent": "WiNSHubEngineering/1.2"})
        try:
            with urlopen(request, timeout=timeout) as response:
                payload = json.loads(response.read())
            return Result(cnpj, "SUCCESS", payload)
        except HTTPError as exc:
            if exc.code == 404:
                return Result(cnpj, "NOT_FOUND", {}, "HTTP 404")
            if exc.code == 429 or 500 <= exc.code < 600:
                retry_after = exc.headers.get("Retry-After")
                delay = float(retry_after) if retry_after and retry_after.isdigit() else min(60, 5 * (attempt + 1))
                time.sleep(delay)
                continue
            return Result(cnpj, "HTTP_ERROR", {}, f"HTTP {exc.code}")
        except (URLError, TimeoutError, socket.timeout, json.JSONDecodeError) as exc:
            if attempt < 3:
                time.sleep(2 * (attempt + 1))
                continue
            return Result(cnpj, "NETWORK_ERROR", {}, type(exc).__name__)
    return Result(cnpj, "HTTP_ERROR", {}, "limite de tentativas")


def fetch(cnpj: str, timeout: float, fast_fail: bool = False) -> Result:
    url = f"https://open.cnpja.com/office/{cnpj}"
    request = Request(url, headers={"User-Agent": "WiNSHubEngineering/1.2"})
    try:
        with urlopen(request, timeout=timeout) as response:
            payload = json.loads(response.read())
        return Result(cnpj, "SUCCESS", normalize_open_cnpj(payload))
    except HTTPError as exc:
        if exc.code == 404:
            return fetch_brasil_api(cnpj, timeout, fast_fail)
        if exc.code == 429 or 500 <= exc.code < 600:
            if not fast_fail:
                time.sleep(2)
            return fetch_brasil_api(cnpj, timeout, fast_fail)
        return Result(cnpj, "HTTP_ERROR", {}, f"OpenCNPJ HTTP {exc.code}")
    except (URLError, TimeoutError, socket.timeout, json.JSONDecodeError):
        return fetch_brasil_api(cnpj, timeout, fast_fail)


def parse_date(value):
    try:
        return date.fromisoformat(value) if value else None
    except ValueError:
        return None


def persist(
    result: Result, connection, allow_government_domains: bool = False
) -> dict[str, int]:
    p = result.payload
    email = clean_email(p.get("email"))
    domain = email_domain(email, allow_government_domains)
    domain_ok = bool(domain and domain_resolves(domain))
    if not domain_ok:
        domain = None
    retry = "30 days" if result.status == "SUCCESS" else "1 day"
    metrics = {"profile": 0, "email": 0, "phone": 0, "domain": 0, "officers": 0}
    with connection.cursor() as cur:
        cur.execute(
            """
            INSERT INTO engenharia.pncp_company_profiles (
              cnpj,razao_social,nome_fantasia,situacao_cadastral,email_empresa,
              telefone_1,telefone_2,logradouro,numero,complemento,bairro,
              municipio,uf,cep,dominio,dominio_status,fonte_url,consultado_em,
              proxima_consulta_em,status_consulta,erro,dados
            ) VALUES (
              %(cnpj)s,%(razao)s,%(fantasia)s,%(situacao)s,%(email)s,
              %(tel1)s,%(tel2)s,%(logradouro)s,%(numero)s,%(complemento)s,
              %(bairro)s,%(municipio)s,%(uf)s,%(cep)s,%(dominio)s,
              %(dom_status)s,%(url)s,now(),now()+%(retry)s::interval,
              %(status)s,%(erro)s,%(dados)s
            )
            ON CONFLICT (cnpj) DO UPDATE SET
              razao_social=EXCLUDED.razao_social,
              nome_fantasia=EXCLUDED.nome_fantasia,
              situacao_cadastral=EXCLUDED.situacao_cadastral,
              email_empresa=EXCLUDED.email_empresa,
              telefone_1=EXCLUDED.telefone_1,
              telefone_2=EXCLUDED.telefone_2,
              logradouro=EXCLUDED.logradouro,numero=EXCLUDED.numero,
              complemento=EXCLUDED.complemento,bairro=EXCLUDED.bairro,
              municipio=EXCLUDED.municipio,uf=EXCLUDED.uf,cep=EXCLUDED.cep,
              dominio=COALESCE(EXCLUDED.dominio,pncp_company_profiles.dominio),
              dominio_status=EXCLUDED.dominio_status,
              consultado_em=now(),proxima_consulta_em=EXCLUDED.proxima_consulta_em,
              status_consulta=EXCLUDED.status_consulta,erro=EXCLUDED.erro,
              dados=EXCLUDED.dados
            """,
            {
                "cnpj": result.cnpj, "razao": p.get("razao_social"),
                "fantasia": p.get("nome_fantasia"),
                "situacao": p.get("descricao_situacao_cadastral"),
                "email": email, "tel1": p.get("ddd_telefone_1"),
                "tel2": p.get("ddd_telefone_2"), "logradouro": p.get("logradouro"),
                "numero": p.get("numero"), "complemento": p.get("complemento"),
                "bairro": p.get("bairro"), "municipio": p.get("municipio"),
                "uf": p.get("uf"), "cep": p.get("cep"), "dominio": domain,
                "dom_status": "EMAIL_RFB_DNS_OK" if domain else "NAO_ENCONTRADO",
                "url": p.get("_source_url") or f"https://brasilapi.com.br/api/cnpj/v1/{result.cnpj}",
                "retry": retry, "status": result.status, "erro": result.error,
                "dados": Json({
                    "cnae_fiscal": p.get("cnae_fiscal"),
                    "descricao_cnae_fiscal": p.get("descricao_cnae_fiscal"),
                    "capital_social": p.get("capital_social"),
                    "porte": p.get("porte"),
                }),
            },
        )
        if result.status == "SUCCESS":
            metrics["profile"] = 1
            metrics["email"] = int(bool(email))
            metrics["phone"] = int(bool(p.get("ddd_telefone_1")))
            metrics["domain"] = int(bool(domain))
        for officer in p.get("qsa") or []:
            name = re.sub(r"\s+", " ", (officer.get("nome_socio") or "").strip())
            if not name:
                continue
            cur.execute(
                """
                INSERT INTO engenharia.pncp_company_officers
                  (cnpj,nome,qualificacao,data_entrada,consultado_em,dados)
                VALUES (%s,%s,%s,%s,now(),%s)
                ON CONFLICT (cnpj,nome) DO UPDATE SET
                  qualificacao=EXCLUDED.qualificacao,
                  data_entrada=EXCLUDED.data_entrada,
                  consultado_em=now(),dados=EXCLUDED.dados
                """,
                (
                    result.cnpj, name, officer.get("qualificacao_socio"),
                    parse_date(officer.get("data_entrada_sociedade")),
                    Json({"identificador_de_socio": officer.get("identificador_de_socio")}),
                ),
            )
            metrics["officers"] += 1
    connection.commit()
    return metrics


def propagate(connection, all_works=False):
    with connection.cursor() as cur:
        cur.execute(
            """
            UPDATE engenharia.pncp_commercial_targets t SET
              cnpj_situacao=COALESCE(p.situacao_cadastral,t.cnpj_situacao),
              cnpj_razao_social=COALESCE(p.razao_social,t.cnpj_razao_social),
              cnpj_validado_em=CASE WHEN p.status_consulta='SUCCESS' THEN now()
                                    ELSE t.cnpj_validado_em END,
              dominio=COALESCE(t.dominio,p.dominio),
              dominio_status=CASE WHEN t.dominio IS NULL AND p.dominio IS NOT NULL
                                  THEN p.dominio_status ELSE t.dominio_status END,
              dominio_fonte=CASE WHEN t.dominio IS NULL AND p.dominio IS NOT NULL
                                 THEN 'BRASILAPI_EMAIL_RFB' ELSE t.dominio_fonte END,
              dominio_validado_em=CASE WHEN t.dominio IS NULL AND p.dominio IS NOT NULL
                                       THEN now() ELSE t.dominio_validado_em END,
              detalhes=t.detalhes || jsonb_strip_nulls(jsonb_build_object(
                'email_empresa',p.email_empresa,'telefone_empresa',p.telefone_1,
                'nome_fantasia',p.nome_fantasia,'municipio_empresa',p.municipio,
                'uf_empresa',p.uf,'perfil_fonte',p.fonte_url))
            FROM engenharia.pncp_company_profiles p
            WHERE p.cnpj=t.fornecedor_cnpj
            """
        )
        targets_updated = cur.rowcount
        cur.execute(
            """
            UPDATE engenharia.obras o SET
              empresa_executora=COALESCE(p.razao_social,o.empresa_executora),
              dominio_executora=COALESCE(o.dominio_executora,p.dominio),
              executora_atualizada_em=now(),
              observacoes_enrichment=concat_ws(E'\n',o.observacoes_enrichment,
                concat('BrasilAPI/Receita: ',
                  CASE WHEN p.email_empresa IS NOT NULL THEN 'e-mail empresarial; ' ELSE '' END,
                  CASE WHEN p.telefone_1 IS NOT NULL THEN 'telefone empresarial; ' ELSE '' END,
                  'perfil consultado ',to_char(p.consultado_em,'YYYY-MM-DD')))
            FROM engenharia.pncp_company_profiles p
            WHERE p.cnpj=CASE WHEN %s THEN
                COALESCE(NULLIF(o.cnpj_executora,''),NULLIF(o.cnpj,''))
              ELSE o.cnpj_executora END
              AND p.status_consulta='SUCCESS'
            """
            , (all_works,)
        )
        works_updated = cur.rowcount
        cur.execute(
            """
            INSERT INTO engenharia.decisores_obra (
              obra_id,nome,cargo,fonte,registrado_por,tipo_cargo,
              confianca_match,confianca_match_v1,confianca_match_componentes,
              confianca_match_calculada_em,hipotese_replicacao,observacoes
            )
            SELECT o.id, q.nome, q.qualificacao,
              'BrasilAPI QSA / Receita Federal',
              'pncp_free_enrichment_v1','OUTRO',75,75,
              jsonb_build_object('cnpj_qsa',35,'qualificacao_administrador',30,
                                 'fonte_publica',10),
              now(),'OK',
              'Responsável societário vinculado ao CNPJ da executora. Canal da empresa mantido separado; nenhum e-mail pessoal foi inferido.'
            FROM engenharia.obras o
            JOIN engenharia.pncp_company_officers q
              ON q.cnpj=CASE WHEN %s THEN
                   COALESCE(NULLIF(o.cnpj_executora,''),NULLIF(o.cnpj,''))
                 ELSE o.cnpj_executora END
            WHERE upper(coalesce(q.qualificacao,'')) LIKE ANY
              (ARRAY['%%ADMINISTRADOR%%','%%TITULAR%%','%%PRESIDENTE%%',
                     '%%DIRETOR%%','%%EMPRESÁRIO%%','%%EMPRESARIO%%'])
              AND (NOT %s OR (
                o.classificacao_computed='BRONZE'
                AND NOT EXISTS (
                  SELECT 1 FROM engenharia.decisores_obra dx
                  WHERE dx.obra_id=o.id AND dx.excluido_em IS NULL
                    AND COALESCE(dx.hipotese_replicacao,'')
                      <> 'REPLICADO_PROVAVEL_FALSO_POSITIVO'
                )
              ))
            ON CONFLICT (obra_id,nome) WHERE excluido_em IS NULL DO NOTHING
            """,
            (all_works, all_works),
        )
        officers_propagated = cur.rowcount
    connection.commit()
    return {
        "targets_updated": targets_updated,
        "works_updated": works_updated,
        "officers_propagated": officers_propagated,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=10000)
    ap.add_argument("--workers", type=int, default=1)
    ap.add_argument("--timeout", type=float, default=20)
    ap.add_argument("--retry-errors", action="store_true")
    ap.add_argument("--refresh-all", action="store_true")
    ap.add_argument(
        "--all-bronze-no-decisor", action="store_true",
        help="consulta CNPJs de todas as BRONZE sem decisor, não só PNCP",
    )
    ap.add_argument(
        "--obrasgov", action="store_true",
        help="consulta CNPJs contratantes/executores das obras ObrasGov",
    )
    ap.add_argument(
        "--allow-government-domains", action="store_true",
        help="aceita domínios gov.br extraídos de e-mails cadastrais oficiais",
    )
    ap.add_argument(
        "--brasil-api-only", action="store_true",
        help="ignora OpenCNPJ e consulta diretamente a BrasilAPI",
    )
    ap.add_argument(
        "--descending", action="store_true",
        help="processa CNPJs em ordem inversa para permitir duas frentes gratuitas",
    )
    ap.add_argument(
        "--fast-fail", action="store_true",
        help="não bloqueia a fila em retentativas longas de rate limit",
    )
    ap.add_argument("--delay", type=float, default=0.8)
    args = ap.parse_args()
    with connect(True) as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        if args.obrasgov:
            cur.execute(
                """
                WITH pending AS (
                  SELECT DISTINCT COALESCE(
                    NULLIF(regexp_replace(o.cnpj,'\\D','','g'),''),
                    NULLIF(regexp_replace(o.cnpj_executora,'\\D','','g'),'')
                  ) cnpj
                  FROM engenharia.obras o
                  LEFT JOIN engenharia.pncp_company_profiles p
                    ON regexp_replace(p.cnpj,'\\D','','g')=COALESCE(
                      NULLIF(regexp_replace(o.cnpj,'\\D','','g'),''),
                      NULLIF(regexp_replace(o.cnpj_executora,'\\D','','g'),'')
                    )
                  WHERE o.fonte='obrasgov_100k'
                    AND COALESCE(
                      NULLIF(regexp_replace(o.cnpj,'\\D','','g'),''),
                      NULLIF(regexp_replace(o.cnpj_executora,'\\D','','g'),'')
                    ) IS NOT NULL
                    AND (
                      %s OR p.cnpj IS NULL
                      OR (%s AND p.status_consulta<>'SUCCESS')
                    )
                )
                SELECT cnpj FROM pending
                ORDER BY
                  CASE WHEN %s THEN cnpj END DESC,
                  CASE WHEN NOT %s THEN cnpj END ASC
                LIMIT %s
                """,
                (args.refresh_all, args.retry_errors, args.descending,
                 args.descending, args.limit),
            )
        elif args.all_bronze_no_decisor:
            cur.execute(
                """
                WITH pending AS (
                  SELECT DISTINCT COALESCE(
                    NULLIF(o.cnpj_executora,''),NULLIF(o.cnpj,'')
                  ) cnpj
                  FROM engenharia.obras o
                  LEFT JOIN engenharia.pncp_company_profiles p
                    ON p.cnpj=COALESCE(
                      NULLIF(o.cnpj_executora,''),NULLIF(o.cnpj,'')
                    )
                  WHERE o.classificacao_computed='BRONZE'
                    AND COALESCE(
                      NULLIF(o.cnpj_executora,''),NULLIF(o.cnpj,'')
                    ) IS NOT NULL
                    AND NOT EXISTS (
                      SELECT 1 FROM engenharia.decisores_obra d
                      WHERE d.obra_id=o.id AND d.excluido_em IS NULL
                        AND COALESCE(d.hipotese_replicacao,'')
                          <> 'REPLICADO_PROVAVEL_FALSO_POSITIVO'
                    )
                    AND (
                      %s OR p.cnpj IS NULL
                      OR (%s AND p.status_consulta<>'SUCCESS')
                    )
                )
                SELECT cnpj FROM pending
                ORDER BY
                  CASE WHEN %s THEN cnpj END DESC,
                  CASE WHEN NOT %s THEN cnpj END ASC
                LIMIT %s
                """,
                (args.refresh_all, args.retry_errors, args.descending,
                 args.descending, args.limit),
            )
        else:
            cur.execute(
                """
            SELECT DISTINCT t.fornecedor_cnpj cnpj
            FROM engenharia.pncp_commercial_targets t
            LEFT JOIN engenharia.pncp_company_profiles p
              ON p.cnpj=t.fornecedor_cnpj
            WHERE %s
               OR p.cnpj IS NULL
               OR (%s AND p.status_consulta<>'SUCCESS')
            ORDER BY
              CASE WHEN %s THEN t.fornecedor_cnpj END DESC,
              CASE WHEN NOT %s THEN t.fornecedor_cnpj END ASC
            LIMIT %s
            """,
            (args.refresh_all, args.retry_errors, args.descending,
             args.descending, args.limit),
            )
        cnpjs = [r["cnpj"] for r in cur.fetchall()]
    totals = {"requested": len(cnpjs), "profile": 0, "email": 0,
              "phone": 0, "domain": 0, "officers": 0, "errors": 0}
    with concurrent.futures.ThreadPoolExecutor(args.workers) as pool:
        if args.brasil_api_only:
            results = pool.map(
                lambda c: fetch_brasil_api(c, args.timeout, args.fast_fail), cnpjs
            )
        else:
            results = pool.map(
                lambda c: fetch(c, args.timeout, args.fast_fail), cnpjs
            )
        with connect(False) as conn:
            for index, result in enumerate(results, 1):
                metrics = persist(result, conn, args.allow_government_domains)
                for key, value in metrics.items():
                    totals[key] += value
                totals["errors"] += int(result.status != "SUCCESS")
                if index % 100 == 0:
                    print(json.dumps({"progress": index, **totals}), flush=True)
                time.sleep(max(0, args.delay))
            totals["propagation"] = propagate(conn, args.all_bronze_no_decisor)
    print(json.dumps(totals, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
