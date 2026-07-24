import psycopg2

DB_HOST = "127.0.0.1"
DB_PORT = "5432"

def get_cols(dbname, schema, table, user="wins_hub_api_ro", password="hcsVNWBPGmcXItoxHzh_s3d18IwbUwIJpcvy6HMSMTM"):
    try:
        conn = psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname=dbname, user=user, password=password)
        cur = conn.cursor()
        cur.execute(f"SELECT column_name FROM information_schema.columns WHERE table_schema = '{schema}' AND table_name = '{table}';")
        cols = [r[0] for r in cur.fetchall()]
        cur.close()
        conn.close()
        return cols
    except Exception as e:
        return str(e)

print("core.empresa cols:", get_cols("wins_agro", "core", "empresa"))
print("engenharia.obras cols:", get_cols("wins_agro", "engenharia", "obras"))
print("caminhao_vazio_staging public.rntrc_transportadores cols:", get_cols("caminhao_vazio_staging", "public", "rntrc_transportadores", user="wins_hub_logistica_ro", password="log_ro_20260722_xK9m"))
print("wins_saude_staging public.estabelecimentos cols:", get_cols("wins_saude_staging", "public", "estabelecimentos", user="wins_hub_saude_ro", password="saude_ro_20260722_xK9m"))
print("mercado.reprodutor cols:", get_cols("wins_agro", "mercado", "reprodutor"))
