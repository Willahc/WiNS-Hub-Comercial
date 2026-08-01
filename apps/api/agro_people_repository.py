import math

from wave1_repository import _run_db


_SOURCES = ["RFB/QSA", "prospeccao.holding_blind_spot", "prospeccao.holding_lead_ui"]
_LIMITATIONS = [
    "O QSA comprova vínculo cadastral, não atuação operacional ou poder de decisão.",
    "Contatos empresariais não são atribuídos automaticamente à pessoa.",
    "Não há modelo auditável de score pessoal disponível.",
]


def _link_type(code):
    if code == "49":
        return "SOCIO_ADMINISTRADOR_QSA"
    if code == "05":
        return "ADMINISTRADOR_QSA"
    return "SOCIO_QSA"


def _contact(row):
    value = row.get("email") or row.get("whatsapp")
    if not value:
        return {
            "contato": None, "contato_valor": None, "contato_tipo": None,
            "contato_classificacao": "UNKNOWN", "contato_origem": None,
            "contato_atribuido_a_pessoa": False, "contato_validado_em": None,
            "contato_limitacoes": ["Contato não disponível nas fontes consultadas."],
        }
    return {
        "contato": value, "contato_valor": value,
        "contato_tipo": "EMAIL" if row.get("email") else "TELEFONE",
        "contato_classificacao": "COMPANY_INSTITUTIONAL",
        "contato_origem": "Cadastro empresarial associado ao CNPJ",
        "contato_atribuido_a_pessoa": False, "contato_validado_em": None,
        "contato_limitacoes": ["Contato institucional da empresa — não atribuído à pessoa."],
    }


class AgroPeopleRepository:
    @staticmethod
    def _where(q=None, uf=None, municipio=None, tipo_vinculo=None, motivo_inclusao=None,
               evidencia_agro=None, evidencia_decisao=None, tipo_contato=None,
               com_contato=None, com_car=None, cnae=None, com_grupo=None):
        where, params = ["b.cpf_socio_comum IS NOT NULL", "btrim(b.cpf_socio_comum)<>''"], []
        if q:
            where.append("(b.nome_socio_comum ILIKE %s OR l.razao ILIKE %s OR l.nome_fantasia ILIKE %s OR l.municipio ILIKE %s)")
            params.extend([f"%{q}%"] * 4)
        if uf:
            where.append("l.uf=%s"); params.append(uf.upper())
        if municipio:
            where.append("l.municipio ILIKE %s"); params.append(f"%{municipio}%")
        if tipo_vinculo:
            codes = {"SOCIO_ADMINISTRADOR_QSA": "49", "ADMINISTRADOR_QSA": "05"}
            if tipo_vinculo in codes:
                where.append("b.qualif_socio=%s"); params.append(codes[tipo_vinculo])
            elif tipo_vinculo == "SOCIO_QSA":
                where.append("COALESCE(b.qualif_socio,'') NOT IN ('49','05')")
            else:
                where.append("FALSE")
        if motivo_inclusao:
            if motivo_inclusao == "EMPRESA_COM_CNAE_AGRO":
                where.append("b.agro_cnpj_basico IS NOT NULL")
            elif motivo_inclusao == "SOMENTE_VINCULO_SOCIETARIO":
                where.append("b.agro_cnpj_basico IS NULL")
            else:
                where.append("FALSE")
        if evidencia_agro:
            where.append("b.agro_cnpj_basico IS NOT NULL" if evidencia_agro == "PARCIAL" else "FALSE")
        if evidencia_decisao and evidencia_decisao != "NÃO COMPROVADA":
            where.append("FALSE")
        if tipo_contato:
            if tipo_contato == "COMPANY_INSTITUTIONAL":
                where.append("(NULLIF(btrim(l.email),'') IS NOT NULL OR NULLIF(btrim(l.whatsapp),'') IS NOT NULL)")
            elif tipo_contato == "UNKNOWN":
                where.append("NULLIF(btrim(l.email),'') IS NULL AND NULLIF(btrim(l.whatsapp),'') IS NULL")
            else:
                where.append("FALSE")
        if com_contato is not None:
            expression = "(NULLIF(btrim(l.email),'') IS NOT NULL OR NULLIF(btrim(l.whatsapp),'') IS NOT NULL)"
            where.append(expression if com_contato else f"NOT {expression}")
        if com_car is True:
            where.append("FALSE")
        if cnae:
            where.append("l.cnae_principal ILIKE %s"); params.append(f"%{cnae}%")
        if com_grupo is not None:
            where.append("b.classificacao='HOLDING'" if com_grupo else "COALESCE(b.classificacao,'')<>'HOLDING'")
        return " AND ".join(where), params

    @staticmethod
    def list_people(page=1, page_size=25, sort="total_empresas", order="desc",
                    com_varias_empresas=None, **filters):
        size = page_size if page_size in (25, 50, 100) else 25
        page = max(1, int(page)); offset = (page - 1) * size
        where, params = AgroPeopleRepository._where(**filters)
        filtered = f"""SELECT b.*,l.cnpj14,l.razao,l.nome_fantasia,l.uf,l.municipio,
          l.cnae_principal,l.situacao,l.email,l.whatsapp,l.whats_origem
          FROM prospeccao.holding_blind_spot b
          LEFT JOIN prospeccao.holding_lead_ui l ON l.cnpj_basico=b.cnpj_basico
          WHERE {where}"""
        having = "HAVING count(*)>1" if com_varias_empresas is True else "HAVING count(*)<=1" if com_varias_empresas is False else ""
        grouped = f"""SELECT encode(digest(cpf_socio_comum,'sha256'),'hex') person_id,
          max(nome_socio_comum) nome,count(*)::int total_empresas,
          count(DISTINCT municipio)::int total_municipios,count(DISTINCT uf)::int total_ufs,
          bool_or(classificacao='HOLDING') tem_grupo,max(enriquecido_em)::text atualizacao
          FROM filtered GROUP BY cpf_socio_comum {having}"""
        totals = _run_db("wins_agro", f"WITH filtered AS ({filtered}), people AS ({grouped}) SELECT count(*)::int total_people,COALESCE(sum(total_empresas),0)::int total_links FROM people", params, domain="agro")
        total_people = totals[0]["total_people"] if totals else 0
        total_links = totals[0]["total_links"] if totals else 0
        sort_map = {
            "nome": "nome", "total_empresas": "total_empresas", "total_ufs": "total_ufs",
            "evidencia_agro": "(CASE WHEN total_empresas>0 THEN 1 ELSE 0 END)",
            "evidencia_decisao": "nome", "atualizacao": "atualizacao",
        }
        column = sort_map.get(sort, "total_empresas"); direction = "ASC" if order == "asc" else "DESC"
        default_tail = ", nome ASC, person_id ASC" if sort == "total_empresas" and direction == "DESC" else ", person_id ASC"
        people = _run_db("wins_agro", f"WITH filtered AS ({filtered}), people AS ({grouped}) SELECT * FROM people ORDER BY {column} {direction} NULLS LAST{default_tail} LIMIT %s OFFSET %s", params + [size, offset], domain="agro")
        ids = [p["person_id"] for p in people]
        links = []
        if ids:
            links = _run_db("wins_agro", f"""WITH filtered AS ({filtered}), ranked AS (
              SELECT encode(digest(cpf_socio_comum,'sha256'),'hex') person_id,*,
              row_number() OVER (PARTITION BY cpf_socio_comum ORDER BY razao,cnpj14) link_rank
              FROM filtered WHERE encode(digest(cpf_socio_comum,'sha256'),'hex')=ANY(%s))
              SELECT * FROM ranked WHERE link_rank<=3 ORDER BY nome_socio_comum,razao""", params + [ids], domain="agro")
        by_person = {}
        for link in links:
            by_person.setdefault(link["person_id"], []).append(link)
        items = [AgroPeopleRepository._person_item(p, by_person.get(p["person_id"], [])) for p in people]
        pages = math.ceil(total_people / size) if total_people else 0
        return {"items": items, "total_people": total_people, "total_links": total_links,
                "page": page, "page_size": size, "total_pages": pages,
                "has_previous": page > 1, "has_next": page < pages, "status": "partial",
                "sources": _SOURCES, "limitations": _LIMITATIONS}

    @staticmethod
    def _person_item(person, links):
        companies = [AgroPeopleRepository._company(link) for link in links]
        types = sorted({_link_type(link.get("qualif_socio")) for link in links})
        contact_link = next((link for link in links if link.get("email") or link.get("whatsapp")), {})
        contact = _contact(contact_link)
        has_agro = any(link.get("agro_cnpj_basico") for link in links)
        groups = [c for c, link in zip(companies, links) if link.get("classificacao") == "HOLDING"]
        result = {
            "person_id": person["person_id"], "nome": person.get("nome"), "cpf_mascarado": None,
            "total_empresas": person.get("total_empresas", len(companies)),
            "total_municipios": person.get("total_municipios", len({x.get('municipio') for x in links if x.get('municipio')})),
            "total_ufs": person.get("total_ufs", len({x.get('uf') for x in links if x.get('uf')})),
            "empresas_resumo": companies[:3], "tipos_vinculo": types,
            "classificacao_principal": types[0] if types else "SOCIO_QSA",
            "evidencia_vinculo": "COMPROVADA", "evidencia_agro": "PARCIAL" if has_agro else "INDISPONÍVEL",
            "evidencia_decisao": "NÃO COMPROVADA", "qualidade_contato": "PARCIAL" if contact["contato"] else "INDISPONÍVEL",
            "motivo_inclusao": "EMPRESA_COM_CNAE_AGRO" if has_agro else "SOMENTE_VINCULO_SOCIETARIO",
            "motivo_inclusao_descricao": "Pessoa consta no QSA de empresa relacionada cadastralmente a empresa com CNAE Agro." if has_agro else "Pessoa incluída somente pelo vínculo societário cadastral.",
            "motivo_inclusao_fonte": "RFB/QSA e CNAE empresarial" if has_agro else "RFB/QSA",
            "motivo_inclusao_data": person.get("atualizacao"), "motivo_inclusao_confianca": "PARCIAL" if has_agro else "COMPROVADA",
            "score": None, "score_status": "NOT_AVAILABLE", "fontes": _SOURCES,
            "limitacoes": list(_LIMITATIONS), "total_grupos": 1 if person.get("tem_grupo") else len(groups), "grupos_resumo": groups[:3],
        }
        result.update(contact)
        return result

    @staticmethod
    def _company(link):
        return {"cnpj": link.get("cnpj14"), "razao_social": link.get("razao"),
                "nome_fantasia": link.get("nome_fantasia"), "municipio": link.get("municipio"),
                "uf": link.get("uf"), "tipo_vinculo": _link_type(link.get("qualif_socio")),
                "qualificacao_qsa_codigo": link.get("qualif_socio"), "cnae": link.get("cnae_principal"),
                "motivo_agro": "EMPRESA_COM_CNAE_AGRO" if link.get("agro_cnpj_basico") else "SOMENTE_VINCULO_SOCIETARIO",
                "situacao_cadastral": link.get("situacao"),
                "contato_institucional": _contact(link), "fonte": "RFB/QSA",
                "atualizacao": str(link.get("enriquecido_em") or link.get("descoberto_em") or "") or None}

    @staticmethod
    def detail(person_id):
        rows = _run_db("wins_agro", """SELECT encode(digest(b.cpf_socio_comum,'sha256'),'hex') person_id,b.*,
          l.cnpj14,l.razao,l.nome_fantasia,l.uf,l.municipio,l.cnae_principal,l.situacao,l.email,l.whatsapp,l.whats_origem
          FROM prospeccao.holding_blind_spot b LEFT JOIN prospeccao.holding_lead_ui l ON l.cnpj_basico=b.cnpj_basico
          WHERE encode(digest(b.cpf_socio_comum,'sha256'),'hex')=%s ORDER BY l.razao""", [person_id], domain="agro")
        if not rows:
            return None
        base = {"person_id": person_id, "nome": rows[0].get("nome_socio_comum"),
                "total_empresas": len(rows), "total_municipios": len({r.get('municipio') for r in rows if r.get('municipio')}),
                "total_ufs": len({r.get('uf') for r in rows if r.get('uf')}), "atualizacao": str(max((r.get('enriquecido_em') or r.get('descoberto_em') for r in rows if r.get('enriquecido_em') or r.get('descoberto_em')), default='')) or None}
        person = AgroPeopleRepository._person_item(base, rows)
        companies = [AgroPeopleRepository._company(r) for r in rows]
        groups = [{**c, "forca_ligacao": "DOCUMENTAL", "fonte": "RFB/QSA",
                   "holdings_url": f"/agro/holdings?search={c.get('cnpj')}"}
                  for c, r in zip(companies, rows) if r.get("classificacao") == "HOLDING"]
        return {"status": "partial", "person": person, "companies": companies,
                "holdings": groups, "related_properties": None,
                "decision_message": "Poder decisório operacional não comprovado pelas fontes disponíveis.",
                "sources": _SOURCES, "limitations": _LIMITATIONS}

    @staticmethod
    def stats():
        rows = _run_db("wins_agro", """WITH people AS (
          SELECT cpf_socio_comum,count(*) links,bool_or(classificacao='HOLDING') has_group
          FROM prospeccao.holding_blind_spot GROUP BY cpf_socio_comum), contacts AS (
          SELECT count(*) FILTER(WHERE NULLIF(btrim(email),'') IS NOT NULL OR NULLIF(btrim(whatsapp),'') IS NOT NULL)::int institutional
          FROM prospeccao.holding_lead_ui)
          SELECT count(*)::int pessoas_unicas,COALESCE(sum(links),0)::int vinculos_societarios,
          (SELECT count(DISTINCT cnpj_basico)::int FROM prospeccao.holding_blind_spot) empresas_distintas,
          count(*) FILTER(WHERE links>1)::int pessoas_multiplas_empresas,
          count(*) FILTER(WHERE links=1)::int somente_qsa,0::int evidencia_agro_comprovada,
          0::int decisores_provaveis,0::int decisores_comprovados,0::int contatos_pessoais_validados,
          (SELECT institutional FROM contacts) contatos_institucionais,
          (SELECT institutional FROM contacts) contatos_nao_atribuidos,
          count(*) FILTER(WHERE has_group)::int grupos_holdings_relacionados FROM people""", domain="agro")
        return {"status": "ok", **(rows[0] if rows else {}), "sources": _SOURCES, "limitations": _LIMITATIONS}
