import psycopg2

DB_HOST = "127.0.0.1"
DB_PORT = "5432"

def query_one(dbname, sql, user="wins_hub_api_ro", password="hcsVNWBPGmcXItoxHzh_s3d18IwbUwIJpcvy6HMSMTM"):
    try:
        conn = psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname=dbname, user=user, password=password)
        cur = conn.cursor()
        cur.execute(sql)
        res = cur.fetchone()
        cur.close()
        conn.close()
        return res[0] if res else 0
    except Exception as e:
        return str(e)

print("--- EMPRESAS ---")
print("core.empresa total:", query_one("wins_agro", "SELECT count(*) FROM core.empresa;"))
print("core.empresa ativas (situacao_cadastral = '02'):", query_one("wins_agro", "SELECT count(*) FROM core.empresa WHERE situacao_cadastral = '02';"))
print("core.empresa ativas (situacao_cadastral = '2'):", query_one("wins_agro", "SELECT count(*) FROM core.empresa WHERE situacao_cadastral = '2';"))

print("\n--- IMÓVEIS RURAIS ---")
print("prospeccao.imovel_rural total:", query_one("wins_agro", "SELECT count(*) FROM prospeccao.imovel_rural;"))
print("prospeccao.imovel_rural com lat/lon:", query_one("wins_agro", "SELECT count(*) FROM prospeccao.imovel_rural WHERE latitude IS NOT NULL AND longitude IS NOT NULL;"))

print("\n--- TRANSPORTADORES ---")
print("public.rntrc_transportadores total:", query_one("caminhao_vazio_staging", "SELECT count(*) FROM public.rntrc_transportadores;", user="wins_hub_logistica_ro", password="log_ro_20260722_xK9m"))
print("public.rntrc_transportadores situacao = 'ATIVO':", query_one("caminhao_vazio_staging", "SELECT count(*) FROM public.rntrc_transportadores WHERE situacao = 'ATIVO';", user="wins_hub_logistica_ro", password="log_ro_20260722_xK9m"))

print("\n--- ESTABELECIMENTOS DE SAÚDE ---")
print("wins_saude_staging public.estabelecimentos total:", query_one("wins_saude_staging", "SELECT count(*) FROM public.estabelecimentos;", user="wins_hub_saude_ro", password="saude_ro_20260722_xK9m"))

print("\n--- REPRODUTORES ---")
print("mercado.reprodutor total:", query_one("wins_agro", "SELECT count(*) FROM mercado.reprodutor;"))

print("\n--- OPORTUNIDADES & OBRAS ---")
print("engenharia.obras total:", query_one("wins_agro", "SELECT count(*) FROM engenharia.obras;"))
print("matches_v2 vinculadas a obras visíveis (16.633):", query_one("wins_agro", "SELECT count(*) FROM engenharia.matches_v2 m INNER JOIN engenharia.obras o ON m.obra_id = o.source_id;"))
print("matches_v2 vinculadas a obras ativas:", query_one("wins_agro", "SELECT count(*) FROM engenharia.matches_v2 m INNER JOIN engenharia.obras o ON m.obra_id = o.source_id WHERE o.status ILIKE '%andamento%' OR o.status ILIKE '%execu%' OR o.status ILIKE '%planejamento%';"))
print("matches_v2 vinculadas a obras com CNPJ:", query_one("wins_agro", "SELECT count(*) FROM engenharia.matches_v2 m INNER JOIN engenharia.obras o ON m.obra_id = o.source_id WHERE o.cnpj IS NOT NULL AND o.cnpj != '';"))
print("matches_v2 vinculadas a obras com CAPEX:", query_one("wins_agro", "SELECT count(*) FROM engenharia.matches_v2 m INNER JOIN engenharia.obras o ON m.obra_id = o.source_id WHERE o.valor_investimento > 0;"))
