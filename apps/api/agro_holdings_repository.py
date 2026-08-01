import math

from wave1_repository import _run_db


SOURCES = ["RFB/QSA", "prospeccao.holding_lead_ui", "prospeccao.holding_blind_spot"]
LIMITATIONS = [
    "holding_blind_spot mantém um vínculo societário representativo por empresa e não corresponde ao QSA completo.",
    "Pessoa em comum não comprova grupo econômico, controle, beneficiário final ou atuação operacional conjunta.",
    "Grupos documentais exigem relação persistida e fonte identificável.",
]
HOLDING_CNAE = "(COALESCE(l.cnae_principal,'') ~ '^(6462|6463|6810)')"


def _person_type(code):
    if code == "49":
        return "SOCIO_ADMINISTRADOR_QSA"
    if code == "05":
        return "ADMINISTRADOR_QSA"
    return "SOCIO_QSA"


class AgroHoldingsRepository:
    @staticmethod
    def stats():
        rows = _run_db("wins_agro", f"""WITH pc AS (
          SELECT cpf_socio_comum,count(*)::int n FROM prospeccao.holding_blind_spot GROUP BY 1),
        companies AS (
          SELECT l.cnpj_basico,{HOLDING_CNAE} declared,b.cnpj_basico IS NOT NULL linked,COALESCE(pc.n,0) person_companies
          FROM prospeccao.holding_lead_ui l LEFT JOIN prospeccao.holding_blind_spot b USING(cnpj_basico)
          LEFT JOIN pc ON pc.cpf_socio_comum=b.cpf_socio_comum), documented AS (
          SELECT source_id FROM public.relationship_edges
          WHERE source_type='Grupo' AND target_type='Empresa' AND fonte_documental IS NOT NULL GROUP BY source_id)
        SELECT (SELECT count(*)::int FROM companies) empresas_representadas,
          (SELECT count(*)::int FROM prospeccao.holding_blind_spot) vinculos_selecionados,
          (SELECT count(*)::int FROM pc) pessoas_unicas,
          (SELECT count(*)::int FROM pc WHERE n>=2) pessoas_multiplas_empresas,
          count(*) FILTER(WHERE NOT declared AND NOT linked)::int empresas_individuais,
          count(*) FILTER(WHERE NOT declared AND linked AND person_companies<2)::int vinculos_societarios_isolados,
          count(*) FILTER(WHERE declared)::int holdings_declaradas,
          (SELECT count(*)::int FROM pc WHERE n>=2) candidatas_holding,
          0::int empresas_ligadas_grupo,(SELECT count(*)::int FROM documented) grupos_documentais,
          0::int empresas_propriedade_comprovada,
          0::int empresas_empresa_360 FROM companies""", domain="agro")
        return {"status": "ok", **(rows[0] if rows else {}), "sources": SOURCES, "limitations": LIMITATIONS}

    @staticmethod
    def list(tab="empresas", page=1, page_size=25, **filters):
        size = page_size if page_size in (25, 50, 100) else 25
        page = max(1, int(page))
        if tab == "candidatos":
            return AgroHoldingsRepository._candidates(page, size, **filters)
        if tab == "grupos":
            return AgroHoldingsRepository._groups(page, size, **filters)
        return AgroHoldingsRepository._companies(page, size, **filters)

    @staticmethod
    def _company_where(q=None, uf=None, municipio=None, tipo_entidade=None, motivo_inclusao=None,
                       evidencia_grupo=None, com_multiplas_empresas=None, com_propriedade=None,
                       com_empresa_360=None, pessoa_id=None, cnae=None, **_):
        where, params = ["TRUE"], []
        if q:
            where.append("(l.razao ILIKE %s OR l.nome_fantasia ILIKE %s OR l.cnpj14 ILIKE %s OR l.municipio ILIKE %s)")
            params.extend([f"%{q}%"] * 4)
        if uf: where.append("l.uf=%s"); params.append(uf.upper())
        if municipio: where.append("l.municipio ILIKE %s"); params.append(f"%{municipio}%")
        classification = f"CASE WHEN {HOLDING_CNAE} THEN 'HOLDING_DECLARADA' WHEN COALESCE(pc.n,0)>=2 THEN 'CANDIDATA_A_HOLDING' WHEN b.cnpj_basico IS NOT NULL THEN 'VINCULO_SOCIETARIO_ISOLADO' ELSE 'EMPRESA_INDIVIDUAL' END"
        if tipo_entidade: where.append(f"({classification})=%s"); params.append(tipo_entidade)
        if motivo_inclusao:
            where.append("(CASE WHEN b.cnpj_basico IS NOT NULL THEN 'PESSOA_LIGADA_A_EMPRESA_AGRO' ELSE 'OUTRA_EVIDENCIA_DOCUMENTAL' END)=%s")
            params.append(motivo_inclusao)
        if evidencia_grupo:
            evidence = f"CASE WHEN {HOLDING_CNAE} THEN 'PARCIAL' WHEN COALESCE(pc.n,0)>=2 THEN 'CANDIDATA' ELSE 'NÃO COMPROVADA' END"
            where.append(f"({evidence})=%s"); params.append(evidencia_grupo)
        if com_multiplas_empresas is not None:
            where.append("COALESCE(pc.n,0)>=2" if com_multiplas_empresas else "COALESCE(pc.n,0)<2")
        if com_propriedade is True: where.append("FALSE")
        if com_empresa_360 is False: where.append("FALSE")
        if pessoa_id:
            where.append("encode(digest(b.cpf_socio_comum,'sha256'),'hex')=%s"); params.append(pessoa_id)
        if cnae: where.append("l.cnae_principal ILIKE %s"); params.append(f"%{cnae}%")
        return " AND ".join(where), params, classification

    @staticmethod
    def _companies(page, size, sort="razao_social", order="asc", **filters):
        where, params, classification = AgroHoldingsRepository._company_where(**filters)
        base = f"""SELECT l.*,b.nome_socio_comum,b.cpf_socio_comum,b.qualif_socio,b.agro_cnpj_basico,
          b.descoberto_em,b.enriquecido_em,COALESCE(pc.n,0)::int person_companies,{classification} tipo_entidade
          ,CASE WHEN b.cpf_socio_comum IS NOT NULL THEN encode(digest(b.cpf_socio_comum,'sha256'),'hex') END person_id
          FROM prospeccao.holding_lead_ui l LEFT JOIN prospeccao.holding_blind_spot b USING(cnpj_basico)
          LEFT JOIN (SELECT cpf_socio_comum,count(*) n FROM prospeccao.holding_blind_spot GROUP BY 1) pc
          ON pc.cpf_socio_comum=b.cpf_socio_comum WHERE {where}"""
        totals = _run_db("wins_agro", f"WITH entities AS ({base}) SELECT count(*)::int total FROM entities", params, domain="agro")
        total = totals[0]["total"] if totals else 0
        sort_map = {"razao_social": "razao", "municipio": "municipio", "uf": "uf",
                    "total_empresas": "person_companies", "evidencia_grupo": "tipo_entidade",
                    "atualizacao": "enriquecido_em"}
        column = sort_map.get(sort, "razao"); direction = "DESC" if order == "desc" else "ASC"
        rows = _run_db("wins_agro", f"WITH entities AS ({base}) SELECT * FROM entities ORDER BY {column} {direction} NULLS LAST,cnpj14 ASC LIMIT %s OFFSET %s", params + [size, (page-1)*size], domain="agro")
        items = [AgroHoldingsRepository._company_item(row) for row in rows]
        return AgroHoldingsRepository._response(items,total,page,size,"empresas")

    @staticmethod
    def _company_item(row):
        person_id = row.get("person_id")
        declared = row.get("tipo_entidade") == "HOLDING_DECLARADA"
        candidate = row.get("tipo_entidade") == "CANDIDATA_A_HOLDING"
        reason = "PESSOA_LIGADA_A_EMPRESA_AGRO" if row.get("agro_cnpj_basico") else "OUTRA_EVIDENCIA_DOCUMENTAL"
        return {"entity_id": row.get("cnpj14"), "cnpj": row.get("cnpj14"),
                "razao_social": row.get("razao"), "nome_fantasia": row.get("nome_fantasia"),
                "tipo_entidade": row.get("tipo_entidade"), "cnae_principal": row.get("cnae_principal"),
                "municipio": row.get("municipio"), "uf": row.get("uf"),
                "pessoa_selecionada_id": person_id, "pessoa_selecionada_nome": row.get("nome_socio_comum"),
                "pessoa_selecionada_tipo_vinculo": _person_type(row.get("qualif_socio")) if person_id else None,
                "pessoa_compartilhada_total_empresas": row.get("person_companies",0),
                "motivo_inclusao": reason,
                "motivo_descricao": "Pessoa selecionada também consta em empresa do universo Agro." if row.get("agro_cnpj_basico") else "Empresa incluída por evidência cadastral do recorte existente.",
                "motivo_fonte": "RFB/QSA" if row.get("agro_cnpj_basico") else "RFB",
                "motivo_data": str(row.get("enriquecido_em") or row.get("descoberto_em") or "") or None,
                "motivo_confianca": "PARCIAL", "evidencia_societaria": "COMPROVADA" if person_id else "INDISPONÍVEL",
                "evidencia_grupo": "PARCIAL" if declared else "CANDIDATA" if candidate else "NÃO COMPROVADA",
                "evidencia_agro": "PARCIAL" if row.get("agro_cnpj_basico") else "INDISPONÍVEL",
                "evidencia_ativo_rural": "INDISPONÍVEL", "documented_group_id": None,
                "documented_group_name": None, "empresa_360_available": False,
                "sources": SOURCES, "limitations": list(LIMITATIONS)}

    @staticmethod
    def _candidates(page, size, q=None, uf=None, municipio=None, pessoa_id=None,
                    sort="total_empresas", order="desc", **_):
        where, params = ["TRUE"], []
        if q: where.append("(nome ILIKE %s)"); params.append(f"%{q}%")
        if pessoa_id: where.append("person_id=%s"); params.append(pessoa_id)
        people = """SELECT encode(digest(b.cpf_socio_comum,'sha256'),'hex') person_id,
          max(b.nome_socio_comum) nome,count(*)::int total_companies,
          count(DISTINCT l.municipio)::int total_municipalities,count(DISTINCT l.uf)::int total_states
          FROM prospeccao.holding_blind_spot b LEFT JOIN prospeccao.holding_lead_ui l USING(cnpj_basico)
          GROUP BY b.cpf_socio_comum HAVING count(*)>=2"""
        filtered = f"SELECT * FROM ({people}) p WHERE {' AND '.join(where)}"
        if uf or municipio:
            exists = """EXISTS(SELECT 1 FROM prospeccao.holding_blind_spot bx JOIN prospeccao.holding_lead_ui lx USING(cnpj_basico)
              WHERE encode(digest(bx.cpf_socio_comum,'sha256'),'hex')=p.person_id"""
            if uf: exists += " AND lx.uf=%s"; params.append(uf.upper())
            if municipio: exists += " AND lx.municipio ILIKE %s"; params.append(f"%{municipio}%")
            exists += ")"; filtered += f" AND {exists}"
        total_rows = _run_db("wins_agro", f"WITH candidates AS ({filtered}) SELECT count(*)::int total FROM candidates", params, domain="agro")
        total = total_rows[0]["total"] if total_rows else 0
        sort_map = {"razao_social":"nome","total_empresas":"total_companies","municipio":"total_municipalities","uf":"total_states","atualizacao":"nome","evidencia_grupo":"nome"}
        column=sort_map.get(sort,"total_companies"); direction="DESC" if order=="desc" else "ASC"
        rows = _run_db("wins_agro", f"WITH candidates AS ({filtered}) SELECT * FROM candidates ORDER BY {column} {direction},nome,person_id LIMIT %s OFFSET %s", params+[size,(page-1)*size], domain="agro")
        ids=[r["person_id"] for r in rows]; previews={}
        if ids:
            links=_run_db("wins_agro", """WITH ranked AS (SELECT encode(digest(b.cpf_socio_comum,'sha256'),'hex') person_id,
              l.cnpj14,l.razao,l.municipio,l.uf,row_number() OVER(PARTITION BY b.cpf_socio_comum ORDER BY l.razao,l.cnpj14) rn
              FROM prospeccao.holding_blind_spot b LEFT JOIN prospeccao.holding_lead_ui l USING(cnpj_basico)
              WHERE encode(digest(b.cpf_socio_comum,'sha256'),'hex')=ANY(%s)) SELECT * FROM ranked WHERE rn<=3""",[ids],domain="agro")
            for link in links: previews.setdefault(link["person_id"],[]).append({"cnpj":link.get("cnpj14"),"razao_social":link.get("razao"),"municipio":link.get("municipio"),"uf":link.get("uf")})
        items=[{"candidate_id":r["person_id"],"classification":"CANDIDATA_A_HOLDING",
                "connecting_person_id":r["person_id"],"connecting_person_name":r["nome"],
                "total_companies":r["total_companies"],"companies_preview":previews.get(r["person_id"],[]),
                "total_municipalities":r["total_municipalities"],"total_states":r["total_states"],
                "evidence":"CANDIDATA","limitations":["Pessoa em comum não comprova controle societário ou grupo econômico."]} for r in rows]
        return AgroHoldingsRepository._response(items,total,page,size,"candidatos")

    @staticmethod
    def _groups(page,size,q=None,sort="razao_social",order="asc",**_):
        where="source_type='Grupo' AND target_type='Empresa' AND fonte_documental IS NOT NULL"
        params=[]
        if q: where += " AND (source_id ILIKE %s OR evidencia ILIKE %s)"; params.extend([f"%{q}%"]*2)
        grouped=f"""SELECT source_id group_id,count(DISTINCT target_id)::int total_companies,
          0::int total_people,0::int total_states,max(tipo_relacao) formation_criterion,
          max(fonte_documental) evidence_source,max(verificado_em)::text evidence_date
          FROM public.relationship_edges WHERE {where} GROUP BY source_id"""
        totals=_run_db("wins_agro",f"WITH groups AS ({grouped}) SELECT count(*)::int total FROM groups",params,domain="agro")
        total=totals[0]["total"] if totals else 0
        rows=_run_db("wins_agro",f"WITH groups AS ({grouped}) SELECT * FROM groups ORDER BY group_id {'DESC' if order=='desc' else 'ASC'} LIMIT %s OFFSET %s",params+[size,(page-1)*size],domain="agro")
        items=[{"group_id":r["group_id"],"group_name":f"Grupo documental {str(r['group_id'])[:8]}",
                "classification":"GRUPO_DOCUMENTAL","formation_criterion":r.get("formation_criterion"),
                "total_companies":r["total_companies"],"total_people":r["total_people"],"total_states":r["total_states"],
                "companies_preview":[],"connecting_people":[],"evidence_source":r.get("evidence_source"),
                "evidence_date":r.get("evidence_date"),"evidence_level":"COMPROVADA","limitations":[]} for r in rows]
        return AgroHoldingsRepository._response(items,total,page,size,"grupos")

    @staticmethod
    def _response(items,total,page,size,tab):
        pages=math.ceil(total/size) if total else 0
        stats=AgroHoldingsRepository.stats()
        return {"items":items,"total_entities":total,"total_companies":stats.get("empresas_representadas",0),
                "total_candidates":stats.get("candidatas_holding",0),"total_documented_groups":stats.get("grupos_documentais",0),
                "page":page,"page_size":size,"total_pages":pages,"has_previous":page>1,
                "has_next":page<pages,"tab":tab,"status":"partial","sources":SOURCES,"limitations":LIMITATIONS}

    @staticmethod
    def entity_detail(entity_id):
        data=AgroHoldingsRepository._companies(1,25,q=entity_id)
        company=next((x for x in data["items"] if x["entity_id"]==entity_id),None)
        if not company:return None
        return {"status":"partial","entity":company,"documented_group":None,"properties":None,
                "company_360_url":None,
                "message_group":"Nenhum grupo econômico documentalmente comprovado foi identificado.",
                "sources":SOURCES,"limitations":LIMITATIONS}

    @staticmethod
    def group_detail(group_id):
        rows=_run_db("wins_agro","""SELECT source_id group_id,target_id company_id,tipo_relacao formation_criterion,
          evidencia,fonte_documental,verificado_em::text evidence_date FROM public.relationship_edges
          WHERE source_type='Grupo' AND target_type='Empresa' AND fonte_documental IS NOT NULL AND source_id=%s""",[group_id],domain="agro")
        if not rows:return None
        return {"status":"partial","group":{"group_id":group_id,"group_name":f"Grupo documental {group_id[:8]}",
          "classification":"GRUPO_DOCUMENTAL","formation_criterion":rows[0].get("formation_criterion"),
          "total_companies":len({r['company_id'] for r in rows}),"total_people":0,"total_states":0,
          "companies":[{"entity_id":r["company_id"]} for r in rows],"connecting_people":[],
          "evidence_source":rows[0].get("fonte_documental"),"evidence_date":rows[0].get("evidence_date"),
          "evidence_level":"COMPROVADA","properties":None,"limitations":[]},"sources":[rows[0].get("fonte_documental")]}
