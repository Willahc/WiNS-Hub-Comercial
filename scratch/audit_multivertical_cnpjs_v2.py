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

print("=== 1. COLUNAS CNPJ ===")
print("imovel_rural cols:", query("wins_agro", "SELECT column_name FROM information_schema.columns WHERE table_schema='prospeccao' AND table_name='imovel_rural';"))

# Query CNPJs from each domain
eng_cnpjs = set(r[0] for r in query("wins_agro", "SELECT DISTINCT cnpj FROM engenharia.obras WHERE cnpj IS NOT NULL AND cnpj != '';") if isinstance(r, tuple))

# Check imovel_rural columns
imovel_cols = [r[0] for r in query("wins_agro", "SELECT column_name FROM information_schema.columns WHERE table_schema='prospeccao' AND table_name='imovel_rural';")]
print("Imovel rural columns:", imovel_cols)

cnpj_col_imovel = [c for c in imovel_cols if 'cnpj' in c or 'cpf' in c or 'proprietario' in c]
print("Imovel rural cnpj candidate cols:", cnpj_col_imovel)

log_cnpjs = set(r[0] for r in query("caminhao_vazio_staging", "SELECT DISTINCT cpfcnpjtransportador FROM public.rntrc_transportadores WHERE cpfcnpjtransportador IS NOT NULL AND length(cpfcnpjtransportador) > 11;", user="wins_hub_logistica_ro", password="log_ro_20260722_xK9m") if isinstance(r, tuple))

sau_cnpjs = set(r[0] for r in query("wins_saude_staging", "SELECT DISTINCT cnpj_entidade FROM public.estabelecimentos WHERE cnpj_entidade IS NOT NULL AND cnpj_entidade != '';", user="wins_hub_saude_ro", password="saude_ro_20260722_xK9m") if isinstance(r, tuple))

print(f"CNPJs em Engenharia: {len(eng_cnpjs)}")
print(f"CNPJs em Logística (RNTRC): {len(log_cnpjs)}")
print(f"CNPJs em Saúde (CNES): {len(sau_cnpjs)}")

# Check overlap between Eng, Log, Sau
all_cnpjs = {}
for c in eng_cnpjs: all_cnpjs[c] = all_cnpjs.get(c, 0) | 1
for c in log_cnpjs: all_cnpjs[c] = all_cnpjs.get(c, 0) | 2
for c in sau_cnpjs: all_cnpjs[c] = all_cnpjs.get(c, 0) | 4

counts = {1: 0, 2: 0, 3: 0, 4: 0}
for c, mask in all_cnpjs.items():
    num_vert = bin(mask).count('1')
    counts[num_vert] += 1

print("\n--- DISTRIBUIÇÃO REAL DE CNPJS MULTIVERTICAIS ---")
print(f"Presentes em 1 vertical: {counts[1]}")
print(f"Presentes em 2 verticais: {counts[2]}")
print(f"Presentes em 3 verticais: {counts[3]}")
print(f"Presentes em 4 verticais: {counts[4]}")

print("\n=== 2. OPORTUNIDADES 687.087 ===")
sql_687 = """
SELECT count(*) FROM engenharia.matches_v2 m
INNER JOIN engenharia.obras o ON (m.obra_id = o.id::text OR m.obra_id = o.id_externo);
"""
print("Matches vinculados às obras no banco (total):", query("wins_agro", sql_687))

# Matches brutos vinculados às 16.633 obras visíveis sem filtro de score >= 70
sql_687_vis = """
SELECT count(*) FROM engenharia.matches_v2 m
INNER JOIN engenharia.obras o ON (m.obra_id = o.id::text OR m.obra_id = o.id_externo)
WHERE o.visivel = true;
"""
print("Matches brutos vinculados às obras visíveis (sem filtro score >= 70):", query("wins_agro", sql_687_vis))
