"""Consultas somente-leitura para Canal Técnico e Deserto Veterinário."""

import math
from typing import Any, Optional

from database import get_connection, release_connection
from psycopg2.extras import RealDictCursor


TECH_SOURCES = [
    "prospeccao.v_tecnico_full", "prospeccao.tecnico_social", "prospeccao.tecnico_crea",
    "prospeccao.canal_central", "cnpj.estabelecimento_vet",
]
GEO_MESSAGE = "A camada de proximidade técnico–fazenda está temporariamente indisponível."
SOURCE_METADATA = {
    "v_tecnico_full": {"label": "Base integrada Canal Técnico", "object": "prospeccao.v_tecnico_full"},
    "tecnico_crea": {"label": "Cadastro de profissionais CREA", "object": "prospeccao.tecnico_crea"},
    "canal_central": {"label": "Base institucional ABCZ", "object": "prospeccao.canal_central"},
    "estabelecimento_vet": {"label": "Cadastro empresarial veterinário", "object": "cnpj.estabelecimento_vet"},
}
PROFESSIONAL_TYPES = ("PROFISSIONAL_NOMINAL", "AGRONOMO_CREA", "ORIGEM_ABCZ")
ESTABLISHMENT_TYPES = ("ESTABELECIMENTO_VETERINARIO", "PROVAVEL_POR_CNAE")


# ---------------------------------------------------------------------------
# Deserto Veterinário — regra publicada (READ ONLY, sem alteração de limiares)
# Fonte canônica: prospeccao.v_white_space_pecuaria + prospeccao.mv_mun_regional
# ---------------------------------------------------------------------------
DESERTO_RULE_VERSION = "deserto-regional-v3"
DESERTO_RULE_SOURCE = "prospeccao.v_white_space_pecuaria"
DESERTO_THRESHOLDS = {
    "piso_bovinos_municipio": 1000,
    "carga_deserto": 40000,
    "carga_baixa": 15000,
    "raio_km": 75,
}
# Contagem regional em mv_mun_regional: estabelecimentos CNPJ ativos com estes CNAEs
DESERTO_TECHNICAL_CNAES = ("7500100", "0162801", "0162899", "0162803")
DESERTO_TECHNICAL_CNAE_LABELS = {
    "7500100": "Atividades veterinárias (CNAE 75.00-1-00)",
    "0162801": "Serviço de inseminação artificial em animais (CNAE 01.62-8-01)",
    "0162803": "Serviço de manejo de animais (CNAE 01.62-8-03)",
    "0162899": "Atividades de apoio à pecuária não especificadas (CNAE 01.62-8-99)",
}
DESERTO_TECHNICAL_SCOPE = "KNOWN_TECHNICAL_PRESENCE"
DESERTO_GEOGRAPHIC_METHOD = "MUNICIPAL_CENTROID_EARTH_DISTANCE_75KM"
DESERTO_CATTLE_SOURCE = "IBGE PPM"
DESERTO_CATTLE_YEAR = 2023
DESERTO_LIMITATIONS = [
    "Presença técnica conhecida na base ≠ disponibilidade real de atendimento.",
    "O denominador conta estabelecimentos CNPJ ativos por CNAE elegível no raio, não veterinários habilitados individualmente.",
    "CRMV informado no Canal Técnico não entra na regra do Deserto e permanece NOT_VALIDATED.",
    "Geografia usa centroides municipais (earth_distance / ll_to_earth), não coordenadas individuais de profissionais.",
    "prospeccao.mv_tecnico_geo está ausente; proximidade técnico→fazenda individual não é calculável.",
    "Rebanho municipal é IBGE PPM de competência 2023 — não é rebanho em tempo real.",
    "CREA, ABCZ e profissionais nominais do Canal Técnico não entram no denominador regional.",
]
CLASSIFICATION_LABELS = {
    "DESERTO_VET": "Deserto Veterinário",
    "BAIXA_COBERTURA": "Baixa cobertura",
    "NORMAL": "Cobertura normal",
}


def _deserto_reason(bovinos, tecnicos_75km, carga_regional) -> str:
    """Espelha o CASE publicado em v_white_space_pecuaria — ordem idêntica."""
    cattle = 0 if bovinos is None else int(bovinos)
    techs = 0 if tecnicos_75km is None else int(tecnicos_75km)
    if cattle < DESERTO_THRESHOLDS["piso_bovinos_municipio"]:
        return "CATTLE_BELOW_MINIMUM"
    if techs == 0:
        return "NO_KNOWN_ELIGIBLE_TECHNICAL_PRESENCE"
    if carga_regional is not None and int(carga_regional) >= DESERTO_THRESHOLDS["carga_deserto"]:
        return "RATIO_AT_OR_ABOVE_HIGH_THRESHOLD"
    if carga_regional is not None and int(carga_regional) >= DESERTO_THRESHOLDS["carga_baixa"]:
        return "RATIO_AT_OR_ABOVE_LOW_THRESHOLD"
    return "RATIO_BELOW_LOW_THRESHOLD"


def _deserto_reason_text(reason: str) -> str:
    return {
        "CATTLE_BELOW_MINIMUM": (
            f"Município com rebanho municipal abaixo do piso de "
            f"{DESERTO_THRESHOLDS['piso_bovinos_municipio']} bovinos — classificado como NORMAL por exclusão de não-pecuária."
        ),
        "NO_KNOWN_ELIGIBLE_TECHNICAL_PRESENCE": (
            "Nenhuma presença técnica elegível identificada na base no raio regional de 75 km "
            "(estabelecimentos CNPJ ativos com CNAEs elegíveis)."
        ),
        "RATIO_AT_OR_ABOVE_HIGH_THRESHOLD": (
            f"Razão regional bovinos/técnico ≥ {DESERTO_THRESHOLDS['carga_deserto']} "
            "(carga elevada — DESERTO_VET)."
        ),
        "RATIO_AT_OR_ABOVE_LOW_THRESHOLD": (
            f"Razão regional bovinos/técnico ≥ {DESERTO_THRESHOLDS['carga_baixa']} "
            "e abaixo do limiar de deserto — BAIXA_COBERTURA."
        ),
        "RATIO_BELOW_LOW_THRESHOLD": (
            f"Razão regional bovinos/técnico abaixo de {DESERTO_THRESHOLDS['carga_baixa']} — NORMAL."
        ),
    }.get(reason, reason)


def _enrich_deserto_row(row: dict) -> dict:
    r = dict(row)
    classification = (r.get("classificacao") or r.get("classification") or "").replace(" ", "_")
    bovinos = r.get("bovinos_municipio", r.get("cattle_total", r.get("bovinos")))
    techs = r.get("tecnicos_75km", r.get("known_technical_count"))
    carga = r.get("carga_regional", r.get("ratio"))
    reason = _deserto_reason(bovinos, techs, carga)
    techs_n = 0 if techs is None else int(techs)
    if techs_n == 0:
        ratio = None
        ratio_status = "NOT_CALCULABLE_ZERO_DENOMINATOR"
    else:
        ratio = None if carga is None else int(carga)
        ratio_status = "CALCULATED"
    r.update({
        "classification": classification,
        "classification_label": CLASSIFICATION_LABELS.get(classification, classification),
        "classification_reason": reason,
        "classification_reason_text": _deserto_reason_text(reason),
        "rule_version": DESERTO_RULE_VERSION,
        "cattle_total": None if bovinos is None else int(bovinos),
        "cattle_reference_year": DESERTO_CATTLE_YEAR,
        "cattle_source": DESERTO_CATTLE_SOURCE,
        "known_technical_count": techs_n,
        "known_technical_definition": DESERTO_TECHNICAL_SCOPE,
        "ratio": ratio,
        "ratio_status": ratio_status,
        "thresholds": dict(DESERTO_THRESHOLDS),
        "technical_scope": DESERTO_TECHNICAL_SCOPE,
        "geographic_method": DESERTO_GEOGRAPHIC_METHOD,
        "radius_km": DESERTO_THRESHOLDS["raio_km"],
        "sources": [DESERTO_RULE_SOURCE, f"{DESERTO_CATTLE_SOURCE} {DESERTO_CATTLE_YEAR}", "cnpj.estabelecimento_vet", "prospeccao.mv_mun_regional"],
        "limitations": list(DESERTO_LIMITATIONS),
        # aliases legados
        "classificacao": classification,
        "bovinos_municipio": None if bovinos is None else int(bovinos),
        "tecnicos_75km": techs_n,
        "carga_regional": ratio,
        "raio_km": DESERTO_THRESHOLDS["raio_km"],
        "fonte_rebanho": DESERTO_CATTLE_SOURCE,
        "competencia_rebanho": str(DESERTO_CATTLE_YEAR),
        "fonte_tecnicos": "RFB/CNPJ estabelecimentos elegíveis (CNAE)",
        "observacoes": (
            "Razão não calculável: denominador zero (nenhuma presença técnica elegível no raio)."
            if ratio_status == "NOT_CALCULABLE_ZERO_DENOMINATOR"
            else r.get("observacoes")
        ),
    })
    return r


def _deserto_regra_payload() -> dict:
    return {
        "rule_version": DESERTO_RULE_VERSION,
        "raio_km": DESERTO_THRESHOLDS["raio_km"],
        "piso_bovinos": DESERTO_THRESHOLDS["piso_bovinos_municipio"],
        "deserto": (
            "zero presença técnica elegível no raio regional OU "
            f"carga regional ≥ {DESERTO_THRESHOLDS['carga_deserto']} bovinos/técnico"
        ),
        "baixa": f"carga regional ≥ {DESERTO_THRESHOLDS['carga_baixa']} e < {DESERTO_THRESHOLDS['carga_deserto']}",
        "normal": (
            f"rebanho municipal < {DESERTO_THRESHOLDS['piso_bovinos_municipio']} "
            f"OU carga regional < {DESERTO_THRESHOLDS['carga_baixa']}"
        ),
        "technical_scope": DESERTO_TECHNICAL_SCOPE,
        "technical_cnaes": list(DESERTO_TECHNICAL_CNAES),
        "geographic_method": DESERTO_GEOGRAPHIC_METHOD,
        "classification_rule_changed": False,
    }



def _query(sql: str, params: list[Any] | None = None) -> list[dict]:
    conn = get_connection("agro_legacy")
    try:
        conn.set_session(readonly=True, autocommit=False)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SET LOCAL statement_timeout = %s", (120000,))
            cur.execute(sql, params or [])
            rows = [dict(row) for row in cur.fetchall()]
        conn.rollback()
        return rows
    finally:
        release_connection(conn, "agro_legacy")


TECH_CTE = """
WITH canal AS (
 SELECT 'CNPJ:' || t.cnpj14 AS id, t.cnpj14 AS cnpj,
   CASE WHEN lower(trim(t.nome)) IN ('(sem nome fantasia)','sem nome fantasia')
        THEN 'Estabelecimento sem nome disponível' ELSE t.nome END AS nome,
   CASE WHEN NULLIF(t.profissao,'') IS NOT NULL OR t.crmv IS NOT NULL
        THEN 'PROFISSIONAL_NOMINAL'
        WHEN t.categoria IN ('inseminacao','apoio_pecuaria','repro_secundario')
        THEN 'REPRODUCAO_MANEJO' WHEN t.categoria='veterinaria'
        THEN 'ESTABELECIMENTO_VETERINARIO' ELSE 'PROVAVEL_POR_CNAE' END AS entidade_tipo,
   CASE WHEN lower(COALESCE(t.profissao,'')) LIKE '%%zootec%%' OR t.crmv_cat='Z' THEN 'ZOOTECNISTA'
        WHEN lower(COALESCE(t.profissao,'')) LIKE '%%veter%%' OR t.crmv_cat='V' THEN 'VETERINARIO'
        WHEN t.categoria IN ('inseminacao','apoio_pecuaria','repro_secundario') THEN 'REPRODUCAO_MANEJO'
        ELSE NULL END AS profissao,
   CASE WHEN NULLIF(t.profissao,'') IS NOT NULL THEN 'CADASTRO_INTERNO'
        WHEN t.crmv IS NOT NULL THEN 'REGISTRO_CONSELHO_INFORMADO'
        ELSE 'INFERIDO_POR_CNAE' END AS profissao_origem,
   CASE WHEN NULLIF(t.profissao,'') IS NOT NULL THEN 'CADASTRO_INTERNO'
        WHEN t.crmv IS NOT NULL THEN 'REGISTRO_CONSELHO_INFORMADO'
        WHEN t.categoria='veterinaria' THEN 'ESTABELECIMENTO_EMPRESARIAL'
        ELSE 'INFERIDO_POR_CNAE' END AS confianca_profissao,
   t.categoria AS atividade, ev.cnae_fiscal_principal::text AS cnae,
   t.crmv AS crmv_numero, t.crmv_uf, false AS registro_oficial_validado,
   t.municipio, t.uf, COALESCE(t.whatsapp,t.celular,t.tel_melhor,t.tel_receita) AS telefone,
   t.email_receita AS email, t.instagram, t.site,
   CASE WHEN t.whatsapp IS NOT NULL OR t.celular IS NOT NULL OR t.instagram IS NOT NULL OR t.site IS NOT NULL THEN 'ENRIQUECIMENTO_PUBLICO' ELSE 'RFB' END contato_origem,
   CASE WHEN t.whatsapp IS NOT NULL OR t.celular IS NOT NULL THEN 'PUBLICADO' ELSE 'CADASTRAL' END contato_confianca,
   NULL::numeric AS score_canal, 'v_tecnico_full' AS fonte
 FROM prospeccao.v_tecnico_full t
 LEFT JOIN LATERAL (SELECT e.cnae_fiscal_principal FROM cnpj.estabelecimento_vet e
                    WHERE e.cnpj_basico::text=t.cnpj_basico::text ORDER BY e.cnpj_ordem LIMIT 1) ev ON true
 WHERE t.nome IS NOT NULL AND t.nome !~ '^[0-9]'
 UNION ALL
 SELECT 'CREA:' || c.id::text, NULL, c.nome, 'AGRONOMO_CREA', 'AGRONOMO', 'CREA',
   'REGISTRO_CONSELHO_INFORMADO', c.titulo, NULL, NULL, NULL, false,
   c.municipio, c.uf, c.telefone, c.email, NULL, NULL, 'CREA', 'REGISTRO_INFORMADO', NULL, 'tecnico_crea'
 FROM prospeccao.tecnico_crea c WHERE c.nome IS NOT NULL
 UNION ALL
 SELECT 'ABCZ:' || a.id::text, NULL, a.nome, 'ORIGEM_ABCZ',
   CASE WHEN lower(COALESCE(a.profissao,a.papel,'')) LIKE '%%zootec%%' THEN 'ZOOTECNISTA'
        WHEN lower(COALESCE(a.profissao,a.papel,'')) LIKE '%%veter%%' THEN 'VETERINARIO'
        ELSE upper(COALESCE(a.profissao,a.papel)) END,
   'ABCZ', 'CADASTRO_INTERNO', a.papel, NULL, NULL, NULL, false,
   a.municipio, a.uf, a.telefone, a.email, NULL, NULL, 'ABCZ', 'CADASTRO_INTERNO', NULL, 'canal_central'
 FROM prospeccao.canal_central a WHERE a.nome IS NOT NULL
 UNION ALL
 SELECT 'EST:' || e.cnpj_basico::text || e.cnpj_ordem::text || e.cnpj_dv::text,
   e.cnpj_basico::text || e.cnpj_ordem::text || e.cnpj_dv::text,
   COALESCE(NULLIF(e.nome_fantasia,''), 'Estabelecimento ' || e.cnpj_basico::text),
   'ESTABELECIMENTO_VETERINARIO', NULL, 'CNAE', 'ESTABELECIMENTO_EMPRESARIAL',
   'SERVICOS_VETERINARIOS', e.cnae_fiscal_principal::text, NULL, NULL, false,
   e.municipio_nome, e.uf, NULLIF(e.ddd_1,'') || NULLIF(e.telefone_1,''), e.correio_eletronico,
   NULL, NULL, 'RFB', 'ESTABELECIMENTO_EMPRESARIAL', NULL, 'estabelecimento_vet'
 FROM cnpj.estabelecimento_vet e
 WHERE e.situacao_cadastral::text='02'
   AND NOT EXISTS (SELECT 1 FROM prospeccao.v_tecnico_full t WHERE t.cnpj14=e.cnpj_basico::text || e.cnpj_ordem::text || e.cnpj_dv::text)
)
"""


def _tech_filters(**filters: Any) -> tuple[str, list[Any]]:
    where, params = ["1=1"], []
    mappings = {"uf": "uf", "municipio": "municipio", "profissao": "profissao",
                "origem": "profissao_origem", "confianca": "confianca_profissao",
                "atividade": "atividade"}
    for key, column in mappings.items():
        if filters.get(key):
            where.append(f"upper(COALESCE({column},'')) = upper(%s)")
            params.append(filters[key])
    if filters.get("q"):
        where.append("(nome ILIKE %s OR COALESCE(cnpj,'') ILIKE %s OR COALESCE(municipio,'') ILIKE %s)")
        params.extend([f"%{filters['q']}%"] * 3)
    if filters.get("com_crmv") is not None:
        where.append("crmv_numero IS " + ("NOT NULL" if filters["com_crmv"] else "NULL"))
    if filters.get("com_telefone") is not None:
        where.append("telefone IS " + ("NOT NULL" if filters["com_telefone"] else "NULL"))
    if filters.get("com_email") is not None:
        where.append("email IS " + ("NOT NULL" if filters["com_email"] else "NULL"))
    if filters.get("entidade_tipo"):
        where.append("entidade_tipo = %s")
        params.append(filters["entidade_tipo"])
    group = filters.get("grupo")
    if group == "PROFISSIONAIS":
        where.append("entidade_tipo = ANY(%s)"); params.append(list(PROFESSIONAL_TYPES))
    elif group == "ESTABELECIMENTOS":
        where.append("entidade_tipo = ANY(%s)"); params.append(list(ESTABLISHMENT_TYPES))
    elif group == "REPRODUCAO_MANEJO":
        where.append("entidade_tipo = 'REPRODUCAO_MANEJO'")
    elif group == "OUTROS_REGISTROS":
        where.append("NOT (entidade_tipo = ANY(%s))"); params.append(list(PROFESSIONAL_TYPES + ESTABLISHMENT_TYPES + ("REPRODUCAO_MANEJO",)))
    if filters.get("evidencia"):
        where.append("confianca_profissao = %s"); params.append(filters["evidencia"])
    contact_status = str(filters.get("contact_status") or "ANY").upper()
    contact_clauses = {
        "PHONE": "telefone IS NOT NULL",
        "EMAIL": "email IS NOT NULL",
        "BOTH": "telefone IS NOT NULL AND email IS NOT NULL",
        "NONE": "telefone IS NULL AND email IS NULL",
    }
    if contact_status in contact_clauses:
        where.append(contact_clauses[contact_status])
    return " AND ".join(where), params


def _public_item(row: dict) -> dict:
    row = dict(row)
    source = row.pop("fonte", None)
    entity_type = row.get("entidade_tipo")
    if entity_type in PROFESSIONAL_TYPES: nature_group = "PROFISSIONAIS"
    elif entity_type in ESTABLISHMENT_TYPES: nature_group = "ESTABELECIMENTOS"
    elif entity_type == "REPRODUCAO_MANEJO": nature_group = "REPRODUCAO_MANEJO"
    else: nature_group = "OUTROS_REGISTROS"
    source_meta = SOURCE_METADATA.get(source, {"label": "Fonte integrada", "object": source})
    row.update({"fazenda_propria": None, "fazendas_50km": None, "bovinos_100km": None,
                "geo_status": "UNAVAILABLE", "fontes": [source] if source else [],
                "source_metadata": [source_meta] if source else [], "nature_group": nature_group,
                "evidence_type": row.get("confianca_profissao"),
                "crmv_informado": bool(row.get("crmv_numero")), "crmv_validation_status": "NOT_VALIDATED",
                "contact_status": "BOTH" if row.get("telefone") and row.get("email") else
                                  "PHONE" if row.get("telefone") else "EMAIL" if row.get("email") else "NONE",
                "contact_attribution": "INSTITUTIONAL" if nature_group in ("ESTABELECIMENTOS", "REPRODUCAO_MANEJO") else "UNATTRIBUTED",
                "limitacoes": [GEO_MESSAGE]})
    return row


class AgroCanalRepository:
    @staticmethod
    def tecnicos(page=1, page_size=25, sort="nome", order="asc", **filters):
        where, params = _tech_filters(**filters)
        total = int(_query(TECH_CTE + f"SELECT count(*) total FROM canal WHERE {where}", params)[0]["total"])
        sort_col = {"nome": "nome", "uf": "uf", "municipio": "municipio", "profissao": "profissao",
                    "atividade": "atividade", "confianca": "confianca_profissao"}.get(sort, "nome")
        direction = "DESC" if str(order).lower() == "desc" else "ASC"
        size = max(1, min(100, page_size)); offset = (max(1, page)-1)*size
        rows = _query(TECH_CTE + f"SELECT * FROM canal WHERE {where} ORDER BY {sort_col} {direction} NULLS LAST, id LIMIT %s OFFSET %s", params + [size, offset])
        return {"items": [_public_item(r) for r in rows], "total": total, "page": page,
                "page_size": size, "total_pages": math.ceil(total/size) if total else 0,
                "status": "ok", "sources": TECH_SOURCES, "loaded_at": None,
                "limitations": [GEO_MESSAGE]}

    @staticmethod
    def tecnico(item_id: str) -> Optional[dict]:
        rows = _query(TECH_CTE + "SELECT * FROM canal WHERE id=%s LIMIT 1", [item_id])
        if not rows: return None
        item = _public_item(rows[0])
        context = AgroCanalRepository._territorial_context(item.get("municipio"), item.get("uf"))
        item.update({"fazendas_proximas": None, "municipios_cobertos": None, "message_geo": GEO_MESSAGE,
                     "territorial_context": context})
        return item

    @staticmethod
    def tecnicos_stats():
        sql = TECH_CTE + """SELECT count(*) total,
          count(*) FILTER (WHERE entidade_tipo='PROFISSIONAL_NOMINAL') profissionais_nominais,
          count(*) FILTER (WHERE entidade_tipo='ESTABELECIMENTO_VETERINARIO') estabelecimentos_veterinarios,
          count(*) FILTER (WHERE profissao='VETERINARIO') veterinarios,
          count(*) FILTER (WHERE profissao='ZOOTECNISTA') zootecnistas,
          count(*) FILTER (WHERE entidade_tipo='REPRODUCAO_MANEJO') reproducao_manejo,
          count(*) FILTER (WHERE entidade_tipo='PROVAVEL_POR_CNAE') provaveis_por_cnae,
          count(*) FILTER (WHERE crmv_numero IS NOT NULL) com_crmv_informado,
          count(*) FILTER (WHERE telefone IS NOT NULL) com_telefone,
          count(*) FILTER (WHERE email IS NOT NULL) com_email,
          count(*) FILTER (WHERE telefone IS NOT NULL OR email IS NOT NULL) com_contato,
          count(*) FILTER (WHERE telefone IS NOT NULL AND email IS NOT NULL) com_telefone_e_email,
          count(*) FILTER (WHERE entidade_tipo='AGRONOMO_CREA') origem_crea,
          count(*) FILTER (WHERE entidade_tipo='ORIGEM_ABCZ') origem_abcz,
          count(*) FILTER (WHERE confianca_profissao='CADASTRO_INTERNO') evidencia_cadastro_interno,
          count(*) FILTER (WHERE confianca_profissao='REGISTRO_CONSELHO_INFORMADO') evidencia_conselho_informado,
          count(*) FILTER (WHERE confianca_profissao='ESTABELECIMENTO_EMPRESARIAL') evidencia_estabelecimento,
          count(*) FILTER (WHERE confianca_profissao='INFERIDO_POR_CNAE') evidencia_inferido_cnae,
          array_remove(array_agg(DISTINCT profissao ORDER BY profissao),NULL) profissoes,
          array_remove(array_agg(DISTINCT profissao_origem ORDER BY profissao_origem),NULL) origens,
          array_remove(array_agg(DISTINCT confianca_profissao ORDER BY confianca_profissao),NULL) evidencias,
          array_remove(array_agg(DISTINCT atividade ORDER BY atividade),NULL) atividades,
          array_remove(array_agg(DISTINCT entidade_tipo ORDER BY entidade_tipo),NULL) tipos FROM canal"""
        return _query(sql)[0]

    @staticmethod
    def _territorial_context(municipio: Optional[str], uf: Optional[str]) -> Optional[dict]:
        if not municipio or not uf: return None
        sql = TECH_CTE + """, local AS (
          SELECT count(*) FILTER (WHERE entidade_tipo = ANY(%s)) profissionais_nominais,
            count(*) FILTER (WHERE entidade_tipo = ANY(%s)) estabelecimentos,
            count(*) FILTER (WHERE entidade_tipo='REPRODUCAO_MANEJO') reproducao_manejo
          FROM canal WHERE upper(trim(municipio))=upper(trim(%s)) AND upper(uf)=upper(%s)
        ) SELECT w.codigo_ibge, w.nome municipio, w.uf, w.bovinos rebanho_municipal,
          replace(w.classificacao_vet,' ','_') classificacao_territorial,
          l.profissionais_nominais, l.estabelecimentos, l.reproducao_manejo,
          'MUNICIPAL_NAME_NORMALIZED' territorial_link_quality
          FROM prospeccao.v_white_space_pecuaria w CROSS JOIN local l
          WHERE upper(trim(w.nome))=upper(trim(%s)) AND upper(w.uf)=upper(%s) LIMIT 1"""
        rows = _query(sql, [list(PROFESSIONAL_TYPES), list(ESTABLISHMENT_TYPES), municipio, uf, municipio, uf])
        return rows[0] if rows else {"municipio": municipio, "uf": uf, "territorial_link_quality": "UNAVAILABLE",
                                    "limitations": ["Município não ligado à referência territorial por nome normalizado e UF."]}

    @staticmethod
    def tecnicos_mapa(uf: Optional[str] = None, limit: int = 5570):
        where, params = ["municipio IS NOT NULL", "uf IS NOT NULL"], []
        if uf: where.append("upper(uf)=upper(%s)"); params.append(uf)
        size = max(1, min(5570, limit))
        sql = TECH_CTE + f""", municipal AS (
          SELECT upper(trim(municipio)) municipio_key, upper(uf) uf,
            count(*) FILTER (WHERE entidade_tipo = ANY(%s)) profissionais_nominais,
            count(*) FILTER (WHERE profissao='VETERINARIO') veterinarios,
            count(*) FILTER (WHERE profissao='ZOOTECNISTA') zootecnistas,
            count(*) FILTER (WHERE entidade_tipo = ANY(%s)) estabelecimentos,
            count(*) FILTER (WHERE entidade_tipo='REPRODUCAO_MANEJO') reproducao_manejo,
            count(*) FILTER (WHERE telefone IS NOT NULL OR email IS NOT NULL) com_contato,
            count(*) FILTER (WHERE crmv_numero IS NOT NULL) crmv_informado
          FROM canal WHERE {' AND '.join(where)} GROUP BY 1,2
        ), linked AS (
          SELECT w.codigo_ibge, w.nome municipio, w.uf, m.profissionais_nominais, m.veterinarios,
            m.zootecnistas, m.estabelecimentos, m.reproducao_manejo, m.com_contato, m.crmv_informado,
            w.latitude, w.longitude, w.bovinos rebanho_municipal,
            replace(w.classificacao_vet,' ','_') classificacao_territorial,
            'MUNICIPAL_NAME_NORMALIZED' territorial_link_quality
          FROM municipal m JOIN prospeccao.v_white_space_pecuaria w
            ON upper(trim(w.nome))=m.municipio_key AND upper(w.uf)=m.uf
          WHERE w.latitude BETWEEN -33.75 AND 5.27 AND w.longitude BETWEEN -73.99 AND -34.79
        ) SELECT *, ARRAY['Base integrada Canal Técnico','IBGE/Deserto Veterinário'] sources,
          ARRAY['Presença conhecida na base; não representa cobertura oficial completa.'] limitations
          FROM linked ORDER BY profissionais_nominais DESC, codigo_ibge LIMIT %s"""
        query_params = [list(PROFESSIONAL_TYPES), list(ESTABLISHMENT_TYPES)] + params + [size]
        rows = _query(sql, query_params)
        total_sql = TECH_CTE + f""", municipal AS (SELECT upper(trim(municipio)) municipio_key, upper(uf) uf
          FROM canal WHERE {' AND '.join(where)} GROUP BY 1,2)
          SELECT count(*) total FROM municipal m JOIN prospeccao.v_white_space_pecuaria w
          ON upper(trim(w.nome))=m.municipio_key AND upper(w.uf)=m.uf
          WHERE w.latitude BETWEEN -33.75 AND 5.27 AND w.longitude BETWEEN -73.99 AND -34.79"""
        total = int(_query(total_sql, params)[0]["total"])
        return {"items": rows, "returned": len(rows), "total": total, "status": "ok",
                "territorial_link_quality": "MUNICIPAL_NAME_NORMALIZED",
                "sources": ["prospeccao.v_tecnico_full", "prospeccao.v_white_space_pecuaria"],
                "limitations": ["Ligação exata por nome municipal normalizado e UF; sem fuzzy matching.",
                                "Ausência de registro não significa ausência de assistência técnica."]}

    @staticmethod
    def deserto(page=1, page_size=25, q=None, uf=None, classificacao=None, min_bovinos=None,
                min_carga=None, sort="municipio", order="asc", formato="lista"):
        """Lista municipal do Deserto — classes lidas da view publicada (sem recalcular limiares)."""
        where, params = ["1=1"], []
        if q:
            where.append("w.nome ILIKE %s"); params.append(f"%{q}%")
        if uf:
            where.append("w.uf=%s"); params.append(uf.upper())
        if classificacao:
            where.append("replace(w.classificacao_vet,' ','_')=%s"); params.append(classificacao.upper())
        if min_bovinos is not None:
            where.append("w.bovinos >= %s"); params.append(min_bovinos)
        if min_carga is not None:
            where.append("w.carga_regional >= %s"); params.append(min_carga)
        clause = " AND ".join(where)
        size = max(1, min(5000 if formato == "mapa" else 100, page_size))
        offset = (max(1, page) - 1) * size
        total = int(_query(
            f"SELECT count(*) total FROM prospeccao.v_white_space_pecuaria w WHERE {clause}",
            params,
        )[0]["total"])
        columns = {
            "municipio": "w.nome", "uf": "w.uf", "classificacao": "w.classificacao_vet",
            "bovinos": "w.bovinos", "carga": "w.carga_regional", "tecnicos": "w.tecnicos_75km",
            "codigo_ibge": "w.codigo_ibge",
        }
        col = columns.get(sort, "w.nome")
        direction = "DESC" if str(order).lower() == "desc" else "ASC"
        rows = _query(
            f"""SELECT w.codigo_ibge, w.nome municipio, w.uf, w.latitude, w.longitude,
              replace(w.classificacao_vet,' ','_') classificacao, w.bovinos bovinos_municipio,
              w.bovinos_75km, w.tecnicos_75km, w.carga_regional
              FROM prospeccao.v_white_space_pecuaria w WHERE {clause}
              ORDER BY {col} {direction} NULLS LAST, w.codigo_ibge LIMIT %s OFFSET %s""",
            params + [size, offset],
        )
        items = [_enrich_deserto_row(r) for r in rows]
        payload = {
            "items": items,
            "total": total,
            "page": page,
            "page_size": size,
            "total_pages": math.ceil(total / size) if total else 0,
            "status": "ok",
            "regra": _deserto_regra_payload(),
            "rule_version": DESERTO_RULE_VERSION,
            "sources": [DESERTO_RULE_SOURCE, f"{DESERTO_CATTLE_SOURCE} {DESERTO_CATTLE_YEAR}"],
            "competencia": f"{DESERTO_CATTLE_SOURCE} {DESERTO_CATTLE_YEAR}",
            "limitations": list(DESERTO_LIMITATIONS),
            "technical_scope": DESERTO_TECHNICAL_SCOPE,
            "geographic_method": DESERTO_GEOGRAPHIC_METHOD,
            "aggregation": "MUNICIPAL" if formato == "mapa" else None,
            "classification_rule_changed": False,
        }
        if formato == "mapa":
            # bounds Brasil + metadata de mapa
            items = [
                x for x in items
                if x.get("latitude") is not None and x.get("longitude") is not None
                and -33.75 <= float(x["latitude"]) <= 5.27
                and -73.99 <= float(x["longitude"]) <= -34.79
            ]
            payload["items"] = items
            payload["returned"] = len(items)
            payload["aggregation"] = "MUNICIPAL"
            payload["geographic_method"] = DESERTO_GEOGRAPHIC_METHOD
        return payload

    @staticmethod
    def deserto_stats():
        """Resumo legado + campos canônicos de visão geral (classes da view publicada)."""
        # Uma única query: classes + totais de presença (sem segunda round-trip).
        rows = _query(
            """SELECT replace(classificacao_vet,' ','_') classificacao, count(*) municipios,
              COALESCE(sum(bovinos),0) bovinos,
              COALESCE(sum(tecnicos_75km),0) tecnicos,
              count(*) FILTER (WHERE tecnicos_75km = 0) municipios_zero_tec
              FROM prospeccao.v_white_space_pecuaria GROUP BY 1"""
        )
        by = {r["classificacao"]: r for r in rows}
        deserto_m = int(by.get("DESERTO_VET", {}).get("municipios", 0) or 0)
        baixa_m = int(by.get("BAIXA_COBERTURA", {}).get("municipios", 0) or 0)
        normal_m = int(by.get("NORMAL", {}).get("municipios", 0) or 0)
        total_m = deserto_m + baixa_m + normal_m
        deserto_b = int(by.get("DESERTO_VET", {}).get("bovinos", 0) or 0)
        baixa_b = int(by.get("BAIXA_COBERTURA", {}).get("bovinos", 0) or 0)
        normal_b = int(by.get("NORMAL", {}).get("bovinos", 0) or 0)
        slots_sum = sum(int(r.get("tecnicos") or 0) for r in rows)
        zero_tec = sum(int(r.get("municipios_zero_tec") or 0) for r in rows)
        return {
            # legado
            "deserto_vet_municipios": deserto_m,
            "baixa_cobertura_municipios": baixa_m,
            "normal_municipios": normal_m,
            "deserto_vet_bovinos": deserto_b,
            "baixa_cobertura_bovinos": baixa_b,
            "normal_bovinos": normal_b,
            "total_municipios": total_m,
            "competencia": f"{DESERTO_CATTLE_SOURCE} {DESERTO_CATTLE_YEAR}",
            # canônico
            "municipios_avaliados": total_m,
            "deserto_vet": deserto_m,
            "baixa_cobertura": baixa_m,
            "cobertura_normal": normal_m,
            "rebanho_no_recorte": deserto_b + baixa_b + normal_b,
            "presenca_tecnica_conhecida": {
                "definition": DESERTO_TECHNICAL_SCOPE,
                "municipios_sem_presenca_conhecida": zero_tec,
                "slots_regionais_somados": slots_sum,
                "note": (
                    "slots_regionais_somados soma contagens municipais no raio e NÃO é "
                    "contagem de profissionais únicos nacionais."
                ),
            },
            "rule_version": DESERTO_RULE_VERSION,
            "cattle_reference_year": DESERTO_CATTLE_YEAR,
            "cattle_source": DESERTO_CATTLE_SOURCE,
            "thresholds": dict(DESERTO_THRESHOLDS),
            "technical_scope": DESERTO_TECHNICAL_SCOPE,
            "geographic_method": DESERTO_GEOGRAPHIC_METHOD,
            "sources": [DESERTO_RULE_SOURCE, f"{DESERTO_CATTLE_SOURCE} {DESERTO_CATTLE_YEAR}"],
            "limitations": list(DESERTO_LIMITATIONS),
            "classification_rule_changed": False,
            "soma_classes_ok": total_m == deserto_m + baixa_m + normal_m,
        }

    @staticmethod
    def deserto_resumo():
        return AgroCanalRepository.deserto_stats()

    @staticmethod
    def deserto_municipios(page=1, page_size=25, q=None, uf=None, classificacao=None,
                           min_bovinos=None, min_carga=None, sort="municipio", order="asc"):
        return AgroCanalRepository.deserto(
            page=page, page_size=page_size, q=q, uf=uf, classificacao=classificacao,
            min_bovinos=min_bovinos, min_carga=min_carga, sort=sort, order=order, formato="lista",
        )

    @staticmethod
    def deserto_mapa(page=1, page_size=5000, q=None, uf=None, classificacao=None):
        return AgroCanalRepository.deserto(
            page=page, page_size=page_size, q=q, uf=uf, classificacao=classificacao,
            formato="mapa",
        )

    @staticmethod
    def deserto_detalhe(codigo_ibge: str | int) -> Optional[dict]:
        rows = _query(
            """SELECT w.codigo_ibge, w.nome municipio, w.uf, w.latitude, w.longitude,
              replace(w.classificacao_vet,' ','_') classificacao, w.bovinos bovinos_municipio,
              w.bovinos_75km, w.tecnicos_75km, w.carga_regional
              FROM prospeccao.v_white_space_pecuaria w
              WHERE w.codigo_ibge::text = %s LIMIT 1""",
            [str(codigo_ibge)],
        )
        if not rows:
            return None
        item = _enrich_deserto_row(rows[0])
        item["technical_types_included"] = [
            {"cnae": c, "label": DESERTO_TECHNICAL_CNAE_LABELS[c], "enters_rule": True, "weight": 1}
            for c in DESERTO_TECHNICAL_CNAES
        ]
        item["technical_types_excluded"] = [
            {"tipo": "PROFISSIONAL_NOMINAL", "enters_rule": False, "note": "Canal Técnico — fora do denominador regional"},
            {"tipo": "AGRONOMO_CREA", "enters_rule": False, "note": "CREA não entra no Deserto"},
            {"tipo": "ORIGEM_ABCZ", "enters_rule": False, "note": "ABCZ não entra no Deserto"},
            {"tipo": "CRMV_INFORMADO", "enters_rule": False, "note": "CRMV permanece NOT_VALIDATED e não é denominador"},
        ]
        item["crmv_policy"] = "NOT_VALIDATED"
        item["context_links"] = {
            "canal_tecnico": "/agro/tecnicos",
            "propriedades": "/agro/propriedades",
            "radar": "/agro/oportunidades",
            "logistica": "/agro/logistica",
        }
        item["decision_explanation"] = {
            "classification": item["classification"],
            "reason": item["classification_reason"],
            "reason_text": item["classification_reason_text"],
            "rule_version": DESERTO_RULE_VERSION,
            "thresholds": dict(DESERTO_THRESHOLDS),
            "inputs": {
                "cattle_total_municipal": item["cattle_total"],
                "cattle_reference_year": DESERTO_CATTLE_YEAR,
                "known_technical_count_75km": item["known_technical_count"],
                "ratio": item["ratio"],
                "ratio_status": item["ratio_status"],
                "bovinos_75km": item.get("bovinos_75km"),
            },
        }
        return item

    @staticmethod
    def deserto_metodologia() -> dict:
        return {
            "rule_version": DESERTO_RULE_VERSION,
            "classification_rule_changed": False,
            "rule_status": "VALIDATED_WITH_SEMANTIC_FIX",
            "name": "Deserto Veterinário — carga regional por presença técnica conhecida",
            "summary": (
                "Classifica municípios com rebanho IBGE PPM 2023 segundo a carga bovina regional "
                "por estabelecimento CNPJ elegível no raio de 75 km entre centroides municipais."
            ),
            "rule": {
                "order": [
                    "SE bovinos_municipais < 1000 ENTÃO NORMAL (CATTLE_BELOW_MINIMUM)",
                    "SE tecnicos_75km = 0 ENTÃO DESERTO_VET (NO_KNOWN_ELIGIBLE_TECHNICAL_PRESENCE)",
                    "SE carga_regional >= 40000 ENTÃO DESERTO_VET (RATIO_AT_OR_ABOVE_HIGH_THRESHOLD)",
                    "SE carga_regional >= 15000 ENTÃO BAIXA_COBERTURA (RATIO_AT_OR_ABOVE_LOW_THRESHOLD)",
                    "SENÃO NORMAL (RATIO_BELOW_LOW_THRESHOLD)",
                ],
                "thresholds": dict(DESERTO_THRESHOLDS),
                "ratio_definition": "round(bovinos_75km / tecnicos_75km) quando tecnicos_75km > 0; senão null",
                "zero_denominator": {
                    "ratio": None,
                    "ratio_status": "NOT_CALCULABLE_ZERO_DENOMINATOR",
                    "classification": "DESERTO_VET se bovinos_municipais >= 1000",
                },
            },
            "cattle": {
                "source": DESERTO_CATTLE_SOURCE,
                "year": DESERTO_CATTLE_YEAR,
                "species": "BOV",
                "object": "prospeccao.ppm_municipio",
                "not_realtime": True,
            },
            "technical_presence": {
                "definition": DESERTO_TECHNICAL_SCOPE,
                "not": "KNOWN_VETERINARIAN_PRESENCE",
                "object_supply": "prospeccao.mv_mun_regional",
                "object_establishments": "cnpj.estabelecimento_vet",
                "filter": "situacao_cadastral = '02' (ativo)",
                "cnaes_included": [
                    {"cnae": c, "label": DESERTO_TECHNICAL_CNAE_LABELS[c], "weight": 1}
                    for c in DESERTO_TECHNICAL_CNAES
                ],
                "types_excluded": [
                    "PROFISSIONAL_NOMINAL (Canal Técnico)",
                    "AGRONOMO_CREA",
                    "ORIGEM_ABCZ",
                    "CRMV informado (NOT_VALIDATED)",
                ],
                "deduplication": "Contagem de estabelecimentos por município de sede (codigo_tom); cada estabelecimento ativo conta 1 no município sede e soma no raio.",
                "crmv": "NOT_USED_IN_RULE",
            },
            "geography": {
                "method": DESERTO_GEOGRAPHIC_METHOD,
                "radius_km": 75,
                "radius_meters": 75000,
                "implementation": "earth_distance(ll_to_earth(lat,lng), ...) <= 75000 com pré-filtro bbox ±0.70°",
                "srid_note": "Coordenadas geográficas WGS84 via extensão earthdistance (sem geography ST_DWithin)",
                "points": "Centroides de referencia.municipio — não coordenadas individuais de profissionais",
                "mv_tecnico_geo": "ABSENT",
                "individual_professional_distance": False,
            },
            "objects": {
                "classification_view": "prospeccao.v_white_space_pecuaria",
                "regional_matview": "prospeccao.mv_mun_regional",
                "municipal_supply": "prospeccao.mv_vet_supply_mun",
                "fazenda_deserto": "prospeccao.fazenda_deserto",
                "mv_tecnico_geo": "ABSENT",
            },
            "semantics": {
                "page_title_note": (
                    "O nome comercial 'Deserto Veterinário' é histórico. O denominador mede "
                    "KNOWN_TECHNICAL_PRESENCE (CNAEs elegíveis), não apenas veterinários habilitados."
                ),
                "absence_language": (
                    "Usar 'nenhuma presença técnica elegível identificada na base' — "
                    "nunca 'não existem veterinários'."
                ),
            },
            "radar_consumption": {
                "source": DESERTO_RULE_SOURCE,
                "signal_classes": ["DESERTO_VET", "BAIXA_COBERTURA"],
                "parity_required": True,
                "classification_rule_changed": False,
            },
            "limitations": list(DESERTO_LIMITATIONS),
            "sources": [
                DESERTO_RULE_SOURCE,
                "prospeccao.mv_mun_regional",
                "cnpj.estabelecimento_vet",
                f"{DESERTO_CATTLE_SOURCE} {DESERTO_CATTLE_YEAR}",
            ],
        }

