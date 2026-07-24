import psycopg2

DB_HOST = "127.0.0.1"
DB_PORT = "5432"
DB_USER = "wins_hub_api_ro"
DB_PASS = "hcsVNWBPGmcXItoxHzh_s3d18IwbUwIJpcvy6HMSMTM"

def query_tables(dbname, user=DB_USER, password=DB_PASS):
    try:
        conn = psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname=dbname, user=user, password=password)
        cur = conn.cursor()
        cur.execute("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY table_schema, table_name;")
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return rows
    except Exception as e:
        return str(e)

print("=== wins_agro tables ===")
tables = query_tables("wins_agro")
for s, t in tables if isinstance(tables, list) else []:
    print(f"{s}.{t}")

print("\n=== caminhao_vazio_staging tables ===")
tables = query_tables("caminhao_vazio_staging", user="wins_hub_logistica_ro", password="log_ro_20260722_xK9m")
for s, t in tables if isinstance(tables, list) else []:
    print(f"{s}.{t}")

print("\n=== wins_saude_staging tables ===")
tables = query_tables("wins_saude_staging", user="wins_hub_saude_ro", password="saude_ro_20260722_xK9m")
for s, t in tables if isinstance(tables, list) else []:
    print(f"{s}.{t}")
