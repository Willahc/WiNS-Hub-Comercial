import psycopg2

DB_HOST = "127.0.0.1"
DB_PORT = "5432"

conn_a = psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname="wins_agro", user="wins_hub_api_ro", password="hcsVNWBPGmcXItoxHzh_s3d18IwbUwIJpcvy6HMSMTM")
cur_a = conn_a.cursor()

conn_s = psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname="wins_saude_staging", user="wins_hub_saude_ro", password="saude_ro_20260722_xK9m")
cur_s = conn_s.cursor()

print("=== TOTAL REAL DISPONÍVEL ANTES DOS LIMITES EDITORIAIS ===")

# 1. Obra ↔ Empresa executora (CNPJ explícito)
sql1 = "SELECT count(DISTINCT (id, cnpj)) FROM engenharia.obras WHERE visivel = true AND cnpj IS NOT NULL AND cnpj != '';"
cur_a.execute(sql1)
t1 = cur_a.fetchone()[0]
print(f"1. Obra ↔ Empresa executora (Total disponível): {t1} | LIMIT editorial: 2.000")

# 2. CNES ↔ Mantenedora (CNPJ mantenedor explícito)
sql2 = "SELECT count(DISTINCT (id, cnpj_entidade)) FROM public.estabelecimentos WHERE cnpj_entidade IS NOT NULL AND cnpj_entidade != '';"
cur_s.execute(sql2)
t2 = cur_s.fetchone()[0]
print(f"2. CNES ↔ Entidade Mantenedora (Total disponível): {t2} | LIMIT editorial: 1.000")

# 3. Obra ↔ Fornecedor Cadastrado (Vínculo documental direto / Fornecedor principal)
sql3 = "SELECT count(DISTINCT (id, fornecedor_principal)) FROM engenharia.obras WHERE visivel = true AND fornecedor_principal IS NOT NULL AND fornecedor_principal != '';"
cur_a.execute(sql3)
t3 = cur_a.fetchone()[0]
print(f"3. Obra ↔ Fornecedor Cadastrado explícito (Total disponível): {t3} | LIMIT editorial: 576")

print(f"\nTotal real disponível de relações confirmadas com chave explícita no sistema: {t1 + t2 + t3}")
print(f"Soma dos LIMITs editoriais em destaque: 2.000 + 1.000 + 576 = 3.576")

cur_a.close(); conn_a.close()
cur_s.close(); conn_s.close()
