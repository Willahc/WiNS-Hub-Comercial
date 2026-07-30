import os
import logging
import psycopg2
from psycopg2.pool import SimpleConnectionPool
from config import DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS

logger = logging.getLogger("wins_hub_api.database")

_MISSING = object()

# Pool config
POOL_MIN = 1
POOL_MAX = 10
POOL_RECYCLE_SECONDS = 1800  # 30 min — recycle connections to avoid stale state
CONNECT_TIMEOUT_SECONDS = 5
WRITE_POOL_MAX = 5

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
            minconn=POOL_MIN,
            maxconn=POOL_MAX,
            host=DB_HOST,
            port=DB_PORT,
            dbname=creds["dbname"],
            user=creds["user"],
            password=creds["pass"],
            connect_timeout=CONNECT_TIMEOUT_SECONDS
        )
    except Exception as ex:
        logger.error(f"Failed to create read pool for {domain}: {ex}")

try:
    write_pool = SimpleConnectionPool(
        minconn=POOL_MIN, maxconn=WRITE_POOL_MAX,
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
        user=DB_WRITE_USER, password=DB_WRITE_PASS,
        connect_timeout=CONNECT_TIMEOUT_SECONDS
    )
except Exception as ex:
    logger.error(f"Failed to create write pool: {ex}")

import time

_conn_created = {}

def _validate_connection(conn):
    """Ping connection before use — discards stale/broken connections."""
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        conn.rollback()  # close implicit transaction before returning to caller
        return True
    except Exception:
        return False

def _tag_conn(conn):
    if conn:
        _conn_created.setdefault(id(conn), time.time())
    return conn

def _is_expired(conn):
    if not conn:
        return False
    created_at = _conn_created.get(id(conn))
    if created_at is None:
        return False
    return (time.time() - created_at) > POOL_RECYCLE_SECONDS

def _untag_conn(conn):
    if conn:
        _conn_created.pop(id(conn), None)

def get_connection(domain: str = "engenharia"):
    pool = pools.get(domain)
    if pool:
        try:
            conn = pool.getconn()
            _tag_conn(conn)
        except Exception as ex:
            logger.warning(f"Failed to get connection from pool for {domain}, falling back to direct connection: {ex}")
            creds = DOMAIN_CREDENTIALS.get(domain, DOMAIN_CREDENTIALS["engenharia"])
            return _tag_conn(psycopg2.connect(
                host=DB_HOST, port=DB_PORT, dbname=creds["dbname"],
                user=creds["user"], password=creds["pass"],
                connect_timeout=CONNECT_TIMEOUT_SECONDS
            ))

        # Check age-based recycle
        if _is_expired(conn):
            logger.info(f"Connection for domain '{domain}' exceeded POOL_RECYCLE_SECONDS ({POOL_RECYCLE_SECONDS}s), recycling")
            _untag_conn(conn)
            try:
                pool.putconn(conn, close=True)
            except Exception:
                try:
                    conn.close()
                except Exception:
                    pass
            try:
                conn = pool.getconn()
                _tag_conn(conn)
            except Exception:
                creds = DOMAIN_CREDENTIALS.get(domain, DOMAIN_CREDENTIALS["engenharia"])
                return _tag_conn(psycopg2.connect(
                    host=DB_HOST, port=DB_PORT, dbname=creds["dbname"],
                    user=creds["user"], password=creds["pass"],
                    connect_timeout=CONNECT_TIMEOUT_SECONDS
                ))

        # Validate before returning; discard and retry once if stale
        if not _validate_connection(conn):
            logger.warning(f"Stale connection detected for domain '{domain}', discarding and retrying")
            _untag_conn(conn)
            try:
                pool.putconn(conn, close=True)
            except Exception:
                try:
                    conn.close()
                except Exception:
                    pass
            try:
                conn = pool.getconn()
                _tag_conn(conn)
            except Exception:
                creds = DOMAIN_CREDENTIALS.get(domain, DOMAIN_CREDENTIALS["engenharia"])
                return _tag_conn(psycopg2.connect(
                    host=DB_HOST, port=DB_PORT, dbname=creds["dbname"],
                    user=creds["user"], password=creds["pass"],
                    connect_timeout=CONNECT_TIMEOUT_SECONDS
                ))
            if not _validate_connection(conn):
                logger.error(f"Retried connection for domain '{domain}' is still stale")
        return conn

    creds = DOMAIN_CREDENTIALS.get(domain, DOMAIN_CREDENTIALS["engenharia"])
    return _tag_conn(psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=creds["dbname"],
        user=creds["user"], password=creds["pass"],
        connect_timeout=CONNECT_TIMEOUT_SECONDS
    ))

def get_write_connection():
    if write_pool:
        try:
            conn = write_pool.getconn()
            _tag_conn(conn)
            if _is_expired(conn):
                _untag_conn(conn)
                write_pool.putconn(conn, close=True)
                conn = write_pool.getconn()
                _tag_conn(conn)
            return conn
        except Exception as ex:
            logger.warning(f"Write pool connection fallback: {ex}")
    return _tag_conn(psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
        user=DB_WRITE_USER, password=DB_WRITE_PASS
    ))

def release_connection(conn, domain: str = "engenharia"):
    if not conn:
        return
    pool = pools.get(domain)
    if pool:
        try:
            if getattr(conn, "closed", 0) != 0:
                _untag_conn(conn)
                pool.putconn(conn, close=True)
            else:
                try:
                    conn.rollback()
                except Exception:
                    pass
                pool.putconn(conn)
        except Exception:
            _untag_conn(conn)
            try:
                conn.close()
            except Exception:
                pass
    else:
        _untag_conn(conn)
        try:
            conn.close()
        except Exception:
            pass

def release_write_connection(conn):
    if not conn:
        return
    if write_pool:
        try:
            if getattr(conn, "closed", 0) != 0:
                _untag_conn(conn)
                write_pool.putconn(conn, close=True)
            else:
                try:
                    conn.rollback()
                except Exception:
                    pass
                write_pool.putconn(conn)
        except Exception:
            _untag_conn(conn)
            try:
                conn.close()
            except Exception:
                pass
    else:
        _untag_conn(conn)
        try:
            conn.close()
        except Exception:
            pass
