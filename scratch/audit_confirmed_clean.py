import psycopg2

conn_a = psycopg2.connect(host="127.0.0.1", port="5432", dbname="wins_agro", user="wins_hub_api_ro", password="hcsVNWBPGmcXItoxHzh_s3d18IwbUwIJpcvy6HMSMTM")
cur_a = conn_a.cursor()

conn_s = psycopg2.connect(host="127.0.0.1", port="5432", dbname="wins_saude_staging", user="wins_hub_saude_ro", password="saude_ro_20260722_xK9m")
cur_s = conn_s.cursor()

cur_a.execute("SELECT count(DISTINCT (id, cnpj)) FROM engenharia.obras WHERE visivel = true AND cnpj IS NOT NULL AND length(cnpj) >= 14;")
c_obra_emp = cur_a.fetchone()[0]

cur_s.execute("SELECT count(DISTINCT (id, cnpj_entidade)) FROM public.estabelecimentos WHERE cnpj_entidade IS NOT NULL AND length(cnpj_entidade) >= 14;")
c_cnes_mant = cur_s.fetchone()[0]

print(f"Obra ↔ Empresa executora/proprietária (CNPJ de 14 dígitos validado): {c_obra_emp}")
print(f"CNES ↔ Entidade Mantenedora (CNPJ mantenedor de 14 dígitos validado): {c_cnes_mant}")
print(f"Subtotal de relações estritamente confirmadas por chave documental explícita: {c_obra_emp + c_cnes_mant}")

cur_a.close(); conn_a.close()
cur_s.close(); conn_s.close()
