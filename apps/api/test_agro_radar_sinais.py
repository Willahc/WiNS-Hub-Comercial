"""Testes comportamentais do Radar de Sinais e Oportunidades Agro.

Seguem o padrão do restante do módulo Agro (test_agro_canal_tecnico.py):
variáveis de ambiente definidas para o módulo de banco, queries reais mockadas
e nenhuma dependência de banco ou rede. Validam o contrato fail-closed do motor
em VALIDATION sem acessar o PostgreSQL.
"""

import os
import re
from unittest.mock import patch

os.environ.setdefault("DB_PASS", "test-only")
os.environ.setdefault("DB_AGRO_USER", "test-only")
os.environ.setdefault("DB_AGRO_PASS", "test-only")
os.environ.setdefault("DB_LOG_USER", "test-only")
os.environ.setdefault("DB_LOG_PASS", "test-only")
os.environ.setdefault("DB_SAUDE_USER", "test-only")
os.environ.setdefault("DB_SAUDE_PASS", "test-only")
os.environ.setdefault("DB_WRITE_PASS", "test-only")

import agro_radar_repository as repo

DESERTO = {
    "codigo_ibge": 5107909,
    "nome": "Vila Bela da Santíssima Trindade",
    "uf": "MT",
    "bovinos": 220000,
    "tecnicos_75km": 3,
    "bovinos_75km": 1200000,
    "carga_regional": 12000,
    "classification": "DESERTO_VET",
}
BAIXA = {
    "codigo_ibge": 5208707,
    "nome": "Goiânia",
    "uf": "GO",
    "bovinos": 120000,
    "tecnicos_75km": 8,
    "bovinos_75km": 900000,
    "carga_regional": 8000,
    "classification": "BAIXA_COBERTURA",
}


def test_status_explicito_validacao_sem_fila_comercial():
    status = repo.AgroRadarRepository.status()
    assert status["engine_status"] == "VALIDATION"
    assert status["commercial_queue_available"] is False
    assert status["human_validation_available"] is False
    assert status["active_rules"] == 1
    assert status["available_stages"] == ["SIGNAL", "CANDIDATE", "VALIDATED"]


def test_array_vazio_nao_implica_motor_ativo():
    result = repo.AgroRadarRepository.candidates()
    assert result["engine_status"] == "VALIDATION"
    assert result["items"] == []
    assert "PROPERTY_IN_TECHNICAL_GAP_V1" in result["limitations"][0]


def test_sinal_municipal_real_e_prioridade():
    with patch.object(repo, "_query", side_effect=[[{"total": 2, "universe_total": 5536}], [DESERTO, BAIXA]]):
        result = repo.AgroRadarRepository.signals(page=1, page_size=25)
    assert result["engine_status"] == "VALIDATION"
    assert result["filtered_total"] == 2
    items = {i["entity_id"]: i for i in result["items"]}
    assert items["5107909"]["priority"] == "ALTA"
    assert items["5107909"]["classification"] == "DESERTO_VET"
    assert items["5208707"]["priority"] == "MEDIA"
    assert items["5208707"]["classification"] == "BAIXA_COBERTURA"
    assert all(i["stage"] == "SIGNAL" for i in result["items"])


def test_sinal_sem_score_sem_pessoa_sem_contato_sem_car():
    with patch.object(repo, "_query", side_effect=[[{"total": 1, "universe_total": 5536}], [DESERTO]]):
        result = repo.AgroRadarRepository.signals()
    item = result["items"][0]
    assert "score" not in item and "min_score" not in item
    assert "decisor" not in item and "contato" not in item and "telefone" not in item
    assert "car" not in item and "property_id" not in item
    assert item["actionability"] == "REQUIRES_ENRICHMENT"


def test_signal_id_estavel_e_nao_reversivel():
    with patch.object(repo, "_query", side_effect=[[{"total": 1, "universe_total": 5536}], [DESERTO]]):
        a = repo.AgroRadarRepository.signals()["items"][0]["signal_id"]
    with patch.object(repo, "_query", side_effect=[[{"total": 1, "universe_total": 5536}], [DESERTO]]):
        b = repo.AgroRadarRepository.signals()["items"][0]["signal_id"]
    assert a == b
    assert a.startswith("SIG-")
    assert len(a) == 4 + 20
    assert "5107909" not in a


def test_filtros_uf_classificacao_prioridade_e_q():
    with patch.object(repo, "_query", side_effect=[[{"total": 1, "universe_total": 5536}], [BAIXA]]) as query:
        repo.AgroRadarRepository.signals(uf="GO", classification="BAIXA_COBERTURA", priority="MEDIA", q="goiânia")
    sqls = [call.args[0] for call in query.call_args_list]
    assert "w.uf = %s" in sqls[0]
    assert "w.nome ILIKE %s" in sqls[0]
    assert "replace(w.classificacao_vet,' ','_') = %s" in sqls[0]


def test_prioridade_invalida_gera_filtro_falso_sem_dados_fabricados():
    with patch.object(repo, "_query", side_effect=[[{"total": 0, "universe_total": 5536}], []]) as query:
        result = repo.AgroRadarRepository.signals(priority="INVALIDA")
    assert result["filtered_total"] == 0
    assert "FALSE" in query.call_args_list[0].args[0]


def test_rule_id_desconhecido_nao_gera_sinais():
    with patch.object(repo, "_query") as query:
        result = repo.AgroRadarRepository.signals(rule_id="RULE_NAO_EXISTE")
    assert result["items"] == [] and result["filtered_total"] == 0
    query.assert_not_called()


def test_signal_type_desconhecido_nao_gera_sinais():
    with patch.object(repo, "_query") as query:
        result = repo.AgroRadarRepository.signals(signal_type="FERTILIZANTE")
    assert result["items"] == [] and result["filtered_total"] == 0
    query.assert_not_called()


def test_paginacao_whitelist_page_size_e_ordering_padrao():
    with patch.object(repo, "_query", side_effect=[[{"total": 51, "universe_total": 5536}], [DESERTO]]) as query:
        result = repo.AgroRadarRepository.signals(page=2, page_size=100)
    assert result["page"] == 2 and result["page_size"] == 100
    assert result["total_pages"] == 1 and result["has_previous"] is True
    order_sql = query.call_args_list[1].args[0]
    assert "DESERTO_VET' THEN 1 ELSE 2 END DESC" in order_sql
    assert "w.carga_regional DESC NULLS LAST" in order_sql


def test_page_size_invalido_cai_para_25():
    with patch.object(repo, "_query", side_effect=[[{"total": 0, "universe_total": 5536}], []]):
        result = repo.AgroRadarRepository.signals(page_size=30)
    assert result["page_size"] == 25


def test_sort_whitelist_bloqueia_sql_injection():
    with patch.object(repo, "_query", side_effect=[[{"total": 0, "universe_total": 5536}], []]) as query:
        repo.AgroRadarRepository.signals(sort="DROP TABLE; SELECT 1", order="boom")
    sql = query.call_args_list[1].args[0]
    assert "DROP TABLE" not in sql
    assert "SELECT 1" not in sql


def test_stage_nao_sinal_retorna_vazio_fail_closed():
    for stage in ("CANDIDATE", "VALIDATION", "VALIDATED"):
        with patch.object(repo, "_query") as query:
            result = repo.AgroRadarRepository.signals(stage=stage)
        assert result["engine_status"] == "VALIDATION"
        assert result["items"] == [] and result["filtered_total"] == 0
        query.assert_not_called()


def test_funil_real_com_contagens_e_motivos_null():
    rows = [
        {"classification": "DESERTO_VET", "total": 539},
        {"classification": "BAIXA_COBERTURA", "total": 829},
        {"classification": "NORMAL", "total": 4168},
    ]
    with patch.object(repo, "_query", return_value=rows):
        result = repo.AgroRadarRepository.funnel()
    assert result["municipalities_evaluated"] == 5536
    assert result["signals_total"] == 1368
    assert result["deserto_vet_signals"] == 539
    assert result["low_coverage_signals"] == 829
    assert result["candidates_total"] == 0
    assert result["validation_total"] == 0
    assert result["validated_total"] == 0
    assert result["discarded_or_not_promoted"]["normal_coverage"] == 4168
    assert result["discarded_or_not_promoted"]["missing_entity"] is None
    assert result["discarded_or_not_promoted"]["rule_unavailable"] == 1368


def test_funil_erro_retorna_nulls_nao_zeros_falsos():
    with patch.object(repo, "_query", side_effect=RuntimeError("db")):
        result = repo.AgroRadarRepository.funnel()
    assert result["municipalities_evaluated"] is None
    assert result["signals_total"] is None
    assert result["deserto_vet_signals"] is None
    assert result["discarded_or_not_promoted"]["normal_coverage"] is None
    assert result["candidates_total"] == 0


def test_regras_ativas_planejadas_e_indisponiveis():
    result = repo.AgroRadarRepository.rules()
    rules = {r["rule_id"]: r for r in result["rules"]}
    assert rules["TECHNICAL_COVERAGE_GAP_MUNICIPAL_V1"]["status"] == "ACTIVE"
    assert rules["TECHNICAL_COVERAGE_GAP_MUNICIPAL_V1"]["produces_stage"] == "SIGNAL"
    assert rules["PROPERTY_IN_TECHNICAL_GAP_V1"]["status"] == "UNAVAILABLE"
    assert rules["PROPERTY_IN_TECHNICAL_GAP_V1"]["produces_stage"] == "CANDIDATE"
    assert "8,3M" in rules["PROPERTY_IN_TECHNICAL_GAP_V1"]["unavailable_reason"]
    assert rules["AGRO_COMPANY_IN_PRIORITY_TERRITORY_V1"]["status"] == "PLANNED"
    assert rules["TECHNICAL_CHANNEL_GAP_V1"]["status"] == "PLANNED"
    assert rules["GENETIC_DEMAND_MATCH_V1"]["status"] == "PLANNED"
    assert rules["AGRO_LOGISTICS_GAP_V1"]["status"] == "PLANNED"
    assert result["engine_status"] == "VALIDATION"


def test_candidata_fail_closed_mesmo_com_dados_mockados():
    result = repo.AgroRadarRepository.candidates(page=1, page_size=25, uf="MT")
    assert result["items"] == [] and result["filtered_total"] == 0
    assert result["source_object"] is None
    assert result["engine_status"] == "VALIDATION"


def test_erro_banco_retorna_status_partial_sem_dados_fabricados():
    with patch.object(repo, "_query", side_effect=RuntimeError("db")):
        result = repo.AgroRadarRepository.signals()
    assert result["status"] == "partial"
    assert result["items"] == [] and result["filtered_total"] == 0
    assert result["engine_status"] == "VALIDATION"


def test_queries_sao_readonly_com_timeout():
    source = open(repo.__file__).read()
    assert "conn.set_session(readonly=True" in source
    assert "statement_timeout" in source
    for forbidden in ("INSERT", "UPDATE", "DELETE", "DROP", "TRUNCATE", "CREATE TABLE"):
        assert not re.search(rf"\b{forbidden}\b", source)


def test_sinais_usam_fonte_real_sem_hardcode_de_rebanho():
    with patch.object(repo, "_query", side_effect=[[{"total": 1, "universe_total": 5536}], [DESERTO]]):
        result = repo.AgroRadarRepository.signals()
    item = result["items"][0]
    assert item["metrics"]["rebanho_bovino"] == 220000
    assert item["sources"] == ["prospeccao.v_white_space_pecuaria", "IBGE PPM 2023"]
