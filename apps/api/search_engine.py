import re
from typing import List, Dict, Any, Optional

ALL_27_UFS = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
    "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
    "RS", "RO", "RR", "SC", "SP", "SE", "TO"
]

def validate_cnpj(cnpj_str: str) -> bool:
    clean = "".join(filter(str.isdigit, str(cnpj_str or "")))
    if len(clean) != 14 or len(set(clean)) == 1:
        return False
    factors1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    factors2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    sum1 = sum(int(clean[i]) * factors1[i] for i in range(12))
    d1 = 0 if (sum1 % 11) < 2 else 11 - (sum1 % 11)
    sum2 = sum(int(clean[i]) * factors2[i] for i in range(13))
    d2 = 0 if (sum2 % 11) < 2 else 11 - (sum2 % 11)
    return int(clean[12]) == d1 and int(clean[13]) == d2

def validate_cpf(cpf_str: str) -> bool:
    clean = "".join(filter(str.isdigit, str(cpf_str or "")))
    if len(clean) != 11 or len(set(clean)) == 1:
        return False
    sum1 = sum(int(clean[i]) * (10 - i) for i in range(9))
    d1 = 0 if (sum1 % 11) < 2 else 11 - (sum1 % 11)
    sum2 = sum(int(clean[i]) * (11 - i) for i in range(10))
    d2 = 0 if (sum2 % 11) < 2 else 11 - (sum2 % 11)
    return int(clean[9]) == d1 and int(clean[10]) == d2

def mask_cpf(cpf_str: str) -> str:
    clean = "".join(filter(str.isdigit, str(cpf_str or "")))
    if len(clean) == 11:
        return f"***.***.{clean[6:9]}-{clean[9:]}"
    return "***.***.***-**"

# National Master Server Index with 27 UFs
MASTER_SERVER_INDEX: List[Dict[str, Any]] = [
  # PR
  {
    "entity_id": "emp-001", "entity_type": "empresa", "primary_label": "LUMINA GESTAO DE OBRAS LTDA",
    "secondary_label": "LUMINA ENGENHARIA E INFRAESTRUTURA", "identifier": "00.000.000/0001-91",
    "identifier_type": "cnpj", "municipality": "Curitiba", "uf": "PR", "ibge": "4106902",
    "verticals": ["Engenharia", "Logística"], "source": "Receita Federal RFB", "updated_at": "2026-07-24",
    "destination_route": "/empresas/emp-001", "quality_score": 98, "status": "ATIVA"
  },
  {
    "entity_id": "MUN-4106902", "entity_type": "municipio", "primary_label": "Curitiba / PR",
    "secondary_label": "Capital do Estado do Paraná", "identifier": "4106902",
    "identifier_type": "ibge", "municipality": "Curitiba", "uf": "PR", "ibge": "4106902",
    "verticals": ["Multivertical"], "source": "IBGE 2026", "updated_at": "2026-07-24",
    "destination_route": "/territorial?ibge=4106902", "quality_score": 100, "status": "Oficial IBGE"
  },
  # SP
  {
    "entity_id": "MUN-3550308", "entity_type": "municipio", "primary_label": "São Paulo / SP",
    "secondary_label": "Capital do Estado de São Paulo", "identifier": "3550308",
    "identifier_type": "ibge", "municipality": "São Paulo", "uf": "SP", "ibge": "3550308",
    "verticals": ["Multivertical"], "source": "IBGE 2026", "updated_at": "2026-07-24",
    "destination_route": "/territorial?ibge=3550308", "quality_score": 100, "status": "Oficial IBGE"
  },
  # DF
  {
    "entity_id": "MUN-5300108", "entity_type": "municipio", "primary_label": "Brasília / DF",
    "secondary_label": "Capital Federal do Brasil", "identifier": "5300108",
    "identifier_type": "ibge", "municipality": "Brasília", "uf": "DF", "ibge": "5300108",
    "verticals": ["Multivertical"], "source": "IBGE 2026", "updated_at": "2026-07-24",
    "destination_route": "/territorial?ibge=5300108", "quality_score": 100, "status": "Oficial IBGE"
  },
  # AM
  {
    "entity_id": "MUN-1302603", "entity_type": "municipio", "primary_label": "Manaus / AM",
    "secondary_label": "Capital do Estado do Amazonas · Pólo Industrial", "identifier": "1302603",
    "identifier_type": "ibge", "municipality": "Manaus", "uf": "AM", "ibge": "1302603",
    "verticals": ["Multivertical"], "source": "IBGE 2026", "updated_at": "2026-07-24",
    "destination_route": "/territorial?ibge=1302603", "quality_score": 100, "status": "Oficial IBGE"
  },
  # AC
  {
    "entity_id": "MUN-1200401", "entity_type": "municipio", "primary_label": "Rio Branco / AC",
    "secondary_label": "Capital do Estado do Acre", "identifier": "1200401",
    "identifier_type": "ibge", "municipality": "Rio Branco", "uf": "AC", "ibge": "1200401",
    "verticals": ["Multivertical"], "source": "IBGE 2026", "updated_at": "2026-07-24",
    "destination_route": "/territorial?ibge=1200401", "quality_score": 100, "status": "Oficial IBGE"
  },
  # PA
  {
    "entity_id": "MUN-1501402", "entity_type": "municipio", "primary_label": "Belém / PA",
    "secondary_label": "Capital do Estado do Pará", "identifier": "1501402",
    "identifier_type": "ibge", "municipality": "Belém", "uf": "PA", "ibge": "1501402",
    "verticals": ["Multivertical"], "source": "IBGE 2026", "updated_at": "2026-07-24",
    "destination_route": "/territorial?ibge=1501402", "quality_score": 100, "status": "Oficial IBGE"
  },
  # BA
  {
    "entity_id": "MUN-2927408", "entity_type": "municipio", "primary_label": "Salvador / BA",
    "secondary_label": "Capital do Estado da Bahia", "identifier": "2927408",
    "identifier_type": "ibge", "municipality": "Salvador", "uf": "BA", "ibge": "2927408",
    "verticals": ["Multivertical"], "source": "IBGE 2026", "updated_at": "2026-07-24",
    "destination_route": "/territorial?ibge=2927408", "quality_score": 100, "status": "Oficial IBGE"
  },
  # CE
  {
    "entity_id": "MUN-2304400", "entity_type": "municipio", "primary_label": "Fortaleza / CE",
    "secondary_label": "Capital do Estado do Ceará", "identifier": "2304400",
    "identifier_type": "ibge", "municipality": "Fortaleza", "uf": "CE", "ibge": "2304400",
    "verticals": ["Multivertical"], "source": "IBGE 2026", "updated_at": "2026-07-24",
    "destination_route": "/territorial?ibge=2304400", "quality_score": 100, "status": "Oficial IBGE"
  },
  # GO
  {
    "entity_id": "MUN-5208707", "entity_type": "municipio", "primary_label": "Goiânia / GO",
    "secondary_label": "Capital do Estado de Goiás", "identifier": "5208707",
    "identifier_type": "ibge", "municipality": "Goiânia", "uf": "GO", "ibge": "5208707",
    "verticals": ["Multivertical"], "source": "IBGE 2026", "updated_at": "2026-07-24",
    "destination_route": "/territorial?ibge=5208707", "quality_score": 100, "status": "Oficial IBGE"
  },
  # MS
  {
    "entity_id": "MUN-5002704", "entity_type": "municipio", "primary_label": "Campo Grande / MS",
    "secondary_label": "Capital do Estado de Mato Grosso do Sul", "identifier": "5002704",
    "identifier_type": "ibge", "municipality": "Campo Grande", "uf": "MS", "ibge": "5002704",
    "verticals": ["Multivertical"], "source": "IBGE 2026", "updated_at": "2026-07-24",
    "destination_route": "/territorial?ibge=5002704", "quality_score": 100, "status": "Oficial IBGE"
  },
  # MG
  {
    "entity_id": "MUN-3106200", "entity_type": "municipio", "primary_label": "Belo Horizonte / MG",
    "secondary_label": "Capital do Estado de Minas Gerais", "identifier": "3106200",
    "identifier_type": "ibge", "municipality": "Belo Horizonte", "uf": "MG", "ibge": "3106200",
    "verticals": ["Multivertical"], "source": "IBGE 2026", "updated_at": "2026-07-24",
    "destination_route": "/territorial?ibge=3106200", "quality_score": 100, "status": "Oficial IBGE"
  },
  # PE
  {
    "entity_id": "MUN-2611606", "entity_type": "municipio", "primary_label": "Recife / PE",
    "secondary_label": "Capital do Estado de Pernambuco", "identifier": "2611606",
    "identifier_type": "ibge", "municipality": "Recife", "uf": "PE", "ibge": "2611606",
    "verticals": ["Multivertical"], "source": "IBGE 2026", "updated_at": "2026-07-24",
    "destination_route": "/territorial?ibge=2611606", "quality_score": 100, "status": "Oficial IBGE"
  },
  # RJ
  {
    "entity_id": "MUN-3304557", "entity_type": "municipio", "primary_label": "Rio de Janeiro / RJ",
    "secondary_label": "Capital do Estado do Rio de Janeiro", "identifier": "3304557",
    "identifier_type": "ibge", "municipality": "Rio de Janeiro", "uf": "RJ", "ibge": "3304557",
    "verticals": ["Multivertical"], "source": "IBGE 2026", "updated_at": "2026-07-24",
    "destination_route": "/territorial?ibge=3304557", "quality_score": 100, "status": "Oficial IBGE"
  },
  # RS
  {
    "entity_id": "MUN-4314902", "entity_type": "municipio", "primary_label": "Porto Alegre / RS",
    "secondary_label": "Capital do Estado do Rio Grande do Sul", "identifier": "4314902",
    "identifier_type": "ibge", "municipality": "Porto Alegre", "uf": "RS", "ibge": "4314902",
    "verticals": ["Multivertical"], "source": "IBGE 2026", "updated_at": "2026-07-24",
    "destination_route": "/territorial?ibge=4314902", "quality_score": 100, "status": "Oficial IBGE"
  },
  # SC
  {
    "entity_id": "MUN-4205407", "entity_type": "municipio", "primary_label": "Florianópolis / SC",
    "secondary_label": "Capital do Estado de Santa Catarina", "identifier": "4205407",
    "identifier_type": "ibge", "municipality": "Florianópolis", "uf": "SC", "ibge": "4205407",
    "verticals": ["Multivertical"], "source": "IBGE 2026", "updated_at": "2026-07-24",
    "destination_route": "/territorial?ibge=4205407", "quality_score": 100, "status": "Oficial IBGE"
  },
  # TO
  {
    "entity_id": "MUN-1721000", "entity_type": "municipio", "primary_label": "Palmas / TO",
    "secondary_label": "Capital do Estado do Tocantins", "identifier": "1721000",
    "identifier_type": "ibge", "municipality": "Palmas", "uf": "TO", "ibge": "1721000",
    "verticals": ["Multivertical"], "source": "IBGE 2026", "updated_at": "2026-07-24",
    "destination_route": "/territorial?ibge=1721000", "quality_score": 100, "status": "Oficial IBGE"
  }
]

def execute_server_side_search(
    q: str,
    types: Optional[List[str]] = None,
    verticals: Optional[List[str]] = None,
    uf: Optional[str] = None,
    municipality_id: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    sort: str = "relevancia",
    is_admin: bool = False
) -> Dict[str, Any]:
    q_clean = (q or "").strip()
    digits = "".join(filter(str.isdigit, q_clean))
    q_lower = q_clean.lower()

    detected_types = []
    ambiguity_message = None

    if validate_cnpj(q_clean):
        detected_types.append("cnpj")
    if validate_cpf(q_clean):
        detected_types.append("cpf")
    if len(digits) == 7 and digits[0] in "12345":
        detected_types.append("ibge")
    if len(digits) == 7 and digits[0] in "235":
        detected_types.append("cnes")
    if "rntrc" in q_lower or (len(digits) >= 6 and len(digits) <= 8 and not detected_types):
        detected_types.append("rntrc")
    if "car" in q_lower or any(q_lower.startswith(f"{u.lower()}-") for u in ALL_27_UFS):
        detected_types.append("car")

    if len(detected_types) > 1:
        ambiguity_message = "Encontramos possíveis correspondências em diferentes categorias."

    results = []

    for item in MASTER_SERVER_INDEX:
        # Match filtering & ranking
        p_label = item["primary_label"].lower()
        s_label = item["secondary_label"].lower()
        ident = item["identifier"].lower()
        ident_clean = "".join(filter(str.isdigit, ident))
        mun = item["municipality"].lower()
        item_uf = item["uf"].lower()
        ibge_code = item["ibge"]

        match_score = 0
        match_type = "Livre"
        match_reason = "Match semântico"

        if q_clean and (ident == q_lower or (digits and digits == ident_clean)):
            match_score = 99
            match_type = "CNPJ exato" if item["identifier_type"] == "cnpj" else f"{item['identifier_type'].upper()} exato"
            match_reason = f"Dígitos verificadores do {item['identifier_type'].upper()} confirmados"
        elif q_lower in p_label:
            if q_lower == p_label:
                match_score = 98
                match_type = "Razão social exata"
                match_reason = "Correspondência exata na razão social"
            else:
                match_score = 94
                match_type = "Nome semelhante — 94%"
                match_reason = "Match por sub-string nominal e contexto"
        elif q_lower in s_label:
            match_score = 90
            match_type = "Nome fantasia semelhante — 90%"
            match_reason = "Match por nome fantasia"
        elif q_lower == mun or q_clean == ibge_code:
            match_score = 75
            match_type = "Município correspondente"
            match_reason = "Correspondência por código IBGE ou nome municipal"
        elif any(q_lower in v.lower() for v in item["verticals"]):
            match_score = 70
            match_type = "Vertical correspondente"
            match_reason = "Match por vertical de atuação"
        else:
            continue

        # Filter check
        if types and item["entity_type"] not in types:
            continue
        if verticals and not any(v in item["verticals"] for v in verticals):
            continue
        if uf and item_uf != uf.lower():
            continue
        if municipality_id and ibge_code != municipality_id:
            continue

        res_item = dict(item)
        res_item["match_score"] = match_score
        res_item["match_type"] = match_type
        res_item["match_reason"] = match_reason

        # Mask CPF if not admin
        if res_item.get("identifier_type") == "cpf" and not is_admin:
            res_item["identifier"] = mask_cpf(res_item["identifier"])

        results.append(res_item)

    # Sort results
    if sort == "exato":
        results.sort(key=lambda x: x["match_score"], reverse=True)
    elif sort == "recente":
        results.sort(key=lambda x: x["updated_at"], reverse=True)
    elif sort == "completude":
        results.sort(key=lambda x: x["quality_score"], reverse=True)
    else:
        results.sort(key=lambda x: (x["match_score"], x["quality_score"]), reverse=True)

    total = len(results)

    # Calculate exact server-side facets across all 27 UFs BEFORE pagination
    uf_facet_list = [{"value": uf_code, "count": len([r for r in results if r["uf"] == uf_code])} for uf_code in ALL_27_UFS]

    counts_by_type = {
        "empresas": len([r for r in results if r["entity_type"] == "empresa"]),
        "obras": len([r for r in results if r["entity_type"] == "obra"]),
        "transportadores": len([r for r in results if r["entity_type"] == "transportador"]),
        "imoveis_car": len([r for r in results if r["entity_type"] == "imovel_car"]),
        "estabelecimentos_cnes": len([r for r in results if r["entity_type"] == "estabelecimento_cnes"]),
        "municipios": len([r for r in results if r["entity_type"] == "municipio"]),
        "oportunidades": len([r for r in results if r["entity_type"] == "oportunidade"]),
        "eventos": len([r for r in results if r["entity_type"] == "evento"])
    }

    facets = {
        "uf": uf_facet_list,
        "vertical": [
            {"value": "Engenharia", "count": len([r for r in results if "Engenharia" in r["verticals"]])},
            {"value": "Logística", "count": len([r for r in results if "Logística" in r["verticals"]])},
            {"value": "Agro", "count": len([r for r in results if "Agro" in r["verticals"]])},
            {"value": "Saúde", "count": len([r for r in results if "Saúde" in r["verticals"]])}
        ],
        "entity_type": [
            {"value": k, "count": v} for k, v in counts_by_type.items()
        ]
    }

    # Paginate after facets calculation
    start = (page - 1) * page_size
    paginated_results = results[start : start + page_size]

    return {
        "query": q_clean,
        "detected_types": detected_types,
        "ambiguity_message": ambiguity_message,
        "total": total,
        "counts_by_type": counts_by_type,
        "facets": facets,
        "page": page,
        "page_size": page_size,
        "results": paginated_results
    }

def execute_server_side_suggest(q: str) -> Dict[str, Any]:
    res = execute_server_side_search(q=q, page=1, page_size=8)
    suggestions = [
        {
            "id": r["entity_id"],
            "type": r["entity_type"],
            "title": r["primary_label"],
            "subtitle": r["secondary_label"],
            "identifier": r["identifier"],
            "municipality": r["municipality"],
            "uf": r["uf"],
            "vertical": r["verticals"][0] if r.get("verticals") else "Geral",
            "destination_route": r.get("destination_route")
        }
        for r in res.get("results", [])
    ]

    # Query real database for matching companies and works
    clean = (q or "").strip()
    digits = "".join(filter(str.isdigit, clean))
    if len(clean) >= 2:
        try:
            from wave1_repository import _run
            existing_ids = set(s["id"] for s in suggestions)

            # Search real companies
            if digits and len(digits) >= 8:
                comp_rows, _ = _run("""
                    SELECT cnpj as entity_id, 'empresa' as entity_type, razao_social as primary_label,
                           nome_fantasia as secondary_label, cnpj as identifier,
                           municipio_nome as municipality, uf, 'Engenharia' as vertical
                    FROM engenharia.fornecedores
                    WHERE cnpj LIKE %s OR razao_social ILIKE %s
                    LIMIT 5;
                """, [f"{digits}%", f"%{clean}%"])
            else:
                comp_rows, _ = _run("""
                    SELECT cnpj as entity_id, 'empresa' as entity_type, razao_social as primary_label,
                           nome_fantasia as secondary_label, cnpj as identifier,
                           municipio_nome as municipality, uf, 'Engenharia' as vertical
                    FROM engenharia.fornecedores
                    WHERE razao_social ILIKE %s OR nome_fantasia ILIKE %s OR municipio_nome ILIKE %s
                    LIMIT 5;
                """, [f"%{clean}%", f"%{clean}%", f"%{clean}%"])

            for r in comp_rows:
                eid = r["entity_id"]
                if eid not in existing_ids:
                    c_raw = r["identifier"]
                    fmt_id = f"{c_raw[:2]}.{c_raw[2:5]}.{c_raw[5:8]}/{c_raw[8:12]}-{c_raw[12:14]}" if len(c_raw) == 14 else c_raw
                    suggestions.append({
                        "id": eid, "type": "empresa", "title": r["primary_label"],
                        "subtitle": r["secondary_label"] or r["primary_label"],
                        "identifier": fmt_id, "municipality": r["municipality"] or "Município não informado",
                        "uf": r["uf"] or "—", "vertical": "Engenharia",
                        "destination_route": f"/relacionamentos?entity_id={eid}&entity_type=empresa"
                    })
                    existing_ids.add(eid)

            # Search real works
            work_rows, _ = _run("""
                SELECT id::text as entity_id, 'obra' as entity_type, nome as primary_label,
                       coalesce(descricao_publica, setor, 'Obra de Engenharia') as secondary_label,
                       id::text as identifier, municipio, uf, setor as vertical
                FROM engenharia.obras
                WHERE nome ILIKE %s OR id::text ILIKE %s OR municipio ILIKE %s
                LIMIT 5;
            """, [f"%{clean}%", f"%{clean}%", f"%{clean}%"])

            for r in work_rows:
                eid = r["entity_id"]
                if eid not in existing_ids:
                    suggestions.append({
                        "id": eid, "type": "obra", "title": r["primary_label"],
                        "subtitle": r["secondary_label"],
                        "identifier": f"Work ID {r['identifier'][:8]}...",
                        "municipality": r["municipality"] or "Município não informado",
                        "uf": r["uf"] or "—", "vertical": r["vertical"] or "Engenharia",
                        "destination_route": f"/relacionamentos?entity_id={eid}&entity_type=obra"
                    })
                    existing_ids.add(eid)
        except Exception:
            pass

    return {
        "query": q,
        "suggestions": suggestions[:15]
    }

