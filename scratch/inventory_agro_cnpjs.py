import psycopg2

DB_HOST = "127.0.0.1"
DB_PORT = "5432"

conn = psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname="wins_agro", user="wins_hub_api_ro", password="hcsVNWBPGmcXItoxHzh_s3d18IwbUwIJpcvy6HMSMTM")
cur = conn.cursor()

def check_table_cnpjs(schema, table, col):
    try:
        cur.execute(f"SELECT count(*), count(DISTINCT {col}) FROM {schema}.{table} WHERE {col} IS NOT NULL AND length({col}::text) >= 14;")
        res = cur.fetchone()
        return res
    except Exception as e:
        conn.rollback()
        return str(e)

print("=== INVENTÁRIO DE ENTIDADES AGRO CORPORATIVAS COM CNPJ ===")
tables_to_check = [
    ("cnpj", "empresa_rural", "cnpj"),
    ("cnpj", "empresa_vet", "cnpj"),
    ("prospeccao", "cnpj_rural", "cnpj"),
    ("prospeccao", "vet_pecuaria", "cnpj"),
    ("prospeccao", "holding_lead_ui", "cnpj"),
    ("prospeccao", "grupo_societario", "cnpj"),
    ("prospeccao", "imovel_rural", "cpf_cnpj"),
    ("prospeccao", "rebanho_elite", "cnpj"),
    ("mercado", "reprodutor", "cnpj"),
]

for s, t, c in tables_to_check:
    print(f"{s}.{t} ({c}): {check_table_cnpjs(s, t, c)}")

# Collect all distinct valid Agro CNPJs across all agro tables
agro_tables_valid = [
    ("cnpj", "empresa_rural", "cnpj"),
    ("cnpj", "empresa_vet", "cnpj"),
    ("prospeccao", "cnpj_rural", "cnpj"),
    ("prospeccao", "vet_pecuaria", "cnpj"),
]

all_agro_cnpjs = set()
for s, t, c in agro_tables_valid:
    try:
        cur.execute(f"SELECT DISTINCT {c} FROM {s}.{t} WHERE {c} IS NOT NULL AND length({c}::text) >= 14;")
        for r in cur.fetchall():
            if r[0]:
                all_agro_cnpjs.add(str(r[0]).strip())
    except Exception as e:
        conn.rollback()

print(f"\nTotal de CNPJs Agro distintos coletados nas fontes corporativas: {len(all_agro_cnpjs)}")

cur.close()
conn.close()
