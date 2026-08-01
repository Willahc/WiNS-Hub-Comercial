import os
import time
import psycopg2
import concurrent.futures
import numpy as np

def load_env_file(filepath: str):
    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip().strip("'").strip('"')
                    os.environ[key] = value

def run_benchmark():
    print("Iniciando testes de performance abrangentes da API...")
    
    # Load .env variables
    current_dir = os.path.dirname(os.path.abspath(__file__))
    load_env_file(os.path.join(current_dir, ".env"))
    
    db_host = os.environ.get("DB_HOST", "127.0.0.1")
    db_port = os.environ.get("DB_PORT", "5432")
    db_name = os.environ.get("DB_NAME", "wins_agro")
    db_user = os.environ.get("DB_USER", "wins_hub_api_ro")
    db_pass = os.environ.get("DB_PASS")
    
    # 1. Cold connection (conexão fria)
    t0 = time.time()
    conn = psycopg2.connect(host=db_host, port=db_port, dbname=db_name, user=db_user, password=db_pass)
    cursor = conn.cursor()
    cursor.execute("SELECT id, cnpj, razao_social, situacao_cadastral, confianca_geral FROM canonical_mvp.entidade_empresa LIMIT 20;")
    cursor.fetchall()
    t_cold = (time.time() - t0) * 1000
    print(f"Cold Connection (primeira consulta + handshake): {t_cold:.2f} ms")
    
    # 2. Warm connection (conexão aquecida)
    latencies = []
    for _ in range(50):
        t_start = time.time()
        cursor.execute("SELECT id, cnpj, razao_social, situacao_cadastral, confianca_geral FROM canonical_mvp.entidade_empresa LIMIT 20;")
        cursor.fetchall()
        latencies.append((time.time() - t_start) * 1000)
    
    print(f"Warm Connection (média de 50 consultas sequenciais): {np.mean(latencies):.2f} ms")
    print(f"p50: {np.percentile(latencies, 50):.2f} ms | p95: {np.percentile(latencies, 95):.2f} ms | p99: {np.percentile(latencies, 99):.2f} ms")
    
    # 3. Pagination and filters (paginação e filtros)
    t_filter_cnpj = time.time()
    cursor.execute("SELECT id, cnpj, razao_social, municipio, uf, confianca_geral FROM canonical_mvp.vw_empresa_360 WHERE cnpj = '64780090000163' LIMIT 1;")
    cursor.fetchall()
    print(f"Filtro por CNPJ na View 360: {(time.time() - t_filter_cnpj)*1000:.2f} ms")

    t_pag = time.time()
    cursor.execute("SELECT id, cnpj, razao_social, situacao_cadastral, confianca_geral FROM canonical_mvp.entidade_empresa LIMIT 20 OFFSET 1000;")
    cursor.fetchall()
    print(f"Paginação (LIMIT 20 OFFSET 1000): {(time.time() - t_pag)*1000:.2f} ms")
    
    cursor.close()
    conn.close()
    
    # 4. Explain analyze of queries
    conn_explain = psycopg2.connect(host=db_host, port=db_port, dbname=db_name, user=db_user, password=db_pass)
    cursor_explain = conn_explain.cursor()
    
    print("\nEXPLAIN ANALYZE - Consulta Otimizada de Listagem (entidade_empresa):")
    cursor_explain.execute("EXPLAIN ANALYZE SELECT id, cnpj, razao_social, situacao_cadastral, confianca_geral FROM canonical_mvp.entidade_empresa LIMIT 20;")
    explain_rows = cursor_explain.fetchall()
    for row in explain_rows[:5]:  # print first 5 lines of query plan
        print(row[0])
        
    print("\nEXPLAIN ANALYZE - Consulta de Detalhes da Empresa 360 (vw_empresa_360 com filtro CNPJ):")
    cursor_explain.execute("EXPLAIN ANALYZE SELECT id, cnpj, razao_social, municipio, uf, confianca_geral FROM canonical_mvp.vw_empresa_360 WHERE cnpj = '64780090000163' LIMIT 1;")
    explain_rows_360 = cursor_explain.fetchall()
    for row in explain_rows_360[:5]:
        print(row[0])
        
    cursor_explain.close()
    conn_explain.close()
    
    # 5. Concurrency (concorrência)
    def make_request():
        try:
            c = psycopg2.connect(host=db_host, port=db_port, dbname=db_name, user=db_user, password=db_pass)
            cur = c.cursor()
            t_req = time.time()
            cur.execute("SELECT id, cnpj, razao_social, situacao_cadastral, confianca_geral FROM canonical_mvp.entidade_empresa LIMIT 20;")
            cur.fetchall()
            latency = (time.time() - t_req) * 1000
            cur.close()
            c.close()
            return latency
        except Exception:
            return -1.0

    print("\nExecutando teste de concorrência com 10 conexões simultâneas...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(make_request) for _ in range(50)]
        results = [f.result() for f in concurrent.futures.as_completed(futures)]
        
    valid_results = [r for r in results if r > 0]
    print(f"Concorrência Concluída: {len(valid_results)}/50 conexões bem-sucedidas.")
    print(f"Média Latência Concorrente: {np.mean(valid_results):.2f} ms")
    print(f"p50: {np.percentile(valid_results, 50):.2f} ms | p95: {np.percentile(valid_results, 95):.2f} ms | p99: {np.percentile(valid_results, 99):.2f} ms")

if __name__ == "__main__":
    run_benchmark()
