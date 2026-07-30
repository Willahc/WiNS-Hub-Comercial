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
                   d.linkedin_url,d.status_vinculo_obra,d.classificacao_compatibilidade,
                   d.confianca_match match_score,d.tipo_evidencia,
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
                     dx.linkedin_url,
                     dx.status_vinculo_obra,
                     dx.classificacao_compatibilidade,
                     dx.confianca_match,
                     dx.tipo_evidencia
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


SPA_DIR = "/app/spa" if os.path.exists("/app/spa") else "/opt/winshub/spa"

@app.route("/assets/<path:path>")
def serve_assets(path):
    from flask import send_from_directory
    assets_dir = os.path.join(SPA_DIR, "assets")
    if os.path.exists(os.path.join(assets_dir, path)):
        return send_from_directory(assets_dir, path)
    return jsonify({"error": "asset not found"}), 404

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_spa(path):
    if path.startswith("api/") or path == "healthz":
        return jsonify({"error": "endpoint not found"}), 404

    from flask import send_from_directory
    target_file = os.path.join(SPA_DIR, path)
    if path and os.path.exists(target_file) and os.path.isfile(target_file):
        return send_from_directory(SPA_DIR, path)

    index_path = os.path.join(SPA_DIR, "index.html")
    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            content = f.read()
        clean_script = """<script>
(function cleanUrl(){
 if(typeof window==='undefined'||!window.history||!window.history.replaceState)return;
 try{
  const u=new URL(window.location.href);
  let mod=false;
  ['code','state','session_state','iss'].forEach(p=>{if(u.searchParams.has(p)){u.searchParams.delete(p);mod=true;}});
  if(u.hash){
   let h=u.hash.substring(1);
   ['code','state','session_state','iss'].forEach(p=>{
    if(h.includes(p+'=')){const sp=new URLSearchParams(h);sp.delete(p);h=sp.toString();mod=true;}
   });
   u.hash=h?'#'+h:'';
  }
  if(mod){
   const cl=u.pathname+(u.searchParams.toString()?'?'+u.searchParams.toString():'')+u.hash;
   window.history.replaceState(null,document.title,cl);
  }
 }catch(e){}
})();
</script>"""
        if "<head>" in content:
            content = content.replace("<head>", f"<head>{clean_script}")
        return Response(content, mimetype="text/html; charset=utf-8")

    return jsonify({"error": "SPA bundle not found"}), 404


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", 8000)))
