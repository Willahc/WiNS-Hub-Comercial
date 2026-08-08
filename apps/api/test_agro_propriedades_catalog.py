import os
from unittest.mock import patch
import pytest

for key in ("DB_PASS","DB_AGRO_USER","DB_AGRO_PASS","DB_LOG_USER","DB_LOG_PASS","DB_SAUDE_USER","DB_SAUDE_PASS","DB_WRITE_PASS","WINS_INTERNAL_SECRET"):
    os.environ.setdefault(key,"test-only")

import agro_properties_repository as repo
from agro_properties_repository import AgroPropertiesRepository


def base(**extra):
    row={"detail_id":"101","codigo_car":"CAR-101","municipio":"CUIABA","uf":"MT","codigo_ibge":"5103403",
         "area_ha":125.5,"latitude":-15.6,"longitude":-56.1,"updated_at":"2026-06-24"}
    return {**row,**extra}


def context(**extra):
    row={"codigo_ibge":"5103403","municipio":"CUIABA","uf":"MT","rebanho_municipal":50000,
         "presenca_tecnica_conhecida_75km":3,"carga_regional":16667,"classificacao_veterinaria":"BAIXA_COBERTURA",
         "latitude_municipal":-15.6,"longitude_municipal":-56.1}
    return {**row,**extra}


def test_total_real_paginacao_e_pool_separado():
    with patch.object(repo,"_query",side_effect=[[{"total":51}],[base()],[context()]]) as query:
        result=AgroPropertiesRepository.list(page=2,page_size=25)
    assert result["total"]==51 and result["total_pages"]==3 and result["page"]==2
    assert query.call_args_list[0].args[0]=="agro" and query.call_args_list[1].args[0]=="agro"
    assert query.call_args_list[2].args[0]=="agro_legacy"
    assert "v_white_space_pecuaria" not in query.call_args_list[1].args[1]


def test_filtros_uf_municipio_area_geografia_e_paginacao():
    with patch.object(repo,"_query",side_effect=[[{"total":1}],[base()],[context()]]) as query:
        result=AgroPropertiesRepository.list(uf="MT",municipio="CUIABA",area_min=10,area_max=200,
            geographic_quality="PROPERTY_COORDINATE",page_size=50)
    sql=query.call_args_list[0].args[1]
    for fragment in ("i.uf=%s","i.municipio ILIKE %s","i.area_total_ha >= %s","i.area_total_ha <= %s","i.latitude BETWEEN"):
        assert fragment in sql
    assert result["page_size"]==50


def test_coordenada_valida_missing_invalida_e_bounds_brasil():
    assert repo._geographic_quality(-15,-47)=="PROPERTY_COORDINATE"
    assert repo._geographic_quality(None,-47)=="MISSING"
    assert repo._geographic_quality(0,0)=="INVALID"
    assert repo._geographic_quality(40,-47)=="INVALID"


def test_item_nao_infere_producao_proprietario_ou_status():
    item=repo._base_item(base())
    assert item["record_semantics"]=="RURAL_PROPERTY_REGISTRATION"
    assert item["registration_status"] is None and item["registration_status_status"]=="NOT_AVAILABLE"
    assert "owner" not in item and "cpf" not in item and "producer" not in item
    assert "atividade produtiva" in item["limitations"][0]


def test_contexto_municipal_nao_vira_atributo_do_imovel():
    with patch.object(repo,"_query",side_effect=[[{"total":1}],[base()],[context()]]) as query:
        result=AgroPropertiesRepository.list()
    item=result["items"][0]
    assert item["municipal_context"]["scope"]=="MUNICIPAL"
    assert item["municipal_context"]["link_quality"]=="IBGE_CODE_EXACT"
    assert "classificacao_veterinaria" not in {k for k in item if k!="municipal_context"}


def test_permission_denied_enrichment_e_explicito_sem_zerar_catalogo():
    err=repo.psycopg2.errors.InsufficientPrivilege("permission denied")
    with patch.object(repo,"_query",side_effect=[[{"total":1}],[base()],err]):
        result=AgroPropertiesRepository.list()
    assert result["total"]==1 and len(result["items"])==1
    assert result["enrichment"]=={"status":"UNAVAILABLE","reason":"SOURCE_NOT_ACCESSIBLE","source":repo.TERRITORIAL_OBJECT}
    assert result["items"][0]["municipal_context"] is None


def test_erro_catalogo_obrigatorio_nao_e_mascarado_como_zero():
    with patch.object(repo,"_query",side_effect=RuntimeError("db")):
        with pytest.raises(RuntimeError,match="db"): AgroPropertiesRepository.list()


def test_detalhe_real_sem_cpf_e_com_contexto_separado():
    with patch.object(repo,"_query",side_effect=[[base()],[context()]]) as query:
        result=AgroPropertiesRepository.detail("101")
    assert query.call_args_list[0].args[0]=="agro" and query.call_args_list[1].args[0]=="agro_legacy"
    assert result["property"]["detail_id"]=="101" and result["municipal_context"]["scope"]=="MUNICIPAL"
    assert result["declared_holder"] is None and "cpf" not in str(result).lower()


def test_summary_null_nao_vira_zero_e_fonte_explicita():
    with patch.object(repo,"_query",side_effect=[[{"total":8291331}],[{"municipios":5563}],[{"attname":"uf","n_distinct":27,"null_frac":0},{"attname":"codigo_ibge_mun","n_distinct":5563,"null_frac":0}]]):
        result=AgroPropertiesRepository.summary()
    assert result["total"]==8291331 and result["ufs"]==27 and result["municipios"]==5563
    assert result["com_coordenada_valida"] is None and result["com_coordenada_valida_status"].startswith("NOT_CALCULABLE")
    assert result["area_conhecida"] is None and result["source_object"]=="prospeccao.imovel_rural"


def test_mapa_limitado_bbox_e_total_nao_inventado():
    with patch.object(repo,"_query",return_value=[{"detail_id":"1","latitude":-15,"longitude":-47}]) as query:
        result=AgroPropertiesRepository.map(limit=100)
    assert result["returned"]==1 and result["total"] is None
    assert result["total_status"]=="NOT_CALCULABLE_WITHIN_PERFORMANCE_TARGET"
    assert result["aggregation"]=="PROPERTY_POINTS" and "Recorte limitado" in result["limitations"][0]
    assert "latitude BETWEEN %s AND %s" in query.call_args.args[1]


def test_contexto_municipal_contagem_real_e_ligacao_ibge():
    with patch.object(repo,"_query",side_effect=[[context()],[{"codigo_ibge":"5103403","total":123}]]) as query:
        result=AgroPropertiesRepository.municipal_context(uf="MT",municipio="CUIABA",limit=1)
    assert result["items"][0]["imoveis_registrados"]==123
    assert result["items"][0]["scope"]=="MUNICIPAL" and result["link_quality"]=="IBGE_CODE_EXACT"


def test_database_e_credenciais_nao_sao_alterados():
    source=open(repo.__file__,encoding="utf-8").read()
    assert "DOMAIN_CREDENTIALS" not in source and "get_write_connection" not in source
    assert "agro_legacy" in source and "GRANT" not in source.upper()
