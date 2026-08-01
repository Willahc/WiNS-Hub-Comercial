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


def _query(sql: str, params: list[Any] | None = None) -> list[dict]:
    conn = get_connection("agro")
    try:
        conn.set_session(readonly=True, autocommit=False)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SET LOCAL statement_timeout = %s", (120000,))
            cur.execute(sql, params or [])
            rows = [dict(row) for row in cur.fetchall()]
        conn.rollback()
        return rows
    finally:
        release_connection(conn, "agro")


TECH_CTE = """
WITH canal AS (
 SELECT 'CNPJ:' || t.cnpj14 AS id, t.cnpj14 AS cnpj, t.nome,
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
    return " AND ".join(where), params


def _public_item(row: dict) -> dict:
    row = dict(row)
    source = row.pop("fonte", None)
    row.update({"fazenda_propria": None, "fazendas_50km": None, "bovinos_100km": None,
                "geo_status": "UNAVAILABLE", "fontes": [source] if source else [],
                "limitacoes": [GEO_MESSAGE]})
    return row


class AgroCanalRepository:
    @staticmethod
    def tecnicos(page=1, page_size=25, sort="nome", order="asc", **filters):
        try:
            where, params = _tech_filters(**filters)
            total = int(_query(TECH_CTE + f"SELECT count(*) total FROM canal WHERE {where}", params)[0]["total"])
            sort_col = {"nome": "nome", "uf": "uf", "municipio": "municipio", "profissao": "profissao",
                        "atividade": "atividade", "confianca": "confianca_profissao", "score": "score_canal"}.get(sort, "nome")
            direction = "DESC" if str(order).lower() == "desc" else "ASC"
            size = max(1, min(100, page_size)); offset = (max(1, page)-1)*size
            rows = _query(TECH_CTE + f"SELECT * FROM canal WHERE {where} ORDER BY {sort_col} {direction} NULLS LAST, id LIMIT %s OFFSET %s", params + [size, offset])
            return {"items": [_public_item(r) for r in rows], "total": total, "page": page,
                    "page_size": size, "total_pages": math.ceil(total/size) if total else 0,
                    "status": "ok", "sources": TECH_SOURCES, "loaded_at": None,
                    "limitations": [GEO_MESSAGE]}
        except Exception:
            return {"items": [], "total": 0, "page": page, "page_size": page_size, "total_pages": 0,
                    "status": "partial", "sources": TECH_SOURCES, "loaded_at": None,
                    "limitations": ["Canal técnico temporariamente indisponível.", GEO_MESSAGE]}

    @staticmethod
    def tecnico(item_id: str) -> Optional[dict]:
        rows = _query(TECH_CTE + "SELECT * FROM canal WHERE id=%s LIMIT 1", [item_id])
        if not rows: return None
        item = _public_item(rows[0])
        item.update({"fazendas_proximas": None, "municipios_cobertos": None, "message_geo": GEO_MESSAGE})
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
          count(*) FILTER (WHERE entidade_tipo='AGRONOMO_CREA') origem_crea,
          count(*) FILTER (WHERE entidade_tipo='ORIGEM_ABCZ') origem_abcz FROM canal"""
        return _query(sql)[0]

    @staticmethod
    def deserto(page=1, page_size=25, q=None, uf=None, classificacao=None, min_bovinos=None,
                min_carga=None, sort="municipio", order="asc", formato="lista"):
        where, params = ["1=1"], []
        if q: where.append("w.nome ILIKE %s"); params.append(f"%{q}%")
        if uf: where.append("w.uf=%s"); params.append(uf.upper())
        if classificacao: where.append("replace(w.classificacao_vet,' ','_')=%s"); params.append(classificacao.upper())
        if min_bovinos is not None: where.append("w.bovinos >= %s"); params.append(min_bovinos)
        if min_carga is not None: where.append("w.carga_regional >= %s"); params.append(min_carga)
        clause = " AND ".join(where); size=max(1,min(5000 if formato=="mapa" else 100,page_size)); offset=(max(1,page)-1)*size
        total=int(_query(f"SELECT count(*) total FROM prospeccao.v_white_space_pecuaria w WHERE {clause}",params)[0]["total"])
        columns={"municipio":"w.nome","uf":"w.uf","classificacao":"w.classificacao_vet","bovinos":"w.bovinos","carga":"w.carga_regional","tecnicos":"w.tecnicos_75km"}
        col=columns.get(sort,"w.nome"); direction="DESC" if order.lower()=="desc" else "ASC"
        rows=_query(f"""SELECT w.codigo_ibge, w.nome municipio, w.uf, w.latitude, w.longitude,
          replace(w.classificacao_vet,' ','_') classificacao, w.bovinos bovinos_municipio,
          w.bovinos_75km, w.tecnicos_75km, w.carga_regional, 75 raio_km,
          'IBGE PPM' fonte_rebanho, '2023' competencia_rebanho,
          'RFB/CNPJ e base técnica integrada' fonte_tecnicos,
          CASE WHEN w.carga_regional IS NULL THEN 'Carga indisponível quando não há técnico regional.' END observacoes
          FROM prospeccao.v_white_space_pecuaria w WHERE {clause}
          ORDER BY {col} {direction} NULLS LAST, w.codigo_ibge LIMIT %s OFFSET %s""",params+[size,offset])
        return {"items":rows,"total":total,"page":page,"page_size":size,"total_pages":math.ceil(total/size) if total else 0,
                "status":"ok","regra":{"raio_km":75,"deserto":"zero técnicos regionais ou carga igual ou superior a 40000 bovinos por técnico","baixa":"carga igual ou superior a 15000 bovinos por técnico","piso_bovinos":1000},
                "sources":["prospeccao.v_white_space_pecuaria","IBGE PPM 2023"],"competencia":"2023","limitations":[]}

    @staticmethod
    def deserto_stats():
        rows=_query("""SELECT replace(classificacao_vet,' ','_') classificacao, count(*) municipios,
          COALESCE(sum(bovinos),0) bovinos FROM prospeccao.v_white_space_pecuaria GROUP BY 1""")
        by={r["classificacao"]:r for r in rows}
        return {"deserto_vet_municipios":by.get("DESERTO_VET",{}).get("municipios",0),
                "baixa_cobertura_municipios":by.get("BAIXA_COBERTURA",{}).get("municipios",0),
                "normal_municipios":by.get("NORMAL",{}).get("municipios",0),
                "deserto_vet_bovinos":by.get("DESERTO_VET",{}).get("bovinos",0),
                "baixa_cobertura_bovinos":by.get("BAIXA_COBERTURA",{}).get("bovinos",0),
                "normal_bovinos":by.get("NORMAL",{}).get("bovinos",0),
                "total_municipios":sum(int(r["municipios"]) for r in rows), "competencia":"IBGE PPM 2023"}
