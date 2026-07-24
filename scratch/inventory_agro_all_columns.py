import psycopg2

DB_HOST = "127.0.0.1"
DB_PORT = "5432"

conn = psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname="wins_agro", user="wins_hub_api_ro", password="hcsVNWBPGmcXItoxHzh_s3d18IwbUwIJpcvy6HMSMTM")
cur = conn.cursor()

def get_cols(schema, table):
    cur.execute(f"SELECT column_name FROM information_schema.columns WHERE table_schema='{schema}' AND table_name='{table}';")
    return [r[0] for r in cur.fetchall()]

print("cnpj.empresa_rural cols:", get_cols("cnpj", "empresa_rural"))
print("cnpj.empresa_vet cols:", get_cols("cnpj", "empresa_vet"))
print("prospeccao.vet_pecuaria cols:", get_cols("prospeccao", "vet_pecuaria"))
print("prospeccao.holding_lead_ui cols:", get_cols("prospeccao", "holding_lead_ui"))

# Check counts for cnpj14 / cnpj_basico / cnpj_raiz
def count_cnpjs(schema, table, col):
    try:
        cur.execute(f"SELECT count(*), count(DISTINCT {col}) FROM {schema}.{table} WHERE {col} IS NOT NULL AND length({col}::text) >= 8;")
        return cur.fetchone()
    except Exception as e:
        conn.rollback()
        return str(e)

print("\n--- CONTAGENS AGRO CORPORATIVO ---")
print("prospeccao.cnpj_rural (cnpj):", count_cnpjs("prospeccao", "cnpj_rural", "cnpj"))
print("cnpj.empresa_rural (cnpj14):", count_cnpjs("cnpj", "empresa_rural", "cnpj14"))
print("cnpj.empresa_vet (cnpj14):", count_cnpjs("cnpj", "empresa_vet", "cnpj14"))
print("prospeccao.vet_pecuaria (cnpj14):", count_cnpjs("prospeccao", "vet_pecuaria", "cnpj14"))
print("prospeccao.holding_lead_ui (cnpj14):", count_cnpjs("prospeccao", "holding_lead_ui", "cnpj14"))

cur.close()
conn.close()
