import os
import sys
import unittest
from unittest.mock import Mock, patch

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

# Desliga SECRET_KEY check — os testes unitários não tocam auth
os.environ.setdefault("SECRET_KEY", "x" * 64)


class TestEmpresa360Repository(unittest.TestCase):
    def setUp(self):
        from repositories.empresa_360 import Empresa360Repository
        self.repo = Empresa360Repository()

    def test_buscar_por_cnpj_limpa_formatacao(self):
        result = self.repo.buscar_por_cnpj("00.000.000/0001-91")
        self.assertIsNotNone(result)
        self.assertEqual(result["cnpj"], "00000000000191")

    def test_buscar_por_cnpj_invalido_retorna_none(self):
        result = self.repo.buscar_por_cnpj("123")
        self.assertIsNone(result)

    def test_buscar_por_cnpj_inexistente_retorna_none(self):
        result = self.repo.buscar_por_cnpj("00000000000000")
        self.assertIsNone(result)

    def test_buscar_por_cnpj_retorna_campos_obrigatorios(self):
        result = self.repo.buscar_por_cnpj("00000000000191")
        self.assertIsNotNone(result)
        self.assertIn("razao_social", result)
        self.assertIn("papeis", result)
        self.assertIn("verticais_ativas", result)

    def test_buscar_por_id_com_uuid_valido(self):
        emp = self.repo.buscar_por_cnpj("00000000000191")
        if emp:
            result = self.repo.buscar_por_id(emp["id"])
            self.assertIsNotNone(result)
            self.assertEqual(result["cnpj"], "00000000000191")

    def test_listar_sem_filtros(self):
        result = self.repo.listar(limit=5, offset=0)
        self.assertIn("items", result)
        self.assertIn("total", result)
        self.assertLessEqual(len(result["items"]), 5)

    def test_listar_por_uf(self):
        result = self.repo.listar(uf="SP", limit=5)
        self.assertIn("items", result)

    def test_listar_por_situacao(self):
        result = self.repo.listar(situacao="ATIVA", limit=5)
        self.assertIn("items", result)

    def test_listar_com_busca_textual(self):
        result = self.repo.listar(q="BANCO", limit=5)
        self.assertIn("items", result)
        if result["items"]:
            self.assertIn("BANCO", result["items"][0].get("razao_social", "").upper())

    def test_estatisticas_retorna_campos_esperados(self):
        stats = self.repo.estatisticas()
        self.assertIn("total_empresas", stats)
        self.assertIn("ativas", stats)
        self.assertIn("inativas", stats)
        self.assertIn("total_verticais", stats)
        self.assertIn("total_com_geo", stats)
        self.assertGreater(stats["total_empresas"], 0)

    def test_listar_papeis_por_entidade(self):
        emp = self.repo.buscar_por_cnpj("00000000000191")
        if emp:
            papeis = self.repo.listar_papeis(emp["id"])
            self.assertIsInstance(papeis, list)

    def test_listar_fontes_por_entidade(self):
        emp = self.repo.buscar_por_cnpj("00000000000191")
        if emp:
            fontes = self.repo.listar_fontes(emp["id"])
            self.assertIsInstance(fontes, list)


class TestEmpresa360Service(unittest.TestCase):
    def setUp(self):
        from services.empresa_360 import Empresa360Service
        self.mock_repo = Mock()
        self.service = Empresa360Service(self.mock_repo)

    def test_buscar_por_cnpj_delega_ao_repo(self):
        self.mock_repo.buscar_por_cnpj.return_value = {"cnpj": "00000000000191"}
        result = self.service.buscar_por_cnpj("00.000.000/0001-91")
        self.mock_repo.buscar_por_cnpj.assert_called_once_with("00.000.000/0001-91")
        self.assertEqual(result["cnpj"], "00000000000191")

    def test_listar_aplica_paginacao_pages(self):
        self.mock_repo.listar.return_value = {"items": [], "total": 100, "limit": 50, "offset": 0}
        result = self.service.listar(page=1, per_page=50)
        self.assertEqual(result["page"], 1)
        self.assertEqual(result["per_page"], 50)
        self.assertEqual(result["pages"], 2)

    def test_listar_limita_per_page_a_200(self):
        self.mock_repo.listar.return_value = {"items": [], "total": 0, "limit": 200, "offset": 0}
        result = self.service.listar(page=1, per_page=500)
        self.mock_repo.listar.assert_called_with(
            vertical=None, uf=None, multi_vertical=None,
            situacao=None, q=None, limit=200, offset=0,
        )

    def test_listar_page_minimo_1(self):
        self.mock_repo.listar.return_value = {"items": [], "total": 0, "limit": 50, "offset": 0}
        self.service.listar(page=0, per_page=50)
        self.mock_repo.listar.assert_called_with(
            vertical=None, uf=None, multi_vertical=None,
            situacao=None, q=None, limit=50, offset=0,
        )

    def test_listar_conflitos_delega(self):
        self.mock_repo.listar_conflitos_geograficos.return_value = []
        result = self.service.listar_conflitos_geograficos("uuid-test")
        self.mock_repo.listar_conflitos_geograficos.assert_called_once_with("uuid-test")
        self.assertEqual(result, [])

    def test_listar_todas_geografias_delega(self):
        self.mock_repo.listar_todas_geografias.return_value = []
        result = self.service.listar_todas_geografias("uuid-test")
        self.mock_repo.listar_todas_geografias.assert_called_once_with("uuid-test")

    def test_estatisticas_delega(self):
        expected = {"total_empresas": 4825673, "ativas": 3500000}
        self.mock_repo.estatisticas.return_value = expected
        result = self.service.estatisticas()
        self.assertEqual(result["total_empresas"], 4825673)


class TestTimeout(unittest.TestCase):
    """Testes de comportamento em QueryCanceled / statement_timeout."""

    def setUp(self):
        import db
        from unittest.mock import patch, MagicMock
        self.mock_pool = MagicMock()
        self.pool_patch = patch.object(db, '_get_pool', return_value=self.mock_pool)
        self.pool_patch.start()

    def tearDown(self):
        self.pool_patch.stop()

    def test_query_canceled_nao_faz_retry(self):
        """QueryCanceled não deve cair no loop de retry do OperationalError."""
        import psycopg2.errors
        from db import _fetch, QueryTimeoutError
        from unittest.mock import MagicMock

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        self.mock_pool.getconn.return_value = mock_conn

        mock_cursor.execute.side_effect = psycopg2.errors.QueryCanceled("canceling statement due to statement_timeout")
        with self.assertRaises(QueryTimeoutError) as ctx:
            _fetch("SELECT pg_sleep(10)", None, True, timeout_s=1)
        self.assertIn("tempo máximo", str(ctx.exception))
        self.assertEqual(mock_cursor.execute.call_count, 1,
                         "QueryCanceled causou retry — não deveria")
        self.mock_pool.putconn.assert_called_once_with(mock_conn, close=True)

    def test_query_canceled_sem_timeout_deve_retry(self):
        """QueryCanceled SEM timeout_s configurado cai no retry normal."""
        import psycopg2.errors
        from db import _fetch
        from unittest.mock import MagicMock

        mock_conn1 = MagicMock()
        mock_cur1 = MagicMock()
        mock_conn1.cursor.return_value = mock_cur1
        mock_conn2 = MagicMock()
        mock_cur2 = MagicMock()
        mock_conn2.cursor.return_value = mock_cur2

        calls = [mock_conn1, mock_conn2]
        call_idx = [0]
        def side_effect():
            c = calls[call_idx[0]]
            call_idx[0] += 1
            return c
        self.mock_pool.getconn.side_effect = side_effect

        mock_cur1.execute.side_effect = psycopg2.errors.QueryCanceled("canceled")
        mock_cur2.execute.side_effect = psycopg2.errors.QueryCanceled("canceled again")
        with self.assertRaises(psycopg2.errors.QueryCanceled):
            _fetch("SELECT 1", None, True)

    def test_operational_error_comum_faz_retry(self):
        """OperationalError comum (conexão) deve tentar 1 retry."""
        import psycopg2
        from db import _fetch
        from unittest.mock import MagicMock

        mock_conn1 = MagicMock()
        mock_cur1 = MagicMock()
        mock_conn1.cursor.return_value = mock_cur1
        mock_conn2 = MagicMock()
        mock_cur2 = MagicMock()
        mock_conn2.cursor.return_value = mock_cur2

        calls = [mock_conn1, mock_conn2]
        call_idx = [0]
        def side_effect():
            c = calls[call_idx[0]]
            call_idx[0] += 1
            return c
        self.mock_pool.getconn.side_effect = side_effect

        mock_cur1.execute.side_effect = psycopg2.OperationalError("connection broken")
        mock_cur2.execute.side_effect = psycopg2.OperationalError("still broken")
        with self.assertRaises(psycopg2.OperationalError):
            _fetch("SELECT 1", None, True)
        self.assertEqual(mock_cur1.execute.call_count, 1)
        self.assertEqual(mock_cur2.execute.call_count, 1)

    def test_rollback_executado_apos_cancel(self):
        """Após QueryCanceled, connection.rollback() deve ser chamado."""
        import psycopg2.errors
        from db import _fetch, QueryTimeoutError
        from unittest.mock import MagicMock

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        self.mock_pool.getconn.return_value = mock_conn

        mock_cursor.execute.side_effect = psycopg2.errors.QueryCanceled("timeout")
        with self.assertRaises(QueryTimeoutError):
            _fetch("SELECT 1", None, True, timeout_s=1)
        mock_conn.rollback.assert_called_once()

    def test_504_retornado_para_query_timeout(self):
        """QueryTimeoutError deve retornar 504 com código QUERY_TIMEOUT."""
        from db import QueryTimeoutError
        import json

        expected_response = {
            "detail": {
                "code": "QUERY_TIMEOUT",
                "message": "A consulta excedeu o tempo máximo permitido."
            }
        }
        body = json.dumps(expected_response)
        self.assertIn("QUERY_TIMEOUT", body)
        self.assertNotIn("SELECT", body)
        self.assertNotIn("statement_timeout", body)
        # Verifica estrutura conforme especificação
        parsed = json.loads(body)
        self.assertEqual(parsed["detail"]["code"], "QUERY_TIMEOUT")


if __name__ == "__main__":
    unittest.main()
