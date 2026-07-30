import os
import psycopg2
from psycopg2.pool import SimpleConnectionPool
from config import DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS

DOMAIN_CREDENTIALS = {
    "engenharia": {"user": DB_USER, "pass": DB_PASS, "dbname": DB_NAME},
    "agro": {"user": os.environ.get("DB_AGRO_USER", "wins_hub_agro_ro"), "pass": os.environ.get("DB_AGRO_PASS", "agro_ro_20260722_xK9m"), "dbname": "wins_agro"},
    "logistica": {"user": os.environ.get("DB_LOG_USER", "wins_hub_logistica_ro"), "pass": os.environ.get("DB_LOG_PASS", "log_ro_20260722_xK9m"), "dbname": "caminhao_vazio_staging"},
    "saude": {"user": os.environ.get("DB_SAUDE_USER", "wins_hub_saude_ro"), "pass": os.environ.get("DB_SAUDE_PASS", "saude_ro_20260722_xK9m"), "dbname": "wins_saude_staging"}
}

DB_WRITE_USER = os.environ.get("DB_WRITE_USER", DB_USER)
DB_WRITE_PASS = os.environ.get("DB_WRITE_PASS", DB_PASS or "")

pools = {}
write_pool = None
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

try:
    write_pool = SimpleConnectionPool(
        minconn=1, maxconn=5,
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
        user=DB_WRITE_USER, password=DB_WRITE_PASS
    )
except Exception as ex:
    print(f"Failed to create write pool: {ex}")

def get_connection(domain: str = "engenharia"):
    if domain in pools and pools[domain]:
        return pools[domain].getconn()
    creds = DOMAIN_CREDENTIALS.get(domain, DOMAIN_CREDENTIALS["engenharia"])
    return psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=creds["dbname"], user=creds["user"], password=creds["pass"]
    )

def get_write_connection():
    if write_pool:
        return write_pool.getconn()
    return psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
        user=DB_WRITE_USER, password=DB_WRITE_PASS
    )

def release_connection(conn, domain: str = "engenharia"):
    if domain in pools and pools[domain] and conn:
        try:
            pools[domain].putconn(conn)
        except Exception:
            conn.close()
    elif conn:
        conn.close()

def release_write_connection(conn):
    if write_pool and conn:
        try:
            write_pool.putconn(conn)
        except Exception:
            conn.close()
    elif conn:
        conn.close()
