import psycopg2

DB_HOST = "127.0.0.1"
DB_PORT = "5432"

def query(dbname, sql, user="wins_hub_api_ro", password="hcsVNWBPGmcXItoxHzh_s3d18IwbUwIJpcvy6HMSMTM"):
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

print("=== 1. CNPJS POR CONTROLES MULTIVERTICAIS ===")
# Create a CTE of all distinct CNPJs in each domain
sql_multi = """
WITH
eng AS (SELECT DISTINCT cnpj FROM engenharia.obras WHERE cnpj IS NOT NULL AND cnpj != ''),
agr AS (SELECT DISTINCT cnpj FROM prospeccao.imovel_rural WHERE cnpj IS NOT NULL AND cnpj != ''),
log AS (SELECT DISTINCT cpfcnpjtransportador AS cnpj FROM caminhao_vazio_staging.public.rntrc_transportadores WHERE cpfcnpjtransportador IS NOT NULL AND length(cpfcnpjtransportador) > 11),
sau AS (SELECT DISTINCT cnpj_entidade AS cnpj FROM wins_saude_staging.public.estabelecimentos WHERE cnpj_entidade IS NOT NULL AND cnpj_entidade != ''),
all_cnpjs AS (
  SELECT cnpj, 1 as is_eng, 0 as is_agr, 0 as is_log, 0 as is_sau FROM eng
  UNION ALL
  SELECT cnpj, 0 as is_eng, 1 as is_agr, 0 as is_log, 0 as is_sau FROM agr
  UNION ALL
  SELECT cnpj, 0 as is_eng, 0 as is_agr, 1 as is_log, 0 as is_sau FROM log
  UNION ALL
  SELECT cnpj, 0 as is_eng, 0 as is_agr, 0 as is_log, 1 as is_sau FROM sau
),
summed AS (
  SELECT cnpj,
         max(is_eng) as eng,
         max(is_agr) as agr,
         max(is_log) as log,
         max(is_sau) as sau,
         (max(is_eng) + max(is_agr) + max(is_log) + max(is_sau)) as num_verticals
  FROM all_cnpjs
  GROUP BY cnpj
)
SELECT num_verticals, count(*)
FROM summed
GROUP BY num_verticals
ORDER BY num_verticals;
"""
print("Distribuição de CNPJs por número de verticais:", query("wins_agro", sql_multi))

print("\n=== 2. CONCEITO DE 687.087 OPORTUNIDADES ===")
# Check matches_v2 linked to obras visíveis (16.633 obras) WITHOUT score >= 70 filter
sql_687 = """
SELECT count(*) FROM engenharia.matches_v2 m
INNER JOIN engenharia.obras o ON (m.obra_id = o.id::text OR m.obra_id = o.id_externo)
WHERE o.visivel = true;
"""
print("Matches brutos vinculados às obras visíveis (sem filtro score >= 70):", query("wins_agro", sql_687))

print("\n=== 3. DISCRIMINAÇÃO DAS 3.576 RELAÇÕES CONFIRMADAS ===")
sql_rel = """
SELECT 'obra ↔ empresa' as tipo, count(DISTINCT (id, cnpj)) as total FROM engenharia.obras WHERE cnpj IS NOT NULL AND cnpj != ''
UNION ALL
SELECT 'CNES ↔ mantenedora' as tipo, count(DISTINCT (cnes, cnpj_entidade)) as total FROM wins_saude_staging.public.estabelecimentos WHERE cnpj_entidade IS NOT NULL AND cnpj_entidade != ''
UNION ALL
SELECT 'obra ↔ oportunidade (score >= 90)' as tipo, count(DISTINCT (obra_id, cnpj)) as total FROM engenharia.matches_v2 WHERE score >= 90;
"""
print("Decomposição das relações confirmadas:", query("wins_agro", sql_rel))
