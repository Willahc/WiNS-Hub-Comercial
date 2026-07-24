import psycopg2
import json

DB_HOST = "127.0.0.1"
DB_PORT = "5432"

def query_db(dbname, sql, user="wins_hub_api_ro", password="hcsVNWBPGmcXItoxHzh_s3d18IwbUwIJpcvy6HMSMTM"):
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

def run():
    report = {}

    # 1. EMPRESAS
    print("--- 1. EMPRESAS (core.empresa in wins_agro) ---")
    emp_total = query_db("wins_agro", "SELECT count(*) FROM core.empresa;")[0][0]
    emp_distinct_cnpj = query_db("wins_agro", "SELECT count(DISTINCT cnpj) FROM core.empresa;")[0][0]
    emp_ativas = query_db("wins_agro", "SELECT count(*) FROM core.empresa WHERE situacao_cadastral = '02' OR situacao_cadastral = '2' OR situacao_cadastral IS NULL;")[0][0]
    print(f"Empresas core.empresa: total={emp_total}, distinct_cnpj={emp_distinct_cnpj}, ativas={emp_ativas}")

    # Check public.estabelecimentos if present in wins_saude_staging or anywhere else
    emp_saude = query_db("wins_saude_staging", "SELECT count(*), count(DISTINCT cnpj) FROM public.estabelecimentos;", user="wins_hub_saude_ro", password="saude_ro_20260722_xK9m")[0]
    print(f"Estabelecimentos em wins_saude_staging: {emp_saude}")

    # 2. IMÓVEIS RURAIS
    print("\n--- 2. IMÓVEIS RURAIS (prospeccao.imovel_rural in wins_agro) ---")
    imoveis_total = query_db("wins_agro", "SELECT count(*) FROM prospeccao.imovel_rural;")[0][0]
    imoveis_distinct_cod = query_db("wins_agro", "SELECT count(DISTINCT cod_imovel) FROM prospeccao.imovel_rural;")[0][0]
    imoveis_geo = query_db("wins_agro", "SELECT count(*) FROM prospeccao.imovel_rural WHERE lat IS NOT NULL AND lon IS NOT NULL AND lat != 0;")[0][0]
    print(f"Imóveis CAR: total_fisico={imoveis_total}, distinct_cod={imoveis_distinct_cod}, georreferenciados_utilizaveis={imoveis_geo}")

    # 3. TRANSPORTADORES
    print("\n--- 3. TRANSPORTADORES (public.rntrc_transportadores in caminhao_vazio_staging) ---")
    transp_total = query_db("caminhao_vazio_staging", "SELECT count(*) FROM public.rntrc_transportadores;", user="wins_hub_logistica_ro", password="log_ro_20260722_xK9m")[0][0]
    transp_distinct_rntrc = query_db("caminhao_vazio_staging", "SELECT count(DISTINCT rntrc) FROM public.rntrc_transportadores;", user="wins_hub_logistica_ro", password="log_ro_20260722_xK9m")[0][0]
    transp_ativos = query_db("caminhao_vazio_staging", "SELECT count(*) FROM public.rntrc_transportadores WHERE situacao = 'ATIVO' OR situacao = 'Ativo';", user="wins_hub_logistica_ro", password="log_ro_20260722_xK9m")[0][0]
    print(f"Transportadores RNTRC: total_fisico={transp_total}, distinct_rntrc={transp_distinct_rntrc}, ativos={transp_ativos}")

    # 4. ESTABELECIMENTOS DE SAÚDE
    print("\n--- 4. ESTABELECIMENTOS DE SAÚDE (public.estabelecimentos in wins_saude_staging) ---")
    saude_total = query_db("wins_saude_staging", "SELECT count(*) FROM public.estabelecimentos;", user="wins_hub_saude_ro", password="saude_ro_20260722_xK9m")[0][0]
    saude_distinct_cnes = query_db("wins_saude_staging", "SELECT count(DISTINCT cnes) FROM public.estabelecimentos;", user="wins_hub_saude_ro", password="saude_ro_20260722_xK9m")[0][0]
    saude_ativos = query_db("wins_saude_staging", "SELECT count(*) FROM public.estabelecimentos WHERE status = 'ATIVO' OR status = 'Ativo' OR status = '1';", user="wins_hub_saude_ro", password="saude_ro_20260722_xK9m")[0][0]
    print(f"Estabelecimentos CNES: total_fisico={saude_total}, distinct_cnes={saude_distinct_cnes}, ativos={saude_ativos}")

    # 5. REPRODUTORES AGRO
    print("\n--- 5. REPRODUTORES AGRO (mercado.reprodutor in wins_agro) ---")
    reprod_total = query_db("wins_agro", "SELECT count(*) FROM mercado.reprodutor;")[0][0]
    reprod_distinct_rgd = query_db("wins_agro", "SELECT count(DISTINCT rgd) FROM mercado.reprodutor WHERE rgd IS NOT NULL AND rgd != '';")[0][0]
    reprod_com_avaliacao = query_db("wins_agro", "SELECT count(*) FROM mercado.reprodutor WHERE avaliacao IS NOT NULL OR rgd IS NOT NULL;")[0][0]
    print(f"Reprodutores: total_catalogo={reprod_total}, distinct_rgd={reprod_distinct_rgd}, com_avaliacao_genetica={reprod_com_avaliacao}")

    # 6. OPORTUNIDADES (engenharia.matches_v2 em wins_agro)
    print("\n--- 6. OPORTUNIDADES (engenharia.matches_v2 in wins_agro) ---")
    matches_brutos = query_db("wins_agro", "SELECT count(*) FROM engenharia.matches_v2;")[0][0]
    matches_pares_unicos = query_db("wins_agro", "SELECT count(DISTINCT (obra_id, cnpj)) FROM engenharia.matches_v2;")[0][0]
    matches_score_70 = query_db("wins_agro", "SELECT count(*) FROM engenharia.matches_v2 WHERE score >= 70;")[0][0]
    matches_score_90 = query_db("wins_agro", "SELECT count(*) FROM engenharia.matches_v2 WHERE score >= 90;")[0][0]

    matches_obras_visiveis = query_db("wins_agro", """
        SELECT count(*) FROM engenharia.matches_v2 m
        INNER JOIN engenharia.obras o ON m.obra_id = o.source_id;
    """)[0][0]

    matches_obras_ativas = query_db("wins_agro", """
        SELECT count(*) FROM engenharia.matches_v2 m
        INNER JOIN engenharia.obras o ON m.obra_id = o.source_id
        WHERE o.status = 'Em Andamento' OR o.status = 'Em andamento' OR o.status = 'Em Execução' OR o.status = 'Em planejamento';
    """)[0][0]

    matches_obras_cnpj = query_db("wins_agro", """
        SELECT count(*) FROM engenharia.matches_v2 m
        INNER JOIN engenharia.obras o ON m.obra_id = o.source_id
        WHERE o.cnpj IS NOT NULL AND o.cnpj != '';
    """)[0][0]

    matches_obras_capex = query_db("wins_agro", """
        SELECT count(*) FROM engenharia.matches_v2 m
        INNER JOIN engenharia.obras o ON m.obra_id = o.source_id
        WHERE o.valor_investimento > 0;
    """)[0][0]

    print(f"Matches brutos: {matches_brutos}")
    print(f"Pares únicos (obra_id, cnpj): {matches_pares_unicos}")
    print(f"Score >= 70: {matches_score_70}")
    print(f"Score >= 90: {matches_score_90}")
    print(f"Vinculadas às obras visíveis: {matches_obras_visiveis}")
    print(f"Vinculadas a obras ativas: {matches_obras_ativas}")
    print(f"Vinculadas a obras com CNPJ: {matches_obras_cnpj}")
    print(f"Vinculadas a obras com CAPEX: {matches_obras_capex}")

    # 7. EMPRESAS REALMENTE MULTIVERTICAIS
    print("\n--- 7. EMPRESAS MULTIVERTICAIS ---")
    multi = query_db("wins_agro", """
        WITH eng AS (SELECT DISTINCT cnpj FROM engenharia.obras WHERE cnpj IS NOT NULL AND cnpj != ''),
             agr AS (SELECT DISTINCT cnpj_proprietario AS cnpj FROM prospeccao.imovel_rural WHERE cnpj_proprietario IS NOT NULL AND cnpj_proprietario != ''),
             log AS (SELECT DISTINCT cnpj FROM caminhao_vazio_staging.public.rntrc_transportadores WHERE cnpj IS NOT NULL AND cnpj != ''),
             sau AS (SELECT DISTINCT cnpj_mantenedor AS cnpj FROM wins_saude_staging.public.estabelecimentos WHERE cnpj_mantenedor IS NOT NULL AND cnpj_mantenedor != '')
        SELECT
          (SELECT count(*) FROM core.empresa) as ativas_totais,
          (SELECT count(DISTINCT cnpj) FROM eng) as em_engenharia,
          (SELECT count(DISTINCT cnpj) FROM agr) as em_agro,
          (SELECT count(DISTINCT cnpj) FROM log) as em_logistica,
          (SELECT count(DISTINCT cnpj) FROM sau) as em_saude;
    """)
    print("Contagem por vertical individual:", multi)

    # 8. MUNICÍPIOS 4-VERTICAIS
    print("\n--- 8. MUNICÍPIOS DO RECORTE E UNIVERSO ---")
    mun = query_db("wins_agro", """
        SELECT count(*) FROM referencia.municipio;
    """)[0][0]
    print(f"Total de municípios no Brasil (universo): {mun}")

if __name__ == "__main__":
    run()
