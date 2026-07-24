import psycopg2

conn = psycopg2.connect(host="127.0.0.1", port="5432", dbname="wins_agro", user="wins_hub_api_ro", password="hcsVNWBPGmcXItoxHzh_s3d18IwbUwIJpcvy6HMSMTM")
cur = conn.cursor()

cur.execute("SELECT count(*) FROM engenharia.matches_v2 WHERE obra_id IN (SELECT id FROM engenharia.obras);")
print("Matches vinculados a obras no banco:", cur.fetchone()[0])

cur.execute("SELECT count(*) FROM engenharia.matches_v2 WHERE obra_id IN (SELECT id FROM engenharia.obras WHERE visivel = true);")
print("Matches brutos vinculados a obras visíveis (CONCEITO DE 687.087):", cur.fetchone()[0])

cur.execute("SELECT count(*) FROM engenharia.matches_v2 WHERE score >= 70 AND obra_id IN (SELECT id FROM engenharia.obras WHERE visivel = true);")
print("Matches score >= 70 vinculados a obras visíveis (641.968):", cur.fetchone()[0])

cur.execute("SELECT count(*) FROM engenharia.matches_v2 WHERE score >= 90 AND obra_id IN (SELECT id FROM engenharia.obras WHERE visivel = true);")
print("Matches score >= 90 vinculados a obras visíveis (533.489):", cur.fetchone()[0])

cur.close()
conn.close()
