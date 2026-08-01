import os
from unittest.mock import patch

for key in ("DB_PASS","DB_AGRO_USER","DB_AGRO_PASS","DB_LOG_USER","DB_LOG_PASS",
            "DB_SAUDE_USER","DB_SAUDE_PASS","DB_WRITE_PASS","WINS_INTERNAL_SECRET"):
    os.environ.setdefault(key,"test-only")

import agro_holdings_repository as repo


STATS={"empresas_representadas":25849,"vinculos_selecionados":151550,"pessoas_unicas":52567,
       "pessoas_multiplas_empresas":27586,"empresas_individuais":0,"vinculos_societarios_isolados":8,
       "holdings_declaradas":12561,"empresas_imobiliarias":9982,"empresas_candidatas_holding":3298,
       "candidatos_pessoas":27586,"pessoas_no_universo_empresas":11583,"empresas_ligadas_grupo":0,
       "grupos_documentais":0,"empresas_propriedade_comprovada":0,"empresas_empresa_360":0}


def company(**extra):
    row={"cnpj14":"12345678000199","cnpj_basico":"12345678","razao":"EMPRESA TESTE LTDA",
         "nome_fantasia":None,"cnae_principal":"0151201","municipio":"Cuiabá","uf":"MT",
         "nome_socio_comum":"ANA TESTE","cpf_socio_comum":"***000001**","qualif_socio":"49",
         "agro_cnpj_basico":"87654321","descoberto_em":None,"enriquecido_em":None,
         "person_companies":1,"tipo_entidade":"VINCULO_SOCIETARIO_ISOLADO","person_id":"a"*64}
    row.update(extra);return row


def company_calls(rows=None,total=1):
    return [[{"total":total}],rows or [company()],[STATS]]


def test_company_has_no_score_and_selected_person_is_not_controller():
    with patch.object(repo,"_run_db",side_effect=company_calls()): data=repo.AgroHoldingsRepository.list()
    item=data["items"][0]
    assert "score" not in item and "controlador" not in str(item).lower()
    assert item["pessoa_selecionada_nome"]=="ANA TESTE"


def test_company_taxonomy_individual_is_preserved():
    with patch.object(repo,"_run_db",side_effect=company_calls([company(tipo_entidade="EMPRESA_INDIVIDUAL",person_id=None,cpf_socio_comum=None,nome_socio_comum=None,agro_cnpj_basico=None)])):
        item=repo.AgroHoldingsRepository.list()["items"][0]
    assert item["tipo_entidade"]=="EMPRESA_INDIVIDUAL" and item["pessoa_selecionada_id"] is None


def test_isolated_link_does_not_create_group():
    with patch.object(repo,"_run_db",side_effect=company_calls()): item=repo.AgroHoldingsRepository.list()["items"][0]
    assert item["tipo_entidade"]=="VINCULO_SOCIETARIO_ISOLADO"
    assert item["documented_group_id"] is None and item["evidencia_grupo"]=="NÃO COMPROVADA"


def test_declared_holding_uses_cadastral_classification_not_group():
    with patch.object(repo,"_run_db",side_effect=company_calls([company(tipo_entidade="HOLDING_DECLARADA",cnae_principal="6462-0/00")])):
        item=repo.AgroHoldingsRepository.list()["items"][0]
    assert item["tipo_entidade"]=="HOLDING_DECLARADA" and item["evidencia_grupo"]=="PARCIAL"
    assert item["documented_group_id"] is None


def test_generic_real_estate_activity_is_not_declared_holding():
    with patch.object(repo,"_run_db",side_effect=company_calls([company(tipo_entidade="EMPRESA_IMOBILIARIA",cnae_principal="6810-2/02")])):
        item=repo.AgroHoldingsRepository.list()["items"][0]
    assert item["tipo_entidade"]=="EMPRESA_IMOBILIARIA"
    assert item["tipo_entidade"]!="HOLDING_DECLARADA"


def test_specific_holding_cnae_is_the_only_declared_holding_rule():
    _,_,classification=repo.AgroHoldingsRepository._company_where()
    assert "l.cnae_principal='6462-0/00'" in classification
    assert "6810" not in classification.split("THEN 'HOLDING_DECLARADA'")[0]


def test_participacoes_name_alone_does_not_prove_holding():
    _,_,classification=repo.AgroHoldingsRepository._company_where(q="PARTICIPAÇÕES")
    assert "razao" not in classification and "nome_fantasia" not in classification


def test_candidate_requires_same_stable_person_and_multiple_companies():
    person={"person_id":"b"*64,"nome":"ANA CONECTORA","total_companies":3,"total_municipalities":2,"total_states":2}
    preview={"person_id":"b"*64,"cnpj14":"11111111000111","razao":"EMPRESA A","municipio":"Sinop","uf":"MT"}
    with patch.object(repo,"_run_db",side_effect=[[{"total":1}],[person],[preview],[STATS]]):
        item=repo.AgroHoldingsRepository.list(tab="candidatos")["items"][0]
    assert item["classification"]=="CANDIDATA_A_HOLDING" and item["total_companies"]==3
    assert "não comprova" in item["limitations"][0]


def test_name_similarity_is_never_used_for_candidates():
    with patch.object(repo,"_run_db",side_effect=[[{"total":0}],[],[STATS]]) as query:
        repo.AgroHoldingsRepository.list(tab="candidatos")
    sql=" ".join(call.args[1] for call in query.call_args_list)
    assert "GROUP BY b.cpf_socio_comum" in sql and "razao_norm" not in sql


def test_documented_group_requires_persisted_document_source():
    with patch.object(repo,"_run_db",side_effect=[[{"total":1}],[{"group_id":"grp-1","total_companies":2,"total_people":0,"total_states":0,"formation_criterion":"Contrato social","evidence_source":"Documento RFB","evidence_date":None}],[STATS]]) as query:
        item=repo.AgroHoldingsRepository.list(tab="grupos")["items"][0]
    assert item["classification"]=="GRUPO_DOCUMENTAL" and item["evidence_level"]=="COMPROVADA"
    assert "fonte_documental IS NOT NULL" in query.call_args_list[0].args[1]


def test_empty_documented_groups_are_honest():
    with patch.object(repo,"_run_db",side_effect=[[{"total":0}],[],[STATS]]): data=repo.AgroHoldingsRepository.list(tab="grupos")
    assert data["items"]==[] and data["filtered_total"]==0
    assert data["universe"]["total_groups"]==0


def test_real_totals_keep_entities_candidates_and_groups_separate():
    with patch.object(repo,"_run_db",return_value=[STATS]): data=repo.AgroHoldingsRepository.stats()
    assert data["empresas_representadas"]==25849 and data["candidatos_pessoas"]==27586
    assert data["grupos_documentais"]==0 and data["vinculos_selecionados"]==151550


def test_pagination_is_specific_to_current_tab():
    with patch.object(repo,"_run_db",side_effect=company_calls(total=51)):
        data=repo.AgroHoldingsRepository.list(page=2,page_size=25)
    assert data["total_entities"]==51 and data["total_pages"]==3 and data["page"]==2


def test_tab_universes_are_independent_and_use_correct_sources():
    with patch.object(repo,"_run_db",side_effect=company_calls()): companies=repo.AgroHoldingsRepository.list()
    with patch.object(repo,"_run_db",side_effect=[[{"total":0}],[],[STATS]]): candidates=repo.AgroHoldingsRepository.list(tab="candidatos")
    with patch.object(repo,"_run_db",side_effect=[[{"total":0}],[],[STATS]]): groups=repo.AgroHoldingsRepository.list(tab="grupos")
    assert companies["source_object"]=="prospeccao.holding_lead_ui"
    assert candidates["source_object"]=="prospeccao.holding_blind_spot"
    assert groups["source_object"]=="public.relationship_edges"
    assert candidates["universe"]["total_companies"]==151550
    assert groups["universe"]["total_groups"]==0
    assert candidates["filtered_total"]==0 and companies["filtered_total"]==1


def test_company_classification_counts_close_without_duplication():
    total=sum(STATS[k] for k in ("holdings_declaradas","empresas_imobiliarias","empresas_candidatas_holding","empresas_individuais","vinculos_societarios_isolados","empresas_ligadas_grupo"))
    assert total==STATS["empresas_representadas"]


def test_no_fixed_98_or_fallback_90_in_contract_source():
    source=open(repo.__file__,encoding="utf-8").read()
    assert '"score"' not in source and " or 90" not in source and "98" not in source


def test_filters_are_parameterized_and_sort_is_whitelisted():
    with patch.object(repo,"_run_db",side_effect=company_calls()) as query:
        repo.AgroHoldingsRepository.list(q="Teste",uf="mt",municipio="Cuiabá",tipo_entidade="HOLDING_DECLARADA",cnae="6462",sort="uf",order="desc")
    sql,params=query.call_args_list[0].args[1:3]
    assert "ILIKE %s" in sql and "l.uf=%s" in sql and "Teste" not in sql and "MT" in params


def test_motivo_agro_does_not_claim_property():
    with patch.object(repo,"_run_db",side_effect=company_calls()): item=repo.AgroHoldingsRepository.list()["items"][0]
    assert item["motivo_inclusao"]=="PESSOA_LIGADA_A_EMPRESA_AGRO"
    assert item["evidencia_ativo_rural"]=="INDISPONÍVEL"


def test_entity_detail_has_person_and_hides_broken_company360_and_property():
    with patch.object(repo.AgroHoldingsRepository,"_companies",return_value={"items":[repo.AgroHoldingsRepository._company_item(company())]}):
        data=repo.AgroHoldingsRepository.entity_detail("12345678000199")
    assert data["entity"]["pessoa_selecionada_id"]=="a"*64
    assert data["company_360_url"] is None and data["properties"] is None


def test_group_detail_requires_documental_rows_and_does_not_invent_name():
    row={"group_id":"grp-abcdefghi","company_id":"123","formation_criterion":"Documento","evidencia":"x","fonte_documental":"RFB doc","evidence_date":None}
    with patch.object(repo,"_run_db",return_value=[row]): data=repo.AgroHoldingsRepository.group_detail("grp-abcdefghi")
    assert data["group"]["group_name"]=="Grupo documental grp-abcd"
    assert data["group"]["properties"] is None


def test_database_absence_returns_no_fabricated_entity_or_group():
    with patch.object(repo,"_run_db",return_value=[]):
        assert repo.AgroHoldingsRepository.entity_detail("missing") is None
        assert repo.AgroHoldingsRepository.group_detail("missing") is None
