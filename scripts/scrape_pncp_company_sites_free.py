#!/usr/bin/env python3
"""Extrai gratuitamente canais corporativos de domínios já comprovados."""

import argparse
import concurrent.futures
import json
import os
import re
import ssl
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

import psycopg2


EMAIL = re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}")
PHONE = re.compile(r"(?:\+?55\D*)?(?:\(?\d{2}\)?\D*)?(?:9?\d{4})\D*(?:\d{4})")
LINKEDIN = re.compile(r"https?://(?:[\w-]+\.)?linkedin\.com/company/[\w%./?=&-]+", re.I)
INSTAGRAM = re.compile(r"https?://(?:www\.)?instagram\.com/[\w._-]+/?", re.I)
WHATSAPP = re.compile(r"https?://(?:wa\.me|api\.whatsapp\.com)/[\w?=&%+.-]+", re.I)
FREE = {"gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "yahoo.com.br"}
PATHS = ("", "contato")


def connect():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME") or os.getenv("POSTGRES_DB", "wins_agro"),
        user=os.getenv("DB_USER") or os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("DB_PASSWORD") or os.getenv("POSTGRES_PASSWORD", ""),
        options="-c search_path=engenharia,public",
    )


def get(url, timeout):
    request = Request(url, headers={"User-Agent": "Mozilla/5.0 WiNSHub/1.2"})
    context = ssl.create_default_context()
    try:
        with urlopen(request, timeout=timeout, context=context) as response:
            if "text/html" not in response.headers.get("Content-Type", ""):
                return None, None
            return response.geturl(), response.read(2_000_000).decode("utf-8", "ignore")
    except (HTTPError, URLError, TimeoutError, ssl.SSLError, OSError):
        return None, None


def scrape(row, timeout):
    domain = row["domain"]
    pages = []
    site_url = None
    for scheme in ("https", "http"):
        base = f"{scheme}://{domain}/"
        final, body = get(base, timeout)
        if body:
            site_url = final
            pages.append(body)
            for path in PATHS[1:]:
                _, extra = get(urljoin(final, path), timeout)
                if extra:
                    pages.append(extra)
            break
    text = "\n".join(pages)
    emails = sorted({
        value.lower() for value in EMAIL.findall(text)
        if value.rsplit("@", 1)[-1].lower() not in FREE
        and not value.lower().endswith((".png", ".jpg", ".webp"))
    })
    phones = sorted({re.sub(r"\D", "", value) for value in PHONE.findall(text)})
    return {
        "cnpj": row["cnpj"], "site_url": site_url,
        "email": next((e for e in emails if e.endswith("@" + domain)), emails[0] if emails else None),
        "phone": next((p for p in phones if 10 <= len(p) <= 13), None),
        "whatsapp": next(iter(WHATSAPP.findall(text)), None),
        "linkedin": next(iter(LINKEDIN.findall(text)), None),
        "instagram": next(iter(INSTAGRAM.findall(text)), None),
        "pages": len(pages),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--timeout", type=float, default=15)
    args = ap.parse_args()
    with connect() as conn, conn.cursor() as cur:
        cur.execute("""
          SELECT DISTINCT regexp_replace(d.cnpj,'\\D','','g') cnpj,d.dominio
          FROM engenharia.empresa_dominios d
          JOIN (
            SELECT DISTINCT COALESCE(
              NULLIF(regexp_replace(cnpj,'\\D','','g'),''),
              NULLIF(regexp_replace(cnpj_executora,'\\D','','g'),'')
            ) cnpj
            FROM engenharia.obras WHERE fonte='obrasgov_100k'
          ) o ON o.cnpj=regexp_replace(d.cnpj,'\\D','','g')
          JOIN engenharia.pncp_company_profiles p
            ON regexp_replace(p.cnpj,'\\D','','g')=o.cnpj
          WHERE d.dominio IS NOT NULL AND p.site_validado_em IS NULL
          ORDER BY 1
        """)
        rows = [{"cnpj": cnpj, "domain": domain} for cnpj, domain in cur.fetchall()]
    totals = {"domains": len(rows), "sites": 0, "emails": 0, "phones": 0,
              "whatsapp": 0, "linkedin": 0, "instagram": 0}
    with connect() as conn, conn.cursor() as cur:
        with concurrent.futures.ThreadPoolExecutor(args.workers) as pool:
            futures = [pool.submit(scrape, row, args.timeout) for row in rows]
            for index, future in enumerate(concurrent.futures.as_completed(futures), 1):
                item = future.result()
                cur.execute("""
              UPDATE engenharia.pncp_company_profiles SET
                site_url=%s,
                email_empresa=COALESCE(email_empresa,%s),
                telefone_1=COALESCE(telefone_1,%s),
                whatsapp_empresa=%s,linkedin_empresa=%s,instagram_empresa=%s,
                site_validado_em=CASE WHEN %s IS NOT NULL THEN now() ELSE site_validado_em END,
                dados=dados || %s::jsonb
              WHERE regexp_replace(cnpj,'\\D','','g')=%s
                """, (
                    item["site_url"], item["email"], item["phone"],
                    item["whatsapp"], item["linkedin"], item["instagram"],
                    item["site_url"], json.dumps({"site_paginas_lidas": item["pages"]}),
                    item["cnpj"],
                ))
                totals["sites"] += int(bool(item["site_url"]))
                for key in ("emails", "phones", "whatsapp", "linkedin", "instagram"):
                    totals[key] += int(bool(item[key[:-1] if key.endswith("s") else key]))
                if index % 50 == 0:
                    conn.commit()
                    print(json.dumps({"progress": index, **totals}), flush=True)
        conn.commit()
    print(json.dumps(totals, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
