"""Testes do Deserto Veterinário Explicável v2 — regra publicada preservada."""
from unittest.mock import patch
import os

os.environ.setdefault("DB_PASS", "test-only")
os.environ.setdefault("DB_AGRO_USER", "test-only")
os.environ.setdefault("DB_AGRO_PASS", "test-only")
os.environ.setdefault("DB_LOG_USER", "test-only")
os.environ.setdefault("DB_LOG_PASS", "test-only")
os.environ.setdefault("DB_SAUDE_USER", "test-only")
os.environ.setdefault("DB_SAUDE_PASS", "test-only")
os.environ.setdefault("DB_WRITE_PASS", "test-only")
os.environ.setdefault("WINS_INTERNAL_SECRET", "test-only-secret")

import agro_canal_repository as repo


def _row(**extra):
    base = {
        "codigo_ibge": 5107909,
        "municipio": "Sinop",
        "uf": "MT",
        "latitude": -11.86,
        "longitude": -55.5,
        "classificacao": "DESERTO_VET",
        "bovinos_municipio": 50000,
        "bovinos_75km": 800000,
        "tecnicos_75km": 10,
        "carga_regional": 80000,
    }
    base.update(extra)
    return base


def test_rule_constants_match_published_thresholds():
    assert repo.DESERTO_THRESHOLDS["piso_bovinos_municipio"] == 1000
    assert repo.DESERTO_THRESHOLDS["carga_deserto"] == 40000
    assert repo.DESERTO_THRESHOLDS["carga_baixa"] == 15000
    assert repo.DESERTO_THRESHOLDS["raio_km"] == 75
    assert repo.DESERTO_TECHNICAL_SCOPE == "KNOWN_TECHNICAL_PRESENCE"
    assert "7500100" in repo.DESERTO_TECHNICAL_CNAES
    assert repo.DESERTO_CATTLE_YEAR == 2023


def test_reasons_mirror_case_order():
    assert repo._deserto_reason(999, 0, None) == "CATTLE_BELOW_MINIMUM"
    assert repo._deserto_reason(5000, 0, None) == "NO_KNOWN_ELIGIBLE_TECHNICAL_PRESENCE"
    assert repo._deserto_reason(5000, 1, 40000) == "RATIO_AT_OR_ABOVE_HIGH_THRESHOLD"
    assert repo._deserto_reason(5000, 1, 15000) == "RATIO_AT_OR_ABOVE_LOW_THRESHOLD"
    assert repo._deserto_reason(5000, 2, 14999) == "RATIO_BELOW_LOW_THRESHOLD"


def test_zero_tech_ratio_null_not_infinity():
    item = repo._enrich_deserto_row(_row(tecnicos_75km=0, carga_regional=None, classificacao="DESERTO_VET"))
    assert item["ratio"] is None
    assert item["ratio_status"] == "NOT_CALCULABLE_ZERO_DENOMINATOR"
    assert item["carga_regional"] is None
    assert item["classification_reason"] == "NO_KNOWN_ELIGIBLE_TECHNICAL_PRESENCE"
    assert "não existem veterinários" not in (item.get("classification_reason_text") or "").lower()
    assert "identificada na base" in item["classification_reason_text"]


def test_enrich_includes_year_scope_and_rule_version():
    item = repo._enrich_deserto_row(_row())
    assert item["cattle_reference_year"] == 2023
    assert item["technical_scope"] == "KNOWN_TECHNICAL_PRESENCE"
    assert item["rule_version"] == repo.DESERTO_RULE_VERSION
    assert item["geographic_method"] == repo.DESERTO_GEOGRAPHIC_METHOD
    assert item["classification_label"] == "Deserto Veterinário"


def test_deserto_lista_paginacao_e_enriquecimento():
    with patch.object(repo, "_query", side_effect=[[{"total": 51}], [_row()]]) as query:
        result = repo.AgroCanalRepository.deserto(page=2, page_size=25)
    assert result["total"] == 51 and result["total_pages"] == 3 and result["page"] == 2
    assert result["classification_rule_changed"] is False
    assert result["items"][0]["classification_reason"]
    assert result["items"][0]["cattle_reference_year"] == 2023
    assert "LIMIT" in query.call_args_list[1].args[0]
    assert "v_white_space_pecuaria" in query.call_args_list[0].args[0]


def test_deserto_filtros_e_sort_whitelist():
    with patch.object(repo, "_query", side_effect=[[{"total": 0}], []]) as query:
        repo.AgroCanalRepository.deserto(uf="MT", classificacao="DESERTO_VET", sort="DROP TABLE", order="boom")
    sql = query.call_args_list[1].args[0]
    assert "w.uf=%s" in sql
    assert "replace(w.classificacao_vet" in sql
    assert "ORDER BY w.nome" in sql
    assert "DROP TABLE" not in sql


def test_deserto_stats_soma_e_legado():
    rows = [
        {"classificacao": "DESERTO_VET", "municipios": 539, "bovinos": 1, "tecnicos": 10, "municipios_zero_tec": 41},
        {"classificacao": "BAIXA_COBERTURA", "municipios": 829, "bovinos": 2, "tecnicos": 20, "municipios_zero_tec": 0},
        {"classificacao": "NORMAL", "municipios": 4168, "bovinos": 3, "tecnicos": 70, "municipios_zero_tec": 0},
    ]
    with patch.object(repo, "_query", return_value=rows):
        result = repo.AgroCanalRepository.deserto_stats()
    assert result["total_municipios"] == 5536
    assert result["deserto_vet_municipios"] == 539
    assert result["baixa_cobertura_municipios"] == 829
    assert result["normal_municipios"] == 4168
    assert result["soma_classes_ok"] is True
    assert result["municipios_avaliados"] == 5536
    assert result["classification_rule_changed"] is False
    assert result["cattle_reference_year"] == 2023
    assert result["presenca_tecnica_conhecida"]["municipios_sem_presenca_conhecida"] == 41
    assert result["presenca_tecnica_conhecida"]["slots_regionais_somados"] == 100

def test_deserto_mapa_filtra_bounds_brasil():
    rows = [
        _row(codigo_ibge=1, latitude=-14.0, longitude=-51.0),
        _row(codigo_ibge=2, latitude=50.0, longitude=10.0),  # fora
        _row(codigo_ibge=3, latitude=None, longitude=None),
    ]
    with patch.object(repo, "_query", side_effect=[[{"total": 3}], rows]):
        result = repo.AgroCanalRepository.deserto(formato="mapa", page_size=5000)
    assert result["aggregation"] == "MUNICIPAL"
    assert all(-33.75 <= float(x["latitude"]) <= 5.27 for x in result["items"])
    assert result["returned"] == 1


def test_deserto_detalhe_e_404_path():
    with patch.object(repo, "_query", return_value=[_row(tecnicos_75km=0, carga_regional=None)]):
        item = repo.AgroCanalRepository.deserto_detalhe("5107909")
    assert item["codigo_ibge"] == 5107909
    assert item["decision_explanation"]["reason"] == "NO_KNOWN_ELIGIBLE_TECHNICAL_PRESENCE"
    assert item["crmv_policy"] == "NOT_VALIDATED"
    assert item["technical_types_included"]
    assert any(t["cnae"] == "7500100" for t in item["technical_types_included"])
    with patch.object(repo, "_query", return_value=[]):
        assert repo.AgroCanalRepository.deserto_detalhe("0000000") is None


def test_metodologia_flags_and_scope():
    meta = repo.AgroCanalRepository.deserto_metodologia()
    assert meta["classification_rule_changed"] is False
    assert meta["rule_status"] == "VALIDATED_WITH_SEMANTIC_FIX"
    assert meta["technical_presence"]["definition"] == "KNOWN_TECHNICAL_PRESENCE"
    assert meta["technical_presence"]["crmv"] == "NOT_USED_IN_RULE"
    assert meta["geography"]["mv_tecnico_geo"] == "ABSENT"
    assert meta["cattle"]["year"] == 2023
    assert meta["radar_consumption"]["parity_required"] is True


def test_permission_denied_not_masked_as_empty():
    with patch.object(repo, "_query", side_effect=RuntimeError("permission denied for relation")):
        try:
            repo.AgroCanalRepository.deserto()
            assert False, "expected raise"
        except RuntimeError as exc:
            assert "permission denied" in str(exc)


def test_pool_is_agro_legacy_for_deserto_objects():
    # Deserto objects live under prospeccao / cnpj — authorized via agro_legacy pool
    src = open(repo.__file__, encoding="utf-8").read()
    assert 'get_connection("agro_legacy")' in src
    assert "v_white_space_pecuaria" in src
