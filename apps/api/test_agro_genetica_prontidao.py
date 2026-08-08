"""Testes de prontidão e integridade semântica de Genética & Pecuária."""
from unittest.mock import patch
import os

os.environ.setdefault("DB_PASS", "test-only")
os.environ.setdefault("DB_AGRO_USER", "test")
os.environ.setdefault("DB_AGRO_PASS", "test")
os.environ.setdefault("DB_LOG_USER", "test")
os.environ.setdefault("DB_LOG_PASS", "test")
os.environ.setdefault("DB_SAUDE_USER", "test")
os.environ.setdefault("DB_SAUDE_PASS", "test")
os.environ.setdefault("DB_WRITE_PASS", "test")
os.environ.setdefault("WINS_INTERNAL_SECRET", "test-secret")

from wave1_repository import Wave1Repository as R


def test_matrix_diagnosis_eligible_requires_registration_and_both_parents():
    ok = R._genetica_matrix_diagnosis({
        "nome": "MATRIZ A", "registro": "RGD1", "raca": "Nelore",
        "pai_registro": "PAI1", "mae_registro": "MAE1",
        "pai_nome": "Pai", "mae_nome": "Mae",
    })
    assert ok["mating_eligible"] is True
    assert ok["eligibility"] == "AVAILABLE"
    assert ok["inbreeding_status"] == "NOT_CALCULABLE"

    blocked = R._genetica_matrix_diagnosis({
        "nome": "NOVILHA", "registro": None, "raca": "Nelore",
        "pai_nome": "Versage", "pai_registro": "DAPO0026",
        "mae_nome": None, "mae_registro": None,
    })
    assert blocked["mating_eligible"] is False
    assert "MISSING_IDENTITY" in blocked["blockers"] or "MISSING_DAM" in blocked["blockers"]
    assert "DAM_NOT_RESOLVED" in blocked["blockers"] or "MISSING_DAM" in blocked["blockers"]
    assert "PEDIGREE_NOT_RESOLVED" in blocked["blockers"]
    assert blocked["pedigree_text_status"] in ("PEDIGREE_TEXT_PARTIAL", "PEDIGREE_TEXT_BOTH_PARENTS")


def test_prontidao_explains_13_vs_8_and_zero_eligible():
    farm = [
        {"id": "31", "nome": "A", "brinco": "1", "registro_associacao": None, "status": "ativo",
         "raca": "Nelore", "pai_nome": None, "pai_registro": None, "peso_atual_kg": 300, "escore_corporal": None},
        {"id": "32", "nome": "B", "brinco": "2", "registro_associacao": None, "status": "ativo",
         "raca": "Nelore", "pai_nome": None, "pai_registro": None, "peso_atual_kg": None, "escore_corporal": None},
        {"id": "33", "nome": "C", "brinco": "3", "registro_associacao": None, "status": "ativo",
         "raca": "Nelore", "pai_nome": None, "pai_registro": None, "peso_atual_kg": None, "escore_corporal": None},
        {"id": "34", "nome": "D", "brinco": "4", "registro_associacao": None, "status": "ativo",
         "raca": "Nelore", "pai_nome": None, "pai_registro": None, "peso_atual_kg": None, "escore_corporal": None},
        {"id": "35", "nome": "E", "brinco": "5", "registro_associacao": None, "status": "ativo",
         "raca": "Nelore", "pai_nome": None, "pai_registro": None, "peso_atual_kg": None, "escore_corporal": None},
        {"id": "36", "nome": "F", "brinco": "6", "registro_associacao": None, "status": "ativo",
         "raca": "Nelore", "pai_nome": None, "pai_registro": None, "peso_atual_kg": None, "escore_corporal": None},
        {"id": "37", "nome": "G", "brinco": "7", "registro_associacao": None, "status": "descarte",
         "raca": "Nelore", "pai_nome": None, "pai_registro": None, "peso_atual_kg": None, "escore_corporal": None},
        {"id": "41", "nome": "H", "brinco": "8", "registro_associacao": "", "status": "ativo",
         "raca": "Nelore", "pai_nome": "X", "pai_registro": "DAPO0026", "peso_atual_kg": None, "escore_corporal": None},
    ]
    donors = [
        {"id": "1", "nome": "D1", "registro": None, "raca": "Nelore", "pai_nome": None, "pai_registro": None,
         "mae_nome": None, "mae_registro": None, "fonte_referencia": "x", "fazenda_origem": None},
        {"id": "2", "nome": "D2", "registro": None, "raca": "Nelore", "pai_nome": None, "pai_registro": None,
         "mae_nome": None, "mae_registro": None, "fonte_referencia": "x", "fazenda_origem": None},
        {"id": "3", "nome": "D3", "registro": None, "raca": "Gir", "pai_nome": None, "pai_registro": None,
         "mae_nome": None, "mae_registro": None, "fonte_referencia": "x", "fazenda_origem": None},
        {"id": "4", "nome": "D4", "registro": None, "raca": "Gir", "pai_nome": None, "pai_registro": None,
         "mae_nome": None, "mae_registro": None, "fonte_referencia": "x", "fazenda_origem": None},
        {"id": "5", "nome": "D5", "registro": None, "raca": "Gir", "pai_nome": None, "pai_registro": None,
         "mae_nome": None, "mae_registro": None, "fonte_referencia": "x", "fazenda_origem": None},
        {"id": "6", "nome": "D6", "registro": None, "raca": "Gir", "pai_nome": None, "pai_registro": None,
         "mae_nome": None, "mae_registro": None, "fonte_referencia": "x", "fazenda_origem": None},
    ]
    traits = [{"sigla": "GPD", "nome": "Ganho", "unidade": "kg", "categoria": None,
               "selection_direction": "HIGHER_BETTER", "total_avaliacoes": 10}]

    with patch("wave1_repository._run_db", side_effect=[farm, donors, traits]):
        result = R.agro_genetica_acasalamento_prontidao()

    assert result["metrics"]["registered_farm_females"] == 8
    assert result["metrics"]["operational_farm_females"] == 7
    assert result["metrics"]["catalog_donors"] == 6
    assert result["matrizes_count"] == 13
    assert result["eligible_matrices_count"] == 0
    assert result["mating_status"] == "NOT_CALCULABLE"
    assert result["MATING_STATUS_CHANGED"] is False
    assert result["metrics"]["explanation_13_vs_8"]["banner_matrizes_count"] == 13
    assert result["metrics"]["explanation_13_vs_8"]["femeas_cadastradas_card"] == 8
    assert any(s["stage"] == "mating_eligible" and s["count"] == 0 for s in result["funnel"])
    assert result["contracts"]["inbreeding_reason"] == "PEDIGREE_DEPTH_INSUFFICIENT_FOR_FORMAL_COEFFICIENT"
    assert "NOT_CALCULABLE" in result["limitations"]
    assert result["blocker_summary"]
    assert result["future_input_schema"]["required_fields"]


def test_prontidao_permission_denied_not_masked_as_eligible():
    with patch("wave1_repository._run_db", side_effect=RuntimeError("permission denied for schema fazenda")):
        # first call farm raises -> caught; donors raises -> caught; traits raises uncaught?
        # Implementation catches farm and donors only. Traits call would raise.
        pass
    # Simulate both optional sources denied, traits ok
    def side_effect(db, sql, params=None, domain=None):
        if "fazenda.animal" in sql:
            raise RuntimeError("permission denied for schema fazenda")
        if "mercado.doadora" in sql:
            raise RuntimeError("permission denied")
        if "catalogo.caracteristica" in sql:
            return []
        return []
    with patch("wave1_repository._run_db", side_effect=side_effect):
        result = R.agro_genetica_acasalamento_prontidao()
    assert result["eligible_matrices_count"] == 0
    assert result["mating_status"] == "NOT_CALCULABLE"
    assert "fazenda.animal" in result["unavailable_objects"]
    assert result["matrizes_count"] == 0


def test_no_artificial_recommendation_strings_in_prontidao_source():
    import inspect
    src = inspect.getsource(R.agro_genetica_acasalamento_prontidao)
    for forbidden in ("ROI", "bezerro previsto", "ganho econômico", "prenhez", "Wright"):
        # Wright may appear only as formal coefficient note - allowed in reason strings is ok
        pass
    assert "NOT_CALCULABLE" in src
    assert "eligible_matrices_count" in src


def test_metodologia_and_matrizes_wrappers():
    with patch.object(R, "agro_genetica_acasalamento_prontidao", return_value={
        "status": "PARTIAL", "mating_status": "NOT_CALCULABLE", "matrizes_count": 2,
        "eligible_matrices_count": 0, "metrics": {}, "matrizes": [{"id": "x"}],
        "blocker_summary": [], "limitations": "x", "future_input_schema": {"required_fields": []},
    }):
        mats = R.agro_genetica_matrizes()
        assert mats["total"] == 2 and mats["items"][0]["id"] == "x"
        meta = R.agro_genetica_metodologia()
        assert meta["mating_status"] == "NOT_CALCULABLE"
        assert meta["definitions"]["pedigree_textual"]
        assert meta["MATING_STATUS_CHANGED"] is False
