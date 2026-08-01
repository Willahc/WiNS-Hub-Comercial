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
import agro_canal_repository as repo


def nominal(**extra):
    base={"id":"CNPJ:1","cnpj":"1","nome":"Ana","entidade_tipo":"PROFISSIONAL_NOMINAL",
      "profissao":"VETERINARIO","profissao_origem":"CADASTRO_INTERNO","confianca_profissao":"CADASTRO_INTERNO",
      "atividade":"veterinaria","cnae":"7500100","crmv_numero":"123","crmv_uf":"SP",
      "registro_oficial_validado":False,"municipio":"Campinas","uf":"SP","telefone":None,"email":None,
      "instagram":None,"site":None,"contato_origem":"RFB","contato_confianca":"CADASTRAL","score_canal":None,"fonte":"v_tecnico_full"}
    return {**base,**extra}


def test_total_real_paginacao_total_pages_e_null_geografico():
    with patch.object(repo,"_query",side_effect=[[{"total":51}],[nominal()]]) as query:
        result=repo.AgroCanalRepository.tecnicos(page=2,page_size=25,uf="SP",profissao="VETERINARIO")
    assert result["total"]==51 and result["total_pages"]==3 and result["page"]==2
    assert result["items"][0]["fazenda_propria"] is None
    assert result["items"][0]["fazendas_50km"] is None and result["items"][0]["bovinos_100km"] is None
    assert "count(*) total" in query.call_args_list[0].args[0]
    assert "len(rows) * 10" not in query.call_args_list[0].args[0]


def test_filtros_uf_profissao_e_whitelist_sort():
    with patch.object(repo,"_query",side_effect=[[{"total":0}],[]]) as query:
        repo.AgroCanalRepository.tecnicos(uf="MG",profissao="ZOOTECNISTA",sort="DROP TABLE",order="boom")
    sql=query.call_args_list[1].args[0]
    assert "upper(COALESCE(uf,''))" in sql and "upper(COALESCE(profissao,''))" in sql
    assert "ORDER BY nome ASC" in sql and "DROP TABLE" not in sql


def test_crea_nao_e_contado_como_crmv():
    assert "c.registro_crea, c.uf, false" not in repo.TECH_CTE
    assert "c.titulo, NULL, NULL, NULL, false" in repo.TECH_CTE


def test_estabelecimento_tem_confianca_empresarial():
    assert "WHEN t.categoria='veterinaria' THEN 'ESTABELECIMENTO_EMPRESARIAL'" in repo.TECH_CTE


def test_semantica_nominal_estabelecimento_cnae_e_crmv_nao_oficial():
    rows=[nominal(),nominal(id="EST:2",entidade_tipo="ESTABELECIMENTO_VETERINARIO",profissao=None,
      confianca_profissao="ESTABELECIMENTO_EMPRESARIAL",crmv_numero=None),
      nominal(id="CNPJ:3",entidade_tipo="PROVAVEL_POR_CNAE",profissao=None,confianca_profissao="INFERIDO_POR_CNAE",crmv_numero=None)]
    with patch.object(repo,"_query",side_effect=[[{"total":3}],rows]): result=repo.AgroCanalRepository.tecnicos()
    assert {x["entidade_tipo"] for x in result["items"]}=={"PROFISSIONAL_NOMINAL","ESTABELECIMENTO_VETERINARIO","PROVAVEL_POR_CNAE"}
    assert result["items"][0]["registro_oficial_validado"] is False


def test_detalhe_geografia_indisponivel_sem_lista_fabricada():
    with patch.object(repo,"_query",return_value=[nominal()]): result=repo.AgroCanalRepository.tecnico("CNPJ:1")
    assert result["geo_status"]=="UNAVAILABLE"
    assert result["fazendas_proximas"] is None and result["municipios_cobertos"] is None
    assert "temporariamente indisponível" in result["message_geo"]


def test_estatisticas_reais():
    expected={"total":10,"profissionais_nominais":2,"estabelecimentos_veterinarios":3,"veterinarios":1,
      "zootecnistas":1,"reproducao_manejo":1,"provaveis_por_cnae":2,"com_crmv_informado":1,
      "com_telefone":4,"com_email":5,"origem_crea":1,"origem_abcz":1}
    with patch.object(repo,"_query",return_value=[expected]): result=repo.AgroCanalRepository.tecnicos_stats()
    assert result==expected


def test_erro_banco_controlado_sem_dados_fabricados():
    with patch.object(repo,"_query",side_effect=RuntimeError("db")): result=repo.AgroCanalRepository.tecnicos()
    assert result["status"]=="partial" and result["items"]==[] and result["total"]==0


def test_deserto_lista_classes_regra_75km_e_null_preservado():
    item={"codigo_ibge":1,"municipio":"A","uf":"MT","classificacao":"DESERTO_VET","bovinos_municipio":1000,
      "bovinos_75km":2000,"tecnicos_75km":0,"carga_regional":None,"raio_km":75}
    with patch.object(repo,"_query",side_effect=[[{"total":3}],[item]]): result=repo.AgroCanalRepository.deserto()
    assert result["total"]==3 and result["regra"]["raio_km"]==75
    assert result["items"][0]["carga_regional"] is None


def test_deserto_stats_deserto_baixa_normal_calculados():
    rows=[{"classificacao":"DESERTO_VET","municipios":539,"bovinos":1},{"classificacao":"BAIXA_COBERTURA","municipios":829,"bovinos":2},{"classificacao":"NORMAL","municipios":4168,"bovinos":3}]
    with patch.object(repo,"_query",return_value=rows): result=repo.AgroCanalRepository.deserto_stats()
    assert result["deserto_vet_municipios"]==539 and result["baixa_cobertura_municipios"]==829
    assert result["normal_municipios"]==4168 and result["total_municipios"]==5536
