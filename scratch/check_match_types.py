import psycopg2

DB_HOST = "127.0.0.1"
DB_PORT = "5432"

conn = psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname="wins_agro", user="wins_hub_api_ro", password="hcsVNWBPGmcXItoxHzh_s3d18IwbUwIJpcvy6HMSMTM")
cur = conn.cursor()
cur.execute("SELECT pg_typeof(id), pg_typeof(id_externo) FROM engenharia.obras LIMIT 1;")
print("obras id types:", cur.fetchone())

cur.execute("SELECT pg_typeof(obra_id) FROM engenharia.matches_v2 LIMIT 1;")
print("matches_v2 obra_id type:", cur.fetchone())

cur.execute("SELECT count(*) FROM engenharia.matches_v2 WHERE obra_id IN (SELECT id_externo FROM engenharia.obras);")
print("matches_v2 joined on id_externo:", cur.fetchone())

cur.execute("SELECT count(*) FROM engenharia.matches_v2 WHERE score >= 70 AND obra_id IN (SELECT id_externo FROM engenharia.obras WHERE visivel = true);")
print("matches_v2 score >= 70 linked to visivel obras:", cur.fetchone())

cur.execute("SELECT count(*) FROM engenharia.matches_v2 WHERE obra_id IN (SELECT id_externo FROM engenharia.obras WHERE visivel = true);")
print("matches_v2 ALL scores linked to visivel obras (CONCEPT OF 687.087):", cur.fetchone())

cur.close()
conn.close()
