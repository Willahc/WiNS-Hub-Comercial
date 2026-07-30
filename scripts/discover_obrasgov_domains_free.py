#!/usr/bin/env python3
"""Descobre domínios ObrasGov via Bing RSS e valida no próprio site."""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import re
import socket
import unicodedata
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse

import psycopg2
from psycopg2.extras import RealDictCursor


BLOCKED = re.compile(
    r"(bing|google|linkedin|facebook|instagram|youtube|cnpj|econodata|"
    r"consultasocio|casadosdados|transparencia|jusbrasil|diariooficial|"
    r"wikipedia|comprasnet|pncp)",
    re.I,
)
STOP = {
    "MUNICIPIO", "PREFEITURA", "SECRETARIA", "ESTADO", "FEDERAL",
    "INSTITUTO", "FUNDACAO", "UNIVERSIDADE", "BRASIL", "COMPANHIA",
    "EDUCACAO", "CIENCIA", "TECNOLOGIA", "ADMINISTRACAO", "SOCIAL",
}


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
        application_name="obrasgov_domain_discovery_free",
    )


def norm(value):
    value = unicodedata.normalize("NFKD", value or "")
    return re.sub(r"[^A-Z0-9]", "", value.encode("ascii", "ignore").decode().upper())


def tokens(value):
    value = unicodedata.normalize("NFKD", value or "")
    words = re.findall(r"[A-Z0-9]+", value.encode("ascii", "ignore").decode().upper())
    return [w for w in words if len(w) >= 4 and w not in STOP]


def domain(url):
    host = (urlparse(url).hostname or "").lower().removeprefix("www.")
    return host if "." in host and not BLOCKED.search(host) else None


def get(url, timeout, limit=700_000):
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 WiNSHub/1.4"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            ctype = response.headers.get("Content-Type", "")
            if "text/html" not in ctype and "xml" not in ctype:
                return None, None
            return response.geturl(), response.read(limit).decode("utf-8", "ignore")
    except (HTTPError, URLError, TimeoutError, socket.timeout, OSError):
        return None, None


def search(row, timeout):
    formatted = (
        f"{row['cnpj'][:2]}.{row['cnpj'][2:5]}.{row['cnpj'][5:8]}/"
        f"{row['cnpj'][8:12]}-{row['cnpj'][12:]}"
    )
    query = f'"{formatted}" "{row["razao_social"]}"'
    rss = "https://www.bing.com/search?format=rss&setlang=pt-br&q=" + urllib.parse.quote(query)
    _, body = get(rss, timeout)
    if not body:
        return row, None, "SEARCH_ERROR", query
    try:
        root = ET.fromstring(body)
    except ET.ParseError:
        return row, None, "SEARCH_ERROR", query
    name_tokens = tokens(row["razao_social"])
    for item in root.findall(".//item"):
        link = item.findtext("link") or ""
        candidate = domain(link)
        if not candidate:
            continue
        title = item.findtext("title") or ""
        snippet = item.findtext("description") or ""
        result_text = norm(title + " " + snippet)
        result_has_cnpj = row["cnpj"] in result_text
        host_text = norm(candidate)
        host_match = any(t in host_text for t in name_tokens)
        if not result_has_cnpj and not host_match:
            continue
        final, page = get(link, timeout)
        if not page:
            continue
        final_domain = domain(final or link)
        if not final_domain:
            continue
        page_text = norm(page)
        page_has_cnpj = row["cnpj"] in page_text
        page_name_hits = sum(t in page_text for t in name_tokens[:6])
        official_gov = final_domain.endswith(".gov.br") and (
            host_match or page_name_hits >= min(2, len(name_tokens))
        )
        if page_has_cnpj or official_gov:
            return (
                row, final_domain,
                "CONFIRMADO_CNPJ_SITE" if page_has_cnpj else "CONFIRMADO_GOV_NOME",
                link,
            )
    return row, None, "NAO_ENCONTRADO", query


def direct_government(row, timeout):
    name = re.sub(
        r"^(MUNICIPIO|PREFEITURA MUNICIPAL)\s+(DE|DO|DA|DOS|DAS)?\s*",
        "", row["razao_social"], flags=re.I,
    )
    slug = re.sub(r"[^a-z0-9]", "", unicodedata.normalize(
        "NFKD", name
    ).encode("ascii", "ignore").decode().lower())
    uf = (row["uf"] or "").lower()
    if not slug or len(uf) != 2:
        return row, None, "NAO_APLICAVEL", "sem slug/UF"
    expected = tokens(name)
    for candidate in (f"{slug}.{uf}.gov.br", f"prefeitura{slug}.{uf}.gov.br"):
        try:
            socket.getaddrinfo(candidate, 443)
        except socket.gaierror:
            continue
        for scheme in ("https", "http"):
            final, page = get(f"{scheme}://{candidate}/", timeout)
            if not page:
                continue
            final_domain = domain(final or f"{scheme}://{candidate}/")
            page_text = norm(page)
            hits = sum(t in page_text for t in expected[:5])
            if final_domain and (
                hits >= min(2, len(expected))
                or (len(expected) == 1 and expected[0] in page_text)
            ):
                return row, final_domain, "CONFIRMADO_GOV_DNS_PAGINA", final
    return row, None, "NAO_ENCONTRADO", f"{slug}.{uf}.gov.br"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=10000)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--timeout", type=float, default=12)
    ap.add_argument("--direct-government", action="store_true")
    args = ap.parse_args()
    with connect(True) as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            WITH targets AS (
              SELECT DISTINCT
                COALESCE(NULLIF(regexp_replace(o.cnpj,'\\D','','g'),''),
                         NULLIF(regexp_replace(o.cnpj_executora,'\\D','','g'),'')) cnpj
              FROM engenharia.obras o
              LEFT JOIN engenharia.empresa_dominios d
                ON regexp_replace(d.cnpj,'\\D','','g')=COALESCE(
                  NULLIF(regexp_replace(o.cnpj,'\\D','','g'),''),
                  NULLIF(regexp_replace(o.cnpj_executora,'\\D','','g'),''))
              WHERE o.fonte='obrasgov_100k' AND d.cnpj IS NULL
            )
            SELECT t.cnpj,p.razao_social,p.uf
            FROM targets t JOIN engenharia.pncp_company_profiles p
              ON regexp_replace(p.cnpj,'\\D','','g')=t.cnpj
            WHERE p.razao_social IS NOT NULL
              AND (%s = false OR p.razao_social ~* '^(MUNICIPIO|PREFEITURA MUNICIPAL)')
            ORDER BY t.cnpj LIMIT %s
            """,
            (args.direct_government, args.limit),
        )
        rows = cur.fetchall()
    totals = {"targets": len(rows), "confirmed": 0, "not_found": 0, "errors": 0}
    with connect(False) as conn, conn.cursor() as cur:
        with concurrent.futures.ThreadPoolExecutor(args.workers) as pool:
            worker = direct_government if args.direct_government else search
            for index, (row, found, status, evidence) in enumerate(
                pool.map(lambda r: worker(r, args.timeout), rows), 1
            ):
                if found:
                    cur.execute(
                        """
                        INSERT INTO engenharia.empresa_dominios
                          (cnpj,empresa_nome,dominio,fonte,confianca,observacoes,
                           criado_em,atualizado_em,dominio_status,validacao_metodo,
                           validacao_data)
                        VALUES (%s,%s,%s,'BING_RSS_SITE_PUBLICO',%s,%s,now(),now(),
                                'VALIDADO',%s,current_date)
                        ON CONFLICT(cnpj) DO NOTHING
                        """,
                        (
                            row["cnpj"], row["razao_social"], found,
                            5 if status == "CONFIRMADO_CNPJ_SITE" else 4,
                            f"Evidência: {evidence}", status,
                        ),
                    )
                    totals["confirmed"] += cur.rowcount
                elif status == "SEARCH_ERROR":
                    totals["errors"] += 1
                else:
                    totals["not_found"] += 1
                if index % 100 == 0:
                    conn.commit()
                    print(json.dumps({"progress": index, **totals}), flush=True)
        conn.commit()
    print(json.dumps(totals, ensure_ascii=False))


if __name__ == "__main__":
    main()
