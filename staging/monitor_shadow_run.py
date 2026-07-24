import psycopg2
import json
import time
import os
from datetime import datetime

DB_HOST = "127.0.0.1"
DB_PORT = 5432
DB_NAME = "wins_agro"
DB_USER = "postgres"
DB_PASS = "sfKszP6x5PQOdQkSwPfQK9ieUxpNDKY9"

API_BASE = "http://127.0.0.1:18085"
NGINX_ACCESS_LOG = "/root/wins_hub_unificado/staging/access.log"

def check_pool():
    conn = psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname=DB_NAME, user=DB_USER, password=DB_PASS)
    cur = conn.cursor()
    cur.execute("""
        SELECT count(*) as total, 
               count(*) FILTER (WHERE state = 'active') as active,
               count(*) FILTER (WHERE state = 'idle') as idle
        FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid()
    """)
    row = cur.fetchone()
    cur.close()
    conn.close()
    return {"total": row[0], "active": row[1], "idle": row[2]}

def check_db_size():
    conn = psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname=DB_NAME, user=DB_USER, password=DB_PASS)
    cur = conn.cursor()
    cur.execute("SELECT pg_size_pretty(pg_database_size(current_database()))")
    size = cur.fetchone()[0]
    cur.close()
    conn.close()
    return size

def check_tables():
    conn = psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname=DB_NAME, user=DB_USER, password=DB_PASS)
    cur = conn.cursor()
    tables = [
        "SELECT count(*) FROM engenharia.fornecedores",
        "SELECT count(*) FROM engenharia.obras",
        "SELECT count(*) FROM canonical_mvp.entidade_empresa",
    ]
    results = {}
    for sql in tables:
        label = sql.split("FROM ")[1].strip()
        cur.execute(sql)
        results[label] = cur.fetchone()[0]
    cur.close()
    conn.close()
    return results

def check_api_health():
    import urllib.request
    try:
        req = urllib.request.Request(f"{API_BASE}/api/v1/health")
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status == 200
    except:
        return False

def check_nginx_log():
    if not os.path.exists(NGINX_ACCESS_LOG):
        return {"total_requests": 0, "errors_4xx": 0, "errors_5xx": 0, "timeouts": 0}
    
    with open(NGINX_ACCESS_LOG) as f:
        lines = f.readlines()
    
    last_24h = int(time.time()) - 86400
    count_4xx = 0
    count_5xx = 0
    count_total = 0
    
    for line in lines:
        parts = line.split()
        if len(parts) >= 9:
            try:
                status = int(parts[8])
                count_total += 1
                if 400 <= status < 500:
                    count_4xx += 1
                elif status >= 500:
                    count_5xx += 1
            except:
                pass
    
    return {
        "total_requests": count_total,
        "errors_4xx": count_4xx,
        "errors_5xx": count_5xx,
    }

if __name__ == "__main__":
    report = {
        "timestamp": datetime.utcnow().isoformat(),
        "api_health": check_api_health(),
        "pool": check_pool(),
        "db_size": check_db_size(),
        "tables": check_tables(),
        "nginx": check_nginx_log(),
    }
    
    print(json.dumps(report, indent=2, ensure_ascii=False))
    
    # Append to daily metrics
    day = (datetime.utcnow() - datetime(2026, 7, 21)).days + 1
    out_file = f"/root/wins_hub_unificado/staging/metrics_day_{day:02d}.json"
    with open(out_file, "w") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"\nMetrics saved to {out_file}")
