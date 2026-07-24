import psycopg2
import json

DB_HOST = "127.0.0.1"
DB_PORT = "5432"
DB_USER = "wins_hub_api_ro"
DB_PASS = "hcsVNWBPGmcXItoxHzh_s3d18IwbUwIJpcvy6HMSMTM"

def query_db(dbname, sql, user=DB_USER, password=DB_PASS):
    try:
        conn = psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname=dbname, user=user, password=password)
        cur = conn.cursor()
        cur.execute(sql)
        res = cur.fetchall()
        col_names = [desc[0] for desc in cur.description] if cur.description else []
        cur.close()
        conn.close()
        return col_names, res
    except Exception as e:
        return [], str(e)

def run_audit():
    print("=== 1. AUDITORIA DE EMPRESAS (wins_agro) ===")
    # Check public.estabelecimentos vs core.empresa vs wins_agro.core.empresa
    cols, res = query_db("wins_agro", "SELECT count(*) FROM public.estabelecimentos;")
    print("public.estabelecimentos count(*):", res)

    cols, res = query_db("wins_agro", "SELECT count(DISTINCT cnpj) FROM public.estabelecimentos;")
    print("public.estabelecimentos distinct cnpj:", res)

    cols, res = query_db("wins_agro", "SELECT count(*) FROM public.estabelecimentos WHERE situacao_cadastral = '02' OR situacao_cadastral = '2' OR situacao_cadastral IS NULL;")
    print("public.estabelecimentos ativas (situacao 02):", res)

    # Check if core.empresa or core.empresas exists in wins_agro
    cols, res = query_db("wins_agro", "SELECT table_schema, table_name FROM information_schema.tables WHERE table_name LIKE '%empresa%';")
    print("Tables matching 'empresa':", res)

    print("\n=== 2. AUDITORIA DE IMÓVEIS RURAIS (wins_agro) ===")
    cols, res = query_db("wins_agro", "SELECT table_schema, table_name FROM information_schema.tables WHERE table_name LIKE '%imoveis%' OR table_name LIKE '%car%';")
    print("Imóveis tables:", res)

    cols, res = query_db("wins_agro", "SELECT count(*) FROM public.imoveis_rurais_car;")
    print("public.imoveis_rurais_car count(*):", res)

    cols, res = query_db("wins_agro", "SELECT count(*) FROM public.imoveis_rurais_car WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND latitude != 0;")
    print("public.imoveis_rurais_car georreferenciados utilizáveis:", res)

    print("\n=== 3. AUDITORIA DE TRANSPORTADORES (caminhao_vazio_staging / wins_agro) ===")
    cols, res = query_db("caminhao_vazio_staging", "SELECT table_schema, table_name FROM information_schema.tables WHERE table_name LIKE '%transportador%' OR table_name LIKE '%rntrc%';", user="wins_hub_logistica_ro", password="log_ro_20260722_xK9m")
    print("Transportadores tables in caminhao_vazio_staging:", res)

    cols, res = query_db("caminhao_vazio_staging", "SELECT count(*), count(DISTINCT numero_rntrc) FROM public.transportadores_rntrc;", user="wins_hub_logistica_ro", password="log_ro_20260722_xK9m")
    print("public.transportadores_rntrc count(*) & distinct rntrc:", res)

    cols, res = query_db("caminhao_vazio_staging", "SELECT count(*) FROM public.transportadores_rntrc WHERE situacao_rntrc = 'ATIVO' OR situacao_rntrc = 'Ativo';", user="wins_hub_logistica_ro", password="log_ro_20260722_xK9m")
    print("public.transportadores_rntrc ativos:", res)

    print("\n=== 4. AUDITORIA DE ESTABELECIMENTOS DE SAÚDE (wins_saude_staging / wins_agro) ===")
    cols, res = query_db("wins_saude_staging", "SELECT table_schema, table_name FROM information_schema.tables WHERE table_name LIKE '%estabeleciment%' OR table_name LIKE '%cnes%';", user="wins_hub_saude_ro", password="saude_ro_20260722_xK9m")
    print("Saúde tables:", res)

    cols, res = query_db("wins_saude_staging", "SELECT count(*), count(DISTINCT cnes_id) FROM public.estabelecimentos_cnes;", user="wins_hub_saude_ro", password="saude_ro_20260722_xK9m")
    print("public.estabelecimentos_cnes count(*) & distinct cnes_id:", res)

    cols, res = query_db("wins_saude_staging", "SELECT count(*) FROM public.estabelecimentos_cnes WHERE status = 'ATIVO' OR status = 'Ativo' OR status_cnes = '1';", user="wins_hub_saude_ro", password="saude_ro_20260722_xK9m")
    print("public.estabelecimentos_cnes ativos:", res)

    print("\n=== 5. AUDITORIA DE REPRODUTORES AGRO (wins_agro) ===")
    cols, res = query_db("wins_agro", "SELECT table_schema, table_name FROM information_schema.tables WHERE table_name LIKE '%reprodutor%' OR table_name LIKE '%agro%';")
    print("Agro reprodutores tables:", res)

    cols, res = query_db("wins_agro", "SELECT count(*) FROM public.reprodutores_agro;")
    print("public.reprodutores_agro count(*):", res)

    cols, res = query_db("wins_agro", "SELECT count(*) FROM public.reprodutores_agro WHERE avaliacao_genetica IS NOT NULL OR rgd IS NOT NULL;")
    print("public.reprodutores_agro com avaliação genética / RGD:", res)

    print("\n=== 6. AUDITORIA DE OPORTUNIDADES (wins_agro) ===")
    cols, res = query_db("wins_agro", "SELECT count(*) FROM public.matches_v2;")
    print("matches_v2 brutos:", res)

    cols, res = query_db("wins_agro", "SELECT count(DISTINCT (obra_id, cnpj)) FROM public.matches_v2;")
    print("matches_v2 pares únicos (obra_id, cnpj):", res)

    cols, res = query_db("wins_agro", "SELECT count(*) FROM public.matches_v2 WHERE score >= 70;")
    print("matches_v2 score >= 70:", res)

    cols, res = query_db("wins_agro", "SELECT count(*) FROM public.matches_v2 WHERE score >= 90;")
    print("matches_v2 score >= 90:", res)

    cols, res = query_db("wins_agro", "SELECT count(DISTINCT m.obra_id) FROM public.matches_v2 m INNER JOIN public.obras o ON m.obra_id = o.source_id;")
    print("obras com oportunidade:", res)

    print("\n=== 7. AUDITORIA DE EMPRESAS MULTIVERTICAIS (wins_agro) ===")
    # Check distinct CNPJs in each domain
    cols, res = query_db("wins_agro", """
        WITH eng AS (SELECT DISTINCT cnpj FROM public.obras WHERE cnpj IS NOT NULL AND cnpj != ''),
             agr AS (SELECT DISTINCT cnpj_proprietario AS cnpj FROM public.imoveis_rurais_car WHERE cnpj_proprietario IS NOT NULL AND cnpj_proprietario != ''),
             log AS (SELECT DISTINCT cnpj FROM public.transportadores_rntrc WHERE cnpj IS NOT NULL AND cnpj != ''),
             sau AS (SELECT DISTINCT cnpj_mantenedor AS cnpj FROM public.estabelecimentos_cnes WHERE cnpj_mantenedor IS NOT NULL AND cnpj_mantenedor != '')
        SELECT
          (SELECT count(*) FROM public.estabelecimentos) as total_estab,
          (SELECT count(DISTINCT cnpj) FROM (SELECT cnpj FROM eng UNION SELECT cnpj FROM agr UNION SELECT cnpj FROM log UNION SELECT cnpj FROM sau) u) as em_alguma_vertical,
          (SELECT count(DISTINCT cnpj) FROM (
             SELECT cnpj FROM eng INTERSECT SELECT cnpj FROM agr
           ) u2) as eng_agr,
          (SELECT count(DISTINCT cnpj) FROM (
             SELECT cnpj FROM eng INTERSECT SELECT cnpj FROM agr INTERSECT SELECT cnpj FROM log INTERSECT SELECT cnpj FROM sau
           ) u4) as em_4_verticais;
    """)
    print("Empresas por presença de verticais:", res)

    print("\n=== 8. AUDITORIA DE MUNICÍPIOS 4-VERTICAIS ===")
    cols, res = query_db("wins_agro", """
        WITH m_eng AS (SELECT DISTINCT municipio_cod FROM public.obras WHERE municipio_cod IS NOT NULL),
             m_agr AS (SELECT DISTINCT municipio_cod FROM public.imoveis_rurais_car WHERE municipio_cod IS NOT NULL),
             m_log AS (SELECT DISTINCT municipio_cod FROM public.transportadores_rntrc WHERE municipio_cod IS NOT NULL),
             m_sau AS (SELECT DISTINCT municipio_cod FROM public.estabelecimentos_cnes WHERE municipio_cod IS NOT NULL)
        SELECT
          (SELECT count(*) FROM referencia.municipio) as total_mun_br,
          (SELECT count(*) FROM (
             SELECT municipio_cod FROM m_eng INTERSECT SELECT municipio_cod FROM m_agr INTERSECT SELECT municipio_cod FROM m_log INTERSECT SELECT municipio_cod FROM m_sau
           ) u4) as mun_4_verticais;
    """)
    print("Municípios 4-verticais:", res)

if __name__ == "__main__":
    run_audit()
