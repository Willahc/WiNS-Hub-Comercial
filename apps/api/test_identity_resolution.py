from identity_resolution import OrganizationIdentity,PersonIdentity,resolve_organization,resolve_person,valid_cnpj

def test_valid_cnpj():
    assert valid_cnpj("00.000.000/0001-91")
    assert not valid_cnpj("11.111.111/1111-11")

def test_company_conflict_and_probable():
    assert resolve_organization(OrganizationIdentity(cnpj="00000000000191"),OrganizationIdentity(cnpj="11222333000181"))=="conflitante"
    assert resolve_organization(OrganizationIdentity(name="Construtora São José",municipality="São Paulo"),OrganizationIdentity(name="CONSTRUTORA SAO JOSE",municipality="Sao Paulo"))=="provável"

def test_ambiguous_people_are_not_merged():
    left=PersonIdentity(company_id="a",name="João Silva",title="Diretor")
    right=PersonIdentity(company_id="b",name="João Silva",title="Diretor")
    assert resolve_person(left,right)=="conflitante"
