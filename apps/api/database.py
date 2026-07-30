import os
import psycopg2
from psycopg2.pool import SimpleConnectionPool
from config import DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS

_MISSING = object()

def _raise(name):
    raise RuntimeError(f"Required env var {name} is not set")

DOMAIN_CREDENTIALS = {
    "engenharia": {"user": DB_USER, "pass": DB_PASS, "dbname": DB_NAME},
    "agro": {"user": os.environ.get("DB_AGRO_USER") or _raise("DB_AGRO_USER"), "pass": os.environ.get("DB_AGRO_PASS") or _raise("DB_AGRO_PASS"), "dbname": "wins_agro"},
    "logistica": {"user": os.environ.get("DB_LOG_USER") or _raise("DB_LOG_USER"), "pass": os.environ.get("DB_LOG_PASS") or _raise("DB_LOG_PASS"), "dbname": "caminhao_vazio_staging"},
    "saude": {"user": os.environ.get("DB_SAUDE_USER") or _raise("DB_SAUDE_USER"), "pass": os.environ.get("DB_SAUDE_PASS") or _raise("DB_SAUDE_PASS"), "dbname": "wins_saude_staging"}
}

DB_WRITE_USER = os.environ.get("DB_WRITE_USER", DB_USER)
DB_WRITE_PASS = os.environ.get("DB_WRITE_PASS") or _raise("DB_WRITE_PASS")

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
