import os
from unittest.mock import patch

for key in ("DB_PASS","DB_AGRO_USER","DB_AGRO_PASS","DB_LOG_USER","DB_LOG_PASS","DB_SAUDE_USER","DB_SAUDE_PASS","DB_WRITE_PASS","WINS_INTERNAL_SECRET"):
    os.environ.setdefault(key,"test-only")

import wave1_repository as module
from wave1_repository import Wave1Repository


def row(**extra):
    value={"detail_id":"101","codigo_car":"CAR-101","municipio":"CUIABA","uf":"MT","codigo_ibge":5103403,
      "area_ha":125.5,"titular_nome":None,"tem_titular":False,"tem_cnpj":False,"cnpj_vinculado":None,
      "bioma":"Cerrado","area_pasto_ha":None,"area_lavoura_ha":None,"area_vegetacao_nativa_ha":None,
      "tem_uso_solo":False,"cobertura_veterinaria":"DESERTO_VET","bovinos_municipio":50000,
      "tecnicos_75km":0,"completude_score":60,"fonte_principal":"SICAR","data_atualizacao":None}
    return {**value,**extra}


def run_list(**kwargs):
    with patch.object(module,"_run_db",side_effect=[[{"total":51}],[row()]]) as query:
        result=Wave1Repository.agro_imoveis_catalog(**kwargs)
    return result,query


def test_total_real_paginacao_page_size_total_pages():
    result,query=run_list(page=2,page_size=25)
    assert result["total"]==51 and result["total_pages"]==3 and result["page"]==2
    assert result["has_previous"] is True and result["has_next"] is True
    assert "count(*)::int total" in query.call_args_list[0].args[1]
    assert query.call_args_list[1].args[2][-2:]==[25,25]


def test_page_size_permitido_e_fallback():
    assert run_list(page_size=50)[0]["page_size"]==50
    assert run_list(page_size=100)[0]["page_size"]==100
    assert run_list(page_size=20)[0]["page_size"]==25


def test_filtros_uf_municipio_area_titular_cnpj_completude_cobertura():
    with patch.object(module,"_run_db",side_effect=[[{"codigo_ibge":"5103403"}],[{"total":1}],[row()]]) as query:
      result=Wave1Repository.agro_imoveis_catalog(uf="MT",municipio="CUIABA",area_min=10,area_max=200,com_titular=True,
        com_cnpj=False,completude_min=50,cobertura_veterinaria="DESERTO_VET")
    sql=query.call_args_list[1].args[1]
    for fragment in ("i.uf=%s","i.municipio ILIKE %s","i.area_total_ha >= %s","i.area_total_ha <= %s","completude_score"):
        assert fragment in sql
    assert "classificacao_vet" in query.call_args_list[0].args[1] and result["items"][0]["cobertura_veterinaria"]=="DESERTO_VET"


def test_ordenacao_area_e_completude_whitelist():
    _,area=run_list(sort="area",order="asc")
    assert "ORDER BY area_ha ASC" in area.call_args_list[1].args[1]
    _,complete=run_list(sort="completude",order="desc")
    assert "ORDER BY completude_score DESC" in complete.call_args_list[1].args[1]
    _,unsafe=run_list(sort="DROP TABLE",order="unsafe")
    sql=unsafe.call_args_list[1].args[1]
    assert "DROP TABLE" not in sql and "completude_score DESC" in sql


def test_contrato_sem_dados_fabricados_null_diferente_zero():
    result,_=run_list()
    item=result["items"][0]
    assert item["titular_nome"] is None and item["cnpj_vinculado"] is None
    assert item["uso_solo"] is None and item["bovinos_municipio"]==50000
    assert item["detail_id"]=="101" and item["detail_available"] is True
    assert item["completude_flags"]["titular"] is False
    assert "proprietário desconhecido" not in str(item).lower()


def test_cnpj_comprovado_e_flags_de_completude():
    data=row(tem_titular=True,titular_nome="Empresa Rural",tem_cnpj=True,cnpj_vinculado="12345678000199",
      tem_uso_solo=True,area_pasto_ha=0.0,completude_score=100)
    item=Wave1Repository._agro_catalog_item(data)
    assert item["documento_status"]=="CNPJ_COMPROVADO" and item["cnpj_evidencia"]
    assert item["uso_solo"]["pastagem_ha"]==0.0 and item["completude_score"]==100


def test_cobertura_municipal_nao_infere_tecnico_individual():
    item=Wave1Repository._agro_catalog_item(row())
    assert item["tecnicos_75km"]==0
    assert any("municipal" in x.lower() and "não representa vínculo" in x.lower() for x in item["limitations"])
    assert "tecnico" not in item and "tecnico_proximo" not in item


def test_detail_id_da_lista_abre_detalhe_parcial():
    detail_row=row()
    with patch.object(module,"_run_db",return_value=[detail_row]) as query:
        detail=Wave1Repository.agro_imovel_360_detail("101")
    assert query.call_args.args[2]==["101"]
    assert detail["status"]=="partial" and detail["property"]["detail_id"]=="101"
    assert detail["company"] is None and detail["owner"] is None
    assert detail["technical_coverage"]["specific_technician"] is None


def test_detail_404_apenas_quando_basico_inexistente():
    with patch.object(module,"_run_db",return_value=[]): assert Wave1Repository.agro_imovel_360_detail("404") is None


def test_erro_banco_controlado():
    with patch.object(module,"_run_db",side_effect=RuntimeError("db")):
        result=Wave1Repository.agro_imoveis_catalog()
    assert result["status"]=="partial" and result["items"]==[] and result["total"]==0
