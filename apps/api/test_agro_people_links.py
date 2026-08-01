import os

for key in ("DB_PASS", "DB_AGRO_USER", "DB_AGRO_PASS", "DB_LOG_USER", "DB_LOG_PASS",
            "DB_SAUDE_USER", "DB_SAUDE_PASS", "DB_WRITE_PASS", "WINS_INTERNAL_SECRET"):
    os.environ.setdefault(key, "test-only")

import agro_people_repository as repo


PERSON_ID = "a" * 64


def link(**overrides):
    row = {
        "person_id": PERSON_ID, "nome_socio_comum": "ANA SOCIA", "cpf_socio_comum": "hidden",
        "cnpj_basico": "12345678", "cnpj14": "12345678000199", "razao": "FAZENDA EXEMPLO LTDA",
        "nome_fantasia": "FAZENDA EXEMPLO", "uf": "MT", "municipio": "Cuiabá",
        "qualif_socio": "49", "cnae_principal": "0151201", "situacao": "ATIVA",
        "agro_cnpj_basico": "87654321", "email": "contato@empresa.test", "whatsapp": None,
        "classificacao": None, "enriquecido_em": None, "descoberto_em": None,
    }
    row.update(overrides)
    return row


def person(**overrides):
    row = {"person_id": PERSON_ID, "nome": "ANA SOCIA", "total_empresas": 2,
           "total_municipios": 2, "total_ufs": 1, "tem_grupo": False, "atualizacao": None}
    row.update(overrides)
    return row


def install_list(monkeypatch, links=None, total_people=1, total_links=2, people=None):
    calls = []
    links = links or [link(), link(cnpj14="87654321000199", razao="AGRO DOIS LTDA", municipio="Sinop")]
    people = people or [person()]

    def fake(_db, sql, params=None, domain=None):
        calls.append((sql, params))
        if "SELECT count(*)::int total_people" in sql:
            return [{"total_people": total_people, "total_links": total_links}]
        if "SELECT * FROM people ORDER BY" in sql:
            return people
        return links
    monkeypatch.setattr(repo, "_run_db", fake)
    return calls


def test_groups_one_person_with_multiple_companies_and_real_counts(monkeypatch):
    install_list(monkeypatch)
    data = repo.AgroPeopleRepository.list_people()
    assert data["total_people"] == 1 and data["total_links"] == 2
    assert len(data["items"]) == 1 and data["items"][0]["total_empresas"] == 2
    assert len(data["items"][0]["empresas_resumo"]) == 2


def test_pagination_and_total_pages(monkeypatch):
    install_list(monkeypatch, total_people=51, total_links=80)
    data = repo.AgroPeopleRepository.list_people(page=2, page_size=25)
    assert data["page"] == 2 and data["total_pages"] == 3
    assert data["has_previous"] is True and data["has_next"] is True


def test_filters_and_sort_are_bound_and_whitelisted(monkeypatch):
    calls = install_list(monkeypatch)
    repo.AgroPeopleRepository.list_people(q="Ana", uf="mt", municipio="Cuiabá",
        tipo_vinculo="SOCIO_ADMINISTRADOR_QSA", tipo_contato="COMPANY_INSTITUTIONAL",
        com_varias_empresas=True, cnae="0151", sort="nome", order="asc")
    sql, params = calls[0]
    assert "ILIKE %s" in sql and "l.uf=%s" in sql and "HAVING count(*)>1" in sql
    assert "Ana" not in sql and "MT" in params


def test_qsa_never_becomes_decision_maker_and_score_is_absent(monkeypatch):
    install_list(monkeypatch)
    item = repo.AgroPeopleRepository.list_people()["items"][0]
    assert item["classificacao_principal"] == "SOCIO_ADMINISTRADOR_QSA"
    assert item["evidencia_decisao"] == "NÃO COMPROVADA"
    assert item["score"] is None and item["score_status"] == "NOT_AVAILABLE"


def test_company_email_is_not_attributed_to_person(monkeypatch):
    install_list(monkeypatch)
    item = repo.AgroPeopleRepository.list_people()["items"][0]
    assert item["contato_classificacao"] == "COMPANY_INSTITUTIONAL"
    assert item["contato_atribuido_a_pessoa"] is False
    assert "não atribuído" in item["contato_limitacoes"][0]


def test_no_contact_is_unknown_not_fabricated(monkeypatch):
    install_list(monkeypatch, links=[link(email=None, whatsapp=None)], total_links=1,
                 people=[person(total_empresas=1, total_municipios=1)])
    item = repo.AgroPeopleRepository.list_people()["items"][0]
    assert item["contato"] is None and item["contato_classificacao"] == "UNKNOWN"


def test_reason_for_agro_inclusion_is_explicit(monkeypatch):
    install_list(monkeypatch)
    item = repo.AgroPeopleRepository.list_people()["items"][0]
    assert item["motivo_inclusao"] == "EMPRESA_COM_CNAE_AGRO"
    assert item["motivo_inclusao_fonte"] == "RFB/QSA e CNAE empresarial"


def test_summary_has_at_most_three_companies(monkeypatch):
    links = [link(cnpj14=f"{n:014d}", razao=f"EMPRESA {n}") for n in range(5)]
    install_list(monkeypatch, links=links, total_links=5, people=[person(total_empresas=5)])
    assert len(repo.AgroPeopleRepository.list_people()["items"][0]["empresas_resumo"]) == 3


def test_detail_returns_all_links_without_cpf(monkeypatch):
    monkeypatch.setattr(repo, "_run_db", lambda *a, **k: [link(), link(razao="AGRO DOIS")])
    data = repo.AgroPeopleRepository.detail(PERSON_ID)
    assert len(data["companies"]) == 2 and data["person"]["cpf_mascarado"] is None
    assert "cpf_socio_comum" not in data["person"]
    assert data["decision_message"].startswith("Poder decisório operacional não comprovado")


def test_holdings_only_when_documented(monkeypatch):
    monkeypatch.setattr(repo, "_run_db", lambda *a, **k: [link(classificacao=None), link(classificacao="HOLDING")])
    data = repo.AgroPeopleRepository.detail(PERSON_ID)
    assert len(data["holdings"]) == 1
    assert data["holdings"][0]["forca_ligacao"] == "DOCUMENTAL"


def test_stats_keep_people_links_companies_and_contacts_separate(monkeypatch):
    values = {"pessoas_unicas": 10, "vinculos_societarios": 30, "empresas_distintas": 20,
              "pessoas_multiplas_empresas": 4, "somente_qsa": 6,
              "evidencia_agro_comprovada": 0, "decisores_provaveis": 0,
              "decisores_comprovados": 0, "contatos_pessoais_validados": 0,
              "contatos_institucionais": 8, "contatos_nao_atribuidos": 8,
              "grupos_holdings_relacionados": 2}
    monkeypatch.setattr(repo, "_run_db", lambda *a, **k: [values])
    data = repo.AgroPeopleRepository.stats()
    assert data["pessoas_unicas"] == 10 and data["vinculos_societarios"] == 30
    assert data["contatos_pessoais_validados"] == 0


def test_database_error_is_controlled_by_repository_caller(monkeypatch):
    monkeypatch.setattr(repo, "_run_db", lambda *a, **k: [])
    data = repo.AgroPeopleRepository.list_people()
    assert data["status"] == "partial" and data["items"] == []
