import psycopg2

DB_HOST = "127.0.0.1"
DB_PORT = "5432"

def query_val(dbname, sql, user="wins_hub_api_ro", password="hcsVNWBPGmcXItoxHzh_s3d18IwbUwIJpcvy6HMSMTM"):
    try:
        conn = psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname=dbname, user=user, password=password)
        cur = conn.cursor()
        cur.execute(sql)
        res = cur.fetchall()
        cur.close()
        conn.close()
        return res
    except Exception as e:
        return str(e)

print("=== 1. EMPRESAS (core.empresa) ===")
print("core.empresa por situacao:", query_val("wins_agro", "SELECT situacao, count(*) FROM core.empresa GROUP BY situacao;"))
print("core.empresa vivo = true:", query_val("wins_agro", "SELECT count(*) FROM core.empresa WHERE vivo = true;"))

print("\n=== 2. TRANSPORTADORES (rntrc_transportadores) ===")
print("situacao_rntrc breakdown:", query_val("caminhao_vazio_staging", "SELECT situacao_rntrc, count(*) FROM public.rntrc_transportadores GROUP BY situacao_rntrc;", user="wins_hub_logistica_ro", password="log_ro_20260722_xK9m"))

print("\n=== 3. OPORTUNIDADES COM OBRAS ===")
print("matches_v2 vinculados com engenharia.obras via o.id = m.obra_id::integer or id_externo:", query_val("wins_agro", """
    SELECT count(*) FROM engenharia.matches_v2 m
    INNER JOIN engenharia.obras o ON (m.obra_id = o.id::text OR m.obra_id = o.id_externo);
"""))

print("matches_v2 score >= 70 vinculados com engenharia.obras visíveis:", query_val("wins_agro", """
    SELECT count(*) FROM engenharia.matches_v2 m
    INNER JOIN engenharia.obras o ON (m.obra_id = o.id::text OR m.obra_id = o.id_externo)
    WHERE m.score >= 70 AND o.visivel = true;
"""))

print("\n=== 4. EMPRESAS MULTIVERTICAIS ===")
print("Empresas com presença nas verticais:", query_val("wins_agro", """
    WITH eng AS (SELECT DISTINCT cnpj FROM engenharia.obras WHERE cnpj IS NOT NULL AND cnpj != ''),
         agr AS (SELECT DISTINCT cnpj FROM prospeccao.imovel_rural WHERE cnpj IS NOT NULL AND cnpj != ''),
         log AS (SELECT DISTINCT cnpj FROM caminhao_vazio_staging.public.rntrc_transportadores WHERE cnpj IS NOT NULL AND cnpj != ''),
         sau AS (SELECT DISTINCT cnpj FROM wins_saude_staging.public.estabelecimentos WHERE cnpj IS NOT NULL AND cnpj != '')
    SELECT
      (SELECT count(*) FROM core.empresa) as core_empresa_total,
      (SELECT count(DISTINCT cnpj) FROM (SELECT cnpj FROM eng UNION SELECT cnpj FROM agr UNION SELECT cnpj FROM log UNION SELECT cnpj FROM sau) u) as em_alguma_vertical,
      (SELECT count(DISTINCT cnpj) FROM (SELECT cnpj FROM eng INTERSECT SELECT cnpj FROM agr INTERSECT SELECT cnpj FROM log INTERSECT SELECT cnpj FROM sau) u4) as em_4_verticais;
"""))
