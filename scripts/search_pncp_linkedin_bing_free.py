#!/usr/bin/env python3
"""Busca gratuita e auditável de LinkedIn pessoal via Bing RSS.

Processa toda a fila QSA sem depender de Serper, Hunter ou Apollo. A promoção
continua conservadora: nome completo e ao menos um token distintivo da empresa
precisam aparecer no resultado do perfil pessoal.
"""

import argparse
import concurrent.futures
import json
import re
import time
import unicodedata
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

from psycopg2.extras import Json, RealDictCursor, execute_batch

from search_pncp_linkedin_google import ROLE_RE, connect, tokens


ENTITY_RE = re.compile(
    r"\b(LTDA|EIRELI|S/?A|HOLDING|PARTICIPACOES|CONSORCIO|FUNDO|ASSOCIACAO)\b",
    re.I,
)


def norm(value):
    value = unicodedata.normalize("NFKD", value or "")
    return re.sub(r"[^a-z0-9 ]", " ", value.encode("ascii", "ignore").decode().lower())


def search(row, timeout):
    if ENTITY_RE.search(row["nome"]):
        return row, "ENTITY_REJECTED", None, "QSA é pessoa jurídica, não decisor humano"
    core = " ".join(tokens(row["razao_social"])[:3])
    query = f'"{row["nome"]}" "{core}" site:linkedin.com/in'
    url = "https://www.bing.com/search?format=rss&setlang=pt-br&q=" + urllib.parse.quote(query)
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            root = ET.fromstring(response.read())
        for item in root.findall(".//item"):
            link = item.findtext("link") or ""
            title = item.findtext("title") or ""
            snippet = item.findtext("description") or ""
            if not re.search(r"(?:[a-z]{2}\.)?linkedin\.com/in/", link, re.I):
                continue
            text = norm(" ".join((title, snippet, link)))
            nt = tokens(row["nome"])
            company_tokens = tokens(row["razao_social"])
            name_ok = len(nt) >= 2 and nt[0] in text and nt[-1] in text
            company_ok = any(t in text for t in company_tokens)
            if not (name_ok and company_ok):
                continue
            role = ROLE_RE.search(" ".join((title, snippet)))
            candidate = {
                "url": link.split("?")[0],
                "title": title,
                "snippet": snippet,
                "role": role.group(0) if role else None,
                "score": 90 if role else 85,
                "query": query,
            }
            return row, "MATCH_REVIEW", candidate, "Candidato estrito; requer revisão antes da promoção"
        return row, "NO_MATCH", {"query": query}, "Nenhum perfil pessoal com nome e empresa coincidentes"
    except Exception as exc:
        return row, "ERROR", {"query": query}, type(exc).__name__


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=10000)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--timeout", type=float, default=15)
    parser.add_argument("--batch-size", type=int, default=100)
    args = parser.parse_args()

    with connect(True) as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT q.cnpj,q.nome,q.qualificacao,p.razao_social
            FROM engenharia.pncp_company_officers q
            JOIN engenharia.pncp_company_profiles p ON p.cnpj=q.cnpj
            LEFT JOIN engenharia.pncp_linkedin_searches s
              ON s.cnpj=q.cnpj AND s.nome=q.nome
            WHERE s.cnpj IS NULL
            ORDER BY q.cnpj,q.nome
            LIMIT %s
            """,
            (args.limit,),
        )
        rows = cur.fetchall()

    sql = """
      INSERT INTO engenharia.pncp_linkedin_searches
        (cnpj,nome,empresa,consulta,status,linkedin_url,titulo_resultado,
         snippet,cargo_detectado,tipo_cargo,score,motivo,fonte,dados)
      VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,
        CASE WHEN %s IS NULL THEN NULL ELSE engenharia.mapear_tipo_cargo(%s) END,
        %s,%s,'BING_RSS_FREE',%s)
      ON CONFLICT(cnpj,nome) DO NOTHING
    """
    pending = []
    totals = {}
    started = time.monotonic()
    with connect(False) as conn, conn.cursor() as cur:
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
            for row, status, candidate, reason in pool.map(
                lambda r: search(r, args.timeout), rows
            ):
                candidate = candidate or {}
                role = candidate.get("role")
                pending.append(
                    (
                        row["cnpj"], row["nome"], row["razao_social"],
                        candidate.get("query") or f'{row["nome"]} {row["razao_social"]}',
                        status, candidate.get("url"), candidate.get("title"),
                        candidate.get("snippet"), role, role, role,
                        candidate.get("score"), reason,
                        Json({"qualificacao_qsa": row["qualificacao"]}),
                    )
                )
                totals[status] = totals.get(status, 0) + 1
                if len(pending) >= args.batch_size:
                    execute_batch(cur, sql, pending, page_size=args.batch_size)
                    conn.commit()
                    pending.clear()
            if pending:
                execute_batch(cur, sql, pending, page_size=args.batch_size)
                conn.commit()
    print(json.dumps({
        "processed": len(rows), "statuses": totals,
        "elapsed_seconds": round(time.monotonic() - started, 1),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
