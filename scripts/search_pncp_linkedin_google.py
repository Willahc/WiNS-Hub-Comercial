#!/usr/bin/env python3
"""Técnica Mari: Google person-centric -> LinkedIn, com match estrito."""

import argparse
import json
import os
import re
import time
import unicodedata
from urllib.request import Request, urlopen

import psycopg2
from psycopg2.extras import Json, RealDictCursor


ROLE_TERMS = [
    "diretor de suprimentos", "diretora de suprimentos", "gerente de suprimentos",
    "coordenador de suprimentos", "supervisor de suprimentos", "analista de suprimentos",
    "head de suprimentos", "supply chain director", "supply chain manager",
    "supply chain coordinator", "head of supply chain", "chief supply chain officer",
    "diretor de compras", "diretora de compras", "gerente de compras",
    "coordenador de compras", "supervisor de compras", "comprador sênior",
    "strategic buyer", "senior buyer", "purchasing manager", "purchasing director",
    "procurement director", "procurement manager", "procurement coordinator",
    "head of procurement", "chief procurement officer", "strategic sourcing manager",
    "sourcing manager", "category manager", "gerente de categoria",
    "diretor de engenharia", "gerente de engenharia", "coordenador de engenharia",
    "engineering director", "engineering manager", "head of engineering",
    "diretor de projetos", "gerente de projetos", "coordenador de projetos",
    "project director", "project manager", "project coordinator", "PMO manager",
    "diretor de obras", "gerente de obras", "coordenador de obras",
    "construction director", "construction manager", "site manager",
    "diretor de operações", "gerente de operações", "operations director",
    "operations manager", "COO", "diretor industrial", "gerente industrial",
    "plant manager", "industrial director", "diretor de manutenção",
    "gerente de manutenção", "coordenador de manutenção", "maintenance manager",
    "CAPEX director", "CAPEX manager", "gerente de CAPEX", "coordenador de CAPEX",
    "engenheiro civil", "engenheira civil", "engenheiro de projetos",
    "engenheira de projetos", "engenheiro de planejamento", "contract manager",
]
ROLE_RE = re.compile("|".join(re.escape(x) for x in sorted(ROLE_TERMS, key=len, reverse=True)), re.I)
STOP = {"ltda", "sa", "engenharia", "construcoes", "construcao", "servicos",
        "comercio", "industria", "infraestrutura", "eireli", "grupo"}


def norm(value):
    value = unicodedata.normalize("NFKD", value or "")
    return re.sub(r"[^a-z0-9 ]", " ", value.encode("ascii", "ignore").decode().lower())


def tokens(value):
    return [x for x in norm(value).split() if len(x) >= 4 and x not in STOP]


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
    )


def google(query, key, timeout):
    req = Request("https://google.serper.dev/search",
        data=json.dumps({"q": query, "gl": "br", "hl": "pt-br", "num": 10}).encode(),
        headers={"X-API-KEY": key, "Content-Type": "application/json"}, method="POST")
    with urlopen(req, timeout=timeout) as response:
        return json.loads(response.read())


def classify(name, company, result):
    url = result.get("link") or ""
    if not re.search(r"linkedin\.com/in/", url, re.I):
        return None
    text = " ".join([result.get("title") or "", result.get("snippet") or "", url])
    ntext = norm(text)
    nt = tokens(name)
    name_ok = len(nt) >= 2 and nt[0] in ntext and nt[-1] in ntext
    company_ok = any(t in ntext for t in tokens(company))
    role = ROLE_RE.search(text)
    if not name_ok or not company_ok:
        return None
    score = 70 + 10 * bool(role) + 10 * ("linkedin.com/in/" in url.lower())
    return {
        "url": url.split("?")[0], "title": result.get("title"),
        "snippet": result.get("snippet"), "role": role.group(0) if role else None,
        "score": score,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=100)
    ap.add_argument("--timeout", type=float, default=20)
    ap.add_argument("--delay", type=float, default=0.3)
    args = ap.parse_args()
    key = os.getenv("SERPER_API_KEY", "").strip()
    if not key:
        raise SystemExit("SERPER_API_KEY ausente")
    with connect(True) as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
          WITH ranked AS (
            SELECT q.cnpj,q.nome,q.qualificacao,p.razao_social,
                   max(o.valor_estimado) capex,max(t.data_resultado) data_resultado,
                   row_number() over(partition by q.cnpj order by
                     (upper(coalesce(q.qualificacao,'')) like '%%ADMINISTRADOR%%') desc,
                     q.data_entrada desc nulls last,q.nome) rn
            FROM engenharia.pncp_company_officers q
            JOIN engenharia.pncp_company_profiles p ON p.cnpj=q.cnpj
            JOIN engenharia.pncp_commercial_targets t ON t.fornecedor_cnpj=q.cnpj
            JOIN engenharia.obras o ON o.id=t.obra_id
            LEFT JOIN engenharia.pncp_linkedin_searches s
              ON s.cnpj=q.cnpj AND s.nome=q.nome
            WHERE s.cnpj IS NULL
            GROUP BY q.cnpj,q.nome,q.qualificacao,p.razao_social,q.data_entrada
          )
          SELECT * FROM ranked WHERE rn=1
          ORDER BY data_resultado DESC NULLS LAST,capex DESC NULLS LAST LIMIT %s
        """, (args.limit,))
        rows = cur.fetchall()
    totals = {"searched": 0, "matched": 0, "role_matched": 0, "errors": 0}
    with connect(False) as conn, conn.cursor() as cur:
        for row in rows:
            company = row["razao_social"]
            core = " ".join(tokens(company)[:2])
            query = f'\"{row["nome"]}\" \"{core}\" site:linkedin.com/in'
            candidate = None
            error = None
            try:
                data = google(query, key, args.timeout)
                for result in data.get("organic") or []:
                    candidate = classify(row["nome"], company, result)
                    if candidate:
                        break
            except Exception as exc:
                error = type(exc).__name__
            status = "MATCH" if candidate else ("ERROR" if error else "NO_MATCH")
            cur.execute("""
              INSERT INTO engenharia.pncp_linkedin_searches
                (cnpj,nome,empresa,consulta,status,linkedin_url,titulo_resultado,
                 snippet,cargo_detectado,tipo_cargo,score,motivo,dados)
              VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,
                CASE WHEN %s IS NULL THEN NULL ELSE engenharia.mapear_tipo_cargo(%s) END,
                %s,%s,%s)
              ON CONFLICT(cnpj,nome) DO UPDATE SET
                consulta=EXCLUDED.consulta,status=EXCLUDED.status,
                linkedin_url=EXCLUDED.linkedin_url,titulo_resultado=EXCLUDED.titulo_resultado,
                snippet=EXCLUDED.snippet,cargo_detectado=EXCLUDED.cargo_detectado,
                tipo_cargo=EXCLUDED.tipo_cargo,score=EXCLUDED.score,
                motivo=EXCLUDED.motivo,consultado_em=now(),dados=EXCLUDED.dados
            """, (
                row["cnpj"],row["nome"],company,query,status,
                candidate and candidate["url"],candidate and candidate["title"],
                candidate and candidate["snippet"],candidate and candidate["role"],
                candidate and candidate["role"],candidate and candidate["role"],
                candidate and candidate["score"],error,
                Json({"qualificacao_qsa": row["qualificacao"], "capex": str(row["capex"] or "")}),
            ))
            totals["searched"] += 1
            totals["matched"] += int(bool(candidate))
            totals["role_matched"] += int(bool(candidate and candidate["role"]))
            totals["errors"] += int(bool(error))
            conn.commit()
            time.sleep(args.delay)
    print(json.dumps(totals, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
