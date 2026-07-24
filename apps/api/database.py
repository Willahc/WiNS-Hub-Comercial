import os
import psycopg2
from psycopg2.pool import SimpleConnectionPool
from config import DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS

DOMAIN_CREDENTIALS = {
    "engenharia": {"user": DB_USER, "pass": DB_PASS, "dbname": DB_NAME},
    "agro": {"user": "wins_hub_agro_ro", "pass": "agro_ro_20260722_xK9m", "dbname": "wins_agro"},
    "logistica": {"user": "wins_hub_logistica_ro", "pass": "log_ro_20260722_xK9m", "dbname": "caminhao_vazio_staging"},
    "saude": {"user": "wins_hub_saude_ro", "pass": "saude_ro_20260722_xK9m", "dbname": "wins_saude_staging"}
}

pools = {}
for domain, creds in DOMAIN_CREDENTIALS.items():
    try:
        pools[domain] = SimpleConnectionPool(
            minconn=1,
            maxconn=10,
            host=DB_HOST,
            port=DB_PORT,
            dbname=creds["dbname"],
            user=creds["user"],
            password=creds["pass"]
        )
    except Exception as ex:
        print(f"Failed to create pool for {domain}: {ex}")

def get_connection(domain: str = "engenharia"):
    if domain in pools and pools[domain]:
        return pools[domain].getconn()
    creds = DOMAIN_CREDENTIALS.get(domain, DOMAIN_CREDENTIALS["engenharia"])
    return psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=creds["dbname"], user=creds["user"], password=creds["pass"]
    )

def release_connection(conn, domain: str = "engenharia"):
    if domain in pools and pools[domain] and conn:
        try:
            pools[domain].putconn(conn)
        except Exception:
            conn.close()
    elif conn:
        conn.close()
