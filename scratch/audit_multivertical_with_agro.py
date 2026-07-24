import psycopg2

DB_HOST = "127.0.0.1"
DB_PORT = "5432"

conn_a = psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname="wins_agro", user="wins_hub_api_ro", password="hcsVNWBPGmcXItoxHzh_s3d18IwbUwIJpcvy6HMSMTM")
cur_a = conn_a.cursor()

conn_l = psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname="caminhao_vazio_staging", user="wins_hub_logistica_ro", password="log_ro_20260722_xK9m")
cur_l = conn_l.cursor()

conn_s = psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname="wins_saude_staging", user="wins_hub_saude_ro", password="saude_ro_20260722_xK9m")
cur_s = conn_s.cursor()

# 1. ENGENHARIA
cur_a.execute("SELECT DISTINCT cnpj FROM engenharia.obras WHERE cnpj IS NOT NULL AND length(cnpj) >= 14;")
eng_cnpjs = set(r[0].strip() for r in cur_a.fetchall())

# 2. LOGÍSTICA
cur_l.execute("SELECT DISTINCT cpfcnpjtransportador FROM public.rntrc_transportadores WHERE cpfcnpjtransportador IS NOT NULL AND length(cpfcnpjtransportador) >= 14;")
log_cnpjs = set(r[0].strip() for r in cur_l.fetchall())

# 3. SAÚDE
cur_s.execute("SELECT DISTINCT cnpj_entidade FROM public.estabelecimentos WHERE cnpj_entidade IS NOT NULL AND length(cnpj_entidade) >= 14;")
sau_cnpjs = set(r[0].strip() for r in cur_s.fetchall())

# 4. AGRO CORPORATIVO
cur_a.execute("SELECT DISTINCT cnpj FROM prospeccao.cnpj_rural WHERE cnpj IS NOT NULL AND length(cnpj) >= 14;")
agr1 = set(r[0].strip() for r in cur_a.fetchall())

cur_a.execute("SELECT DISTINCT cnpj14 FROM prospeccao.vet_pecuaria WHERE cnpj14 IS NOT NULL AND length(cnpj14) >= 14;")
agr2 = set(r[0].strip() for r in cur_a.fetchall())

cur_a.execute("SELECT DISTINCT cnpj14 FROM prospeccao.holding_lead_ui WHERE cnpj14 IS NOT NULL AND length(cnpj14) >= 14;")
agr3 = set(r[0].strip() for r in cur_a.fetchall())

agr_cnpjs = agr1.union(agr2).union(agr3)

print(f"CNPJs distintos Engenharia: {len(eng_cnpjs)}")
print(f"CNPJs distintos Logística: {len(log_cnpjs)}")
print(f"CNPJs distintos Saúde: {len(sau_cnpjs)}")
print(f"CNPJs distintos Agro Corporativo: {len(agr_cnpjs)}")

# Combine all CNPJs into mutually exclusive sets
all_cnpjs = {}
for c in eng_cnpjs: all_cnpjs[c] = all_cnpjs.get(c, 0) | 1
for c in log_cnpjs: all_cnpjs[c] = all_cnpjs.get(c, 0) | 2
for c in sau_cnpjs: all_cnpjs[c] = all_cnpjs.get(c, 0) | 4
for c in agr_cnpjs: all_cnpjs[c] = all_cnpjs.get(c, 0) | 8

breakdown = {}
for cnpj, mask in all_cnpjs.items():
    v_list = []
    if mask & 1: v_list.append("Engenharia")
    if mask & 2: v_list.append("Logística")
    if mask & 4: v_list.append("Saúde")
    if mask & 8: v_list.append("Agro Corporativo")
    combo = " + ".join(v_list)
    breakdown[combo] = breakdown.get(combo, 0) + 1

total_cnpjs = len(all_cnpjs)
print(f"\nUNIVERSO TOTAL DE CNPJS CORPORATIVOS ANALISADOS: {total_cnpjs}")
print("\nDesmembramento Mutuamente Exclusivo Completo (4 Verticais):")
sum_check = 0
for combo, count in sorted(breakdown.items(), key=lambda x: x[1], reverse=True):
    print(f"  - {combo}: {count}")
    sum_check += count
print(f"Soma dos grupos: {sum_check} (Bate com {total_cnpjs}: {sum_check == total_cnpjs})")

by_num = {1: 0, 2: 0, 3: 0, 4: 0}
for combo, count in breakdown.items():
    n = len(combo.split(" + "))
    by_num[n] += count

print("\nResumo por número de verticais:")
print(f"  - Somente 1 vertical: {by_num[1]}")
print(f"  - Exatamente 2 verticais: {by_num[2]}")
print(f"  - Exatamente 3 verticais: {by_num[3]}")
print(f"  - Exatamente 4 verticais: {by_num[4]}")

cur_a.close(); conn_a.close()
cur_l.close(); conn_l.close()
cur_s.close(); conn_s.close()
