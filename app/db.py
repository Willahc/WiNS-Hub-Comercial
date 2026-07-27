"""Camada de acesso a dados do Hub — pool de conexões + helpers de query.

Extraído do main.py (Fase 1 da modularização): o monolito e os futuros routers
importam daqui em vez de cada um abrir conexão. Sem dependência de `main` (evita
import circular). Os nomes/assinaturas são idênticos aos antigos — os call-sites
no main.py não mudaram, só passaram a importar daqui.
"""
import os
from contextlib import contextmanager

import psycopg2
import psycopg2.errors
import psycopg2.extras
from psycopg2 import pool as pgpool


class QueryTimeoutError(Exception):
    """Query cancelada por statement_timeout. Não retentar."""
    pass

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "db"),
    "port": int(os.getenv("DB_PORT", 5432)),
    "dbname": os.getenv("POSTGRES_DB", "wins_agro"),
    # least-privilege: a app conecta como DB_USER (wins_app, só DML nos schemas de
    # negócio) — POSTGRES_USER/PASSWORD ficam só p/ o container do banco (superuser).
    "user": os.getenv("DB_USER") or os.getenv("POSTGRES_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD") or os.getenv("POSTGRES_PASSWORD", ""),
}

# Pool de conexões (reaproveita conexões em vez de abrir uma nova por query).
_POOL = None


def _get_pool():
    global _POOL
    if _POOL is None:
        _POOL = pgpool.ThreadedConnectionPool(1, 12, **DB_CONFIG)
    return _POOL


def _fetch(sql, params, dict_rows, timeout_s=None):
    """Executa um SELECT usando o pool. Só leitura -> autocommit (sem transações
    pendentes). Em conexão morta (OperationalError), descarta e tenta 1x de novo.
    Se timeout_s definido, aplica statement_timeout na conexão e restaura depois."""
    pool = _get_pool()
    err = None
    for _ in range(2):
        conn = pool.getconn()
        try:
            conn.autocommit = True
            cur = (conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
                   if dict_rows else conn.cursor())
            if timeout_s is not None:
                cur.execute(f"SET statement_timeout = {int(timeout_s * 1000)}")
            cur.execute(sql, params or {})
            rows = cur.fetchall()
            if timeout_s is not None:
                try:
                    cur.execute("SET statement_timeout = DEFAULT")
                except Exception:
                    pass
            pool.putconn(conn)
            return rows
        except psycopg2.errors.QueryCanceled as e:
            try:
                conn.rollback()
            except Exception:
                pass
            if timeout_s is not None:
                pool.putconn(conn, close=True)
                raise QueryTimeoutError("A consulta excedeu o tempo máximo permitido.") from e
            err = e
            try:
                pool.putconn(conn, close=True)
            except Exception:
                pass
        except psycopg2.OperationalError as e:
            err = e
            try:
                pool.putconn(conn, close=True)  # conexão morta -> remove do pool
            except Exception:
                pass
        except Exception:
            try:
                pool.putconn(conn)
            except Exception:
                pass
            raise
    raise err


def query(sql, params=None, timeout_s=None):
    """Run a SELECT and return a list of dict rows (decimals cast to float).
    timeout_s: opcional, segundos máximos antes de cancelar a query."""
    result = []
    for row in _fetch(sql, params, True, timeout_s=timeout_s):
        d = dict(row)
        for k, v in d.items():
            # JSON-serialize numeric/Decimal as float
            if v.__class__.__name__ == "Decimal":
                d[k] = float(v)
        result.append(d)
    return result


def scalar(sql, params=None):
    return _fetch(sql, params, False)[0][0]


@contextmanager
def _tx():
    """Transação de escrita via pool: commit no sucesso, rollback no erro."""
    pool = _get_pool()
    conn = pool.getconn()
    closed = False
    try:
        conn.autocommit = False
        yield conn
        conn.commit()
    except Exception:
        try:
            conn.rollback()
        except Exception:
            closed = True
        raise
    finally:
        try:
            pool.putconn(conn, close=closed)
        except Exception:
            pass


def _cur(conn):
    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
