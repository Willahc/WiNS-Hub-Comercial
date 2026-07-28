"""WiNS Hub Engenharia — dashboard read-only com contatos mascarados."""

import os
from decimal import Decimal

from flask import Flask, Response, jsonify, request


APP_PREFIX = (os.environ.get("APPLICATION_ROOT") or "").rstrip("/")
DSN = os.environ["DATABASE_URL"]
app = Flask(__name__)
app.config["APPLICATION_ROOT"] = APP_PREFIX or "/"


def pref(path: str) -> str:
    return f"{APP_PREFIX}{path}" if APP_PREFIX and path.startswith("/") else path


def db():
    import psycopg2
    from psycopg2.extras import RealDictCursor

    return psycopg2.connect(DSN, cursor_factory=RealDictCursor)


def mask_email(value):
    if not value or "@" not in value:
        return None
    local, domain = value.split("@", 1)
    return f"{local[:2]}{'*' * max(3, len(local) - 2)}@{domain}"


def mask_phone(value):
    digits = "".join(c for c in (value or "") if c.isdigit())
    return f"{'*' * max(6, len(digits) - 4)}{digits[-4:]}" if digits else None


def json_ready(rows):
    result = []
    for row in rows:
        item = dict(row)
        for key, value in item.items():
            if isinstance(value, Decimal):
                item[key] = float(value)
        if "email" in item:
            item["email"] = mask_email(item["email"])
        if "telefone" in item:
            item["telefone"] = mask_phone(item["telefone"])
        result.append(item)
    return result


@app.route("/healthz")
def healthz():
    try:
        with db() as connection, connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return jsonify({"status": "ok", "vertical": "engenharia"}), 200
    except Exception as exc:
        return jsonify({"status": "error", "detail": str(exc)[:200]}), 503


@app.route("/api/stats")
def api_stats():
    with db() as connection, connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
              (SELECT count(*) FROM obras) obras,
              (SELECT count(*) FROM decisores_obra
                WHERE excluido_em IS NULL) decisores,
              (SELECT count(*) FROM decisores_obra
                WHERE excluido_em IS NULL AND NULLIF(email,'') IS NOT NULL
                  AND COALESCE(email_status,'') NOT LIKE 'REMOVIDO%%') decisores_email,
              (SELECT count(*) FROM decisores_obra
                WHERE excluido_em IS NULL AND NULLIF(telefone,'') IS NOT NULL
                  AND COALESCE(telefone_fonte,'') NOT LIKE 'REMOVIDO%%') decisores_telefone,
              (SELECT count(*) FROM obras
                WHERE classificacao_computed='OURO') ouro,
              (SELECT count(*) FROM obras
                WHERE classificacao_computed='PRATA') prata,
              (SELECT count(*) FROM empresa_dominios
                WHERE NULLIF(dominio,'') IS NOT NULL) dominios
            """
        )
        return jsonify(dict(cursor.fetchone()))


@app.route("/api/ufs")
def api_ufs():
    with db() as connection, connection.cursor() as cursor:
        cursor.execute(
            "SELECT DISTINCT uf FROM obras "
            "WHERE uf IS NOT NULL AND btrim(uf)<>'' ORDER BY 1"
        )
        return jsonify([row["uf"] for row in cursor.fetchall()])


@app.route("/api/obras")
def api_obras():
    limit = min(max(int(request.args.get("limit", 50) or 50), 1), 200)
    offset = max(int(request.args.get("offset", 0) or 0), 0)
    params = {
        "uf": request.args.get("uf", "").upper(),
        "nivel": request.args.get("nivel", "").upper(),
        "q": f"%{request.args.get('q', '').strip()}%",
        "q_raw": request.args.get("q", "").strip(),
        "min_value": float(request.args.get("min_value", 0) or 0),
        "limit": limit,
        "offset": offset,
    }
    with db() as connection, connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT o.id,o.nome,o.empresa,o.uf,o.municipio,o.fase,
                   o.valor_estimado,o.classificacao_computed nivel,
                   COALESCE(NULLIF(regexp_replace(o.cnpj_executora,'\\D','','g'),''),
                            NULLIF(regexp_replace(o.cnpj,'\\D','','g'),'')) cnpj,
                   d.nome decisor,d.cargo,d.tipo_cargo,d.email,d.telefone,
                   d.linkedin_url,
                   NULLIF(d.email,'') IS NOT NULL tem_email,
                   NULLIF(d.telefone,'') IS NOT NULL tem_telefone,
                   NULLIF(d.linkedin_url,'') IS NOT NULL tem_linkedin,
                   count(*) OVER() total
            FROM obras o
            LEFT JOIN LATERAL (
              SELECT dx.nome,dx.cargo,dx.tipo_cargo,
                     CASE WHEN COALESCE(dx.email_status,'') NOT LIKE 'REMOVIDO%%'
                          THEN dx.email END email,
                     CASE WHEN COALESCE(dx.telefone_fonte,'') NOT LIKE 'REMOVIDO%%'
                          THEN dx.telefone END telefone,
                     dx.linkedin_url
              FROM decisores_obra dx
              WHERE dx.obra_id=o.id AND dx.excluido_em IS NULL
                AND COALESCE(dx.hipotese_replicacao,'')
                    <> 'REPLICADO_PROVAVEL_FALSO_POSITIVO'
              ORDER BY
                (NULLIF(dx.email,'') IS NOT NULL)::int
                +(NULLIF(dx.telefone,'') IS NOT NULL)::int
                +(NULLIF(dx.linkedin_url,'') IS NOT NULL)::int DESC,
                dx.confianca_match DESC NULLS LAST
              LIMIT 1
            ) d ON true
            WHERE (%(uf)s='' OR o.uf=%(uf)s)
              AND (%(nivel)s='' OR o.classificacao_computed=%(nivel)s)
              AND o.valor_estimado >= %(min_value)s
              AND (%(q_raw)s='' OR o.nome ILIKE %(q)s OR o.empresa ILIKE %(q)s
                   OR d.nome ILIKE %(q)s)
            ORDER BY
              CASE o.classificacao_computed
                WHEN 'OURO' THEN 4 WHEN 'PRATA' THEN 3
                WHEN 'BRONZE' THEN 2 WHEN 'PIPELINE' THEN 1 ELSE 0 END DESC,
              o.valor_estimado DESC NULLS LAST
            LIMIT %(limit)s OFFSET %(offset)s
            """,
            params,
        )
        return jsonify(json_ready(cursor.fetchall()))


@app.route("/")
def home():
    return Response(
        f"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>WiNS Hub Engenharia</title>
<style>
:root{{--bg:#08111f;--card:#111d31;--txt:#eaf1fb;--mut:#91a4bf;--acc:#55a5ff;--bd:#263651}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--txt);font:14px/1.45 system-ui}}
.wrap{{max-width:1400px;margin:auto;padding:24px}}h1{{margin:0}}.sub,.mut{{color:var(--mut)}}
.kpis{{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:18px 0}}
.card{{background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:14px}}
.v{{font-size:22px;font-weight:750}}.filters{{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}}
input,select,button{{background:#0d1728;color:var(--txt);border:1px solid var(--bd);border-radius:8px;padding:9px}}
button{{cursor:pointer;background:#174d82}}table{{width:100%;border-collapse:collapse}}
th,td{{padding:9px;border-bottom:1px solid var(--bd);text-align:left;vertical-align:top}}
th{{color:var(--mut);font-size:12px;position:sticky;top:0;background:var(--card)}}.scroll{{overflow:auto;max-height:68vh}}
.badge{{padding:2px 7px;border-radius:10px;background:#17304f;font-size:11px}}a{{color:var(--acc)}}
</style></head><body><main class="wrap">
<div class="mut">WiNS Hub · ENGENHARIA</div><h1>Obras e inteligência comercial</h1>
<p class="sub">Contatos profissionais mascarados na interface pública. Dados completos permanecem protegidos no banco.</p>
<section class="kpis" id="kpis"></section>
<section class="filters">
<input id="q" placeholder="Obra, empresa ou decisor">
<select id="uf"><option value="">Todos os estados</option></select>
<select id="nivel"><option value="">Todos os níveis</option><option>OURO</option><option>PRATA</option><option>BRONZE</option><option>PIPELINE</option></select>
<input id="minv" type="number" min="0" placeholder="Valor mínimo">
<button onclick="load()">Buscar</button></section>
<div class="card scroll"><table><thead><tr><th>Nível</th><th>Obra</th><th>Empresa</th><th>Local</th><th>Valor</th><th>Decisor</th><th>Contatos</th></tr></thead><tbody id="rows"></tbody></table></div>
</main><script>
const P='{APP_PREFIX}';
const money=v=>v==null?'—':new Intl.NumberFormat('pt-BR',{{style:'currency',currency:'BRL',maximumFractionDigits:0}}).format(v);
const esc=s=>String(s??'—').replace(/[&<>"']/g,c=>({{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}}[c]));
async function init(){{
 const [s,u]=await Promise.all([fetch(P+'/api/stats').then(r=>r.json()),fetch(P+'/api/ufs').then(r=>r.json())]);
 const labels=[['Obras',s.obras],['Ouro',s.ouro],['Prata',s.prata],['Decisores',s.decisores],['Com e-mail',s.decisores_email],['Com telefone',s.decisores_telefone],['Domínios',s.dominios]];
 document.getElementById('kpis').innerHTML=labels.map(x=>`<div class="card"><div class="v">${{Number(x[1]).toLocaleString('pt-BR')}}</div><div class="mut">${{x[0]}}</div></div>`).join('');
 document.getElementById('uf').innerHTML+=u.map(x=>`<option>${{esc(x)}}</option>`).join('');load();
}}
async function load(){{
 const p=new URLSearchParams({{q:q.value,uf:uf.value,nivel:nivel.value,min_value:minv.value||0,limit:100}});
 const data=await fetch(P+'/api/obras?'+p).then(r=>r.json());
 rows.innerHTML=data.map(r=>`<tr><td><span class="badge">${{esc(r.nivel)}}</span></td><td>${{esc(r.nome)}}<div class="mut">${{esc(r.fase)}}</div></td><td>${{esc(r.empresa)}}<div class="mut">${{esc(r.cnpj)}}</div></td><td>${{esc(r.municipio)}}/${{esc(r.uf)}}</td><td>${{money(r.valor_estimado)}}</td><td>${{esc(r.decisor)}}<div class="mut">${{esc(r.cargo)}}</div></td><td>${{r.email?esc(r.email):'—'}}<br>${{r.telefone?esc(r.telefone):''}} ${{r.linkedin_url?`<a href="${{esc(r.linkedin_url)}}" rel="noopener noreferrer" target="_blank">LinkedIn</a>`:''}}</td></tr>`).join('');
}}
init();
</script></body></html>""",
        mimetype="text/html; charset=utf-8",
    )


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", 8000)))
