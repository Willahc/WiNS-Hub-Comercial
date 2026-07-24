import hashlib
import re
import unicodedata
import psycopg2
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any, Optional

from psycopg2.extras import RealDictCursor
from database import get_connection, release_connection
from config import DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS



MAX_PAGE_SIZE = 100
QUERY_TIMEOUT_MS = 20000

# Catálogo fechado das fontes reais que podem ser expostas como diretório. Nada
# recebido pela API é interpolado como nome de tabela ou coluna.
DIRECTORY_CONFIGS = {
    "agro/imoveis": ("agro", "prospeccao.imovel_rural", "id", "nome_imovel", ["id", "codigo_car", "nome_imovel", "nome_proprietario", "cpf_cnpj", "municipio", "uf", "area_total_ha", "fonte_principal", "coletado_em"], ["codigo_car", "nome_imovel", "nome_proprietario", "cpf_cnpj", "municipio"], None, "SICAR / prospeccao.imovel_rural"),
    "agro/produtores": ("agro", "prospeccao.holding_lead_ui", "cnpj14", "razao", ["cnpj14", "razao", "tipo", "uf", "municipio", "nome_fantasia", "cnae_principal", "situacao", "score"], ["cnpj14", "razao", "nome_fantasia", "municipio"], None, "RFB + evidência rural / prospeccao.holding_lead_ui"),
    "agro/fazendas": ("agro", "prospeccao.fazenda_area", "codigo_car", "codigo_car", ["codigo_car", "cnpj_basico", "codigo_ibge", "area_ha", "lead_ref", "fonte_geomatch", "updated_at"], ["codigo_car", "cnpj_basico", "codigo_ibge"], None, "SICAR / prospeccao.fazenda_area"),
    "agro/holdings": ("agro", "prospeccao.holding_lead_ui", "cnpj14", "razao", ["cnpj14", "razao", "tipo", "uf", "municipio", "nome_fantasia", "cnae_principal", "capital_social", "situacao", "score"], ["cnpj14", "razao", "nome_fantasia", "municipio"], None, "RFB / prospeccao.holding_lead_ui"),
    "agro/agronomos": ("agro", "prospeccao.tecnico_crea", "id", "nome", ["id", "nome", "registro_crea", "titulo", "uf", "municipio", "situacao", "fonte", "fonte_url", "coletado_em"], ["nome", "registro_crea", "titulo", "municipio"], "coletado_em", "CREA / prospeccao.tecnico_crea"),
    "agro/zootecnistas": ("agro", "prospeccao.v_tecnico_full", "cnpj14", "nome", ["cnpj14", "nome", "categoria", "tier", "municipio", "uf", "profissao", "fonte_nome"], ["cnpj14", "nome", "profissao", "municipio"], None, "prospeccao.v_tecnico_full", "(profissao ILIKE '%%ZOOTEC%%' OR categoria ILIKE '%%ZOOTEC%%')"),
    "agro/veterinarios-nominais": ("agro", "prospeccao.vet_nome", "cnpj_basico", "nome_pf", ["cnpj_basico", "razao_social", "nome_pf", "fonte_nome", "socio_qualif"], ["cnpj_basico", "razao_social", "nome_pf"], None, "RFB / prospeccao.vet_nome"),
    "agro/empresas-veterinarias": ("agro", "cnpj.empresa_vet", "cnpj_basico", "razao_social", ["cnpj_basico", "razao_social", "natureza_juridica", "capital_social", "porte"], ["cnpj_basico", "razao_social"], None, "RFB / cnpj.empresa_vet"),
    "agro/estabelecimentos-veterinarios": ("agro", "cnpj.estabelecimento_vet", "cnpj_basico", "nome_fantasia", ["cnpj_basico", "cnpj_ordem", "cnpj_dv", "nome_fantasia", "situacao_cadastral", "cnae_fiscal_principal", "uf", "municipio_nome", "data_inicio_atividade"], ["cnpj_basico", "nome_fantasia", "municipio_nome"], "data_situacao_cadastral", "RFB / cnpj.estabelecimento_vet"),
    "agro/reprodutores": ("agro", "mercado.reprodutor", "id", "nome", ["id", "registro", "nome", "sexo", "data_nascimento", "genotipado", "pai_nome", "mae_nome", "fazenda_origem", "em_central", "fonte_referencia", "coletado_em", "uf", "municipio"], ["registro", "nome", "fazenda_origem", "municipio"], "coletado_em", "programas genéticos / mercado.reprodutor"),
    "agro/touros-central": ("agro", "mercado.reprodutor", "id", "nome", ["id", "registro", "nome", "fazenda_origem", "central_id", "fonte_referencia", "coletado_em", "uf", "municipio"], ["registro", "nome", "fazenda_origem"], "coletado_em", "programas genéticos / mercado.reprodutor", "em_central IS TRUE"),
    "agro/doadoras": ("agro", "mercado.doadora", "id", "nome", ["id", "reprodutor_id", "nome", "registro", "fazenda_origem", "uf", "fonte_referencia", "fonte_url", "coletado_em"], ["nome", "registro", "fazenda_origem"], "coletado_em", "mercado.doadora"),
    "agro/embrioes": ("agro", "mercado.oferta_embriao", "id", "doadora_nome", ["id", "doadora_id", "doadora_nome", "reprodutor_id", "touro_nome", "tipo", "categoria", "qtd", "preco_brl", "fonte_referencia", "leilao_nome", "data_evento", "fonte_url", "coletado_em"], ["doadora_nome", "touro_nome", "leilao_nome"], "coletado_em", "mercado.oferta_embriao"),
    "agro/avaliacoes-geneticas": ("agro", "mercado.avaliacao", "id", "reprodutor_id", ["id", "reprodutor_id", "caracteristica_id", "valor", "acuracia", "percentil", "classe", "eh_genomica", "coletado_em"], ["reprodutor_id"], "coletado_em", "programas genéticos / mercado.avaliacao"),
    "logistica/transportadores": ("logistica", "public.rntrc_transportadores", "numero_rntrc", "nome_transportador", ["numero_rntrc", "nome_transportador", "situacao_rntrc", "cpfcnpjtransportador", "categoria_transportador", "municipio", "uf", "data_situacao_rntrc"], ["numero_rntrc", "nome_transportador", "cpfcnpjtransportador", "municipio"], "data_situacao_rntrc", "ANTT RNTRC"),
    "logistica/agregados-municipais": ("logistica", "public.rntrc_agregado_municipio", "municipio", "municipio", ["uf", "municipio", "categoria_transportador", "quantidade_transportadores"], ["municipio", "uf", "categoria_transportador"], None, "ANTT RNTRC agregado municipal"),
    "logistica/empresas": ("logistica", "public.cnpj_logisticos_agregado", "codigo_municipio", "codigo_municipio", ["uf", "codigo_municipio", "cnae_fiscal_principal", "matriz_filial", "situacao_cadastral", "quantidade"], ["codigo_municipio", "uf", "cnae_fiscal_principal"], None, "RFB agregado municipal logístico"),
    "logistica/postos": ("logistica", "public.anp_postos", "codigoisimp", "razaosocial", ["codigoisimp", "autorizacao", "datapublicacao", "razaosocial", "cnpj", "endereco", "bairro", "uf", "municipio", "bandeira", "datavinculacao"], ["codigoisimp", "razaosocial", "cnpj", "municipio", "bandeira"], "datavinculacao", "ANP postos autorizados"),
    "logistica/bases-apoio": ("logistica", "public.antt_bases_apoio", "concessionaria", "concessionaria", ["concessionaria", "ano", "tipo_de_atendimento", "tempo_medio_anual", "mes_ano", "total_de_atendimento"], ["concessionaria", "tipo_de_atendimento"], "mes_ano", "ANTT bases de apoio"),
    "logistica/pedagios": ("logistica", "public.antt_pedagios", "praca_de_pedagio", "praca_de_pedagio", ["concessionaria", "praca_de_pedagio", "rodovia", "uf", "km_m", "municipal", "situacao", "latitude", "longitude"], ["concessionaria", "praca_de_pedagio", "rodovia", "municipal"], None, "ANTT praças de pedágio"),
    "logistica/rodovias": ("logistica", "public.antt_rodovias_concedidas", "rodovia", "rodovia", ["concessionaria", "rodovia", "uf", "km_m", "municipal", "situacao"], ["concessionaria", "rodovia", "municipal"], None, "ANTT rodovias concedidas"),
    "logistica/riscos-rota": ("logistica", "public.prf_risco_rota", "km", "municipio", ["uf", "br", "km", "municipio", "severity_score", "mortos", "feridos_graves", "feridos_leves", "total_acidentes", "risco_score", "data_inversa"], ["uf", "br", "municipio"], "data_inversa", "PRF risco de rota"),
    "saude/estabelecimentos": ("saude", "public.estabelecimentos", "cnes_id", "nome_fantasia", ["cnes_id", "cnpj", "cnpj_entidade", "razao_social", "nome_fantasia", "municipio_cod", "municipio_nome", "uf", "tem_internacao", "tem_cirurgia", "atende_sus", "data_atualizacao_cnes"], ["cnes_id", "cnpj", "razao_social", "nome_fantasia", "municipio_nome"], "data_atualizacao_cnes", "DATASUS CNES"),
    "saude/mantenedoras": ("saude", "public.estabelecimentos", "cnpj_entidade", "razao_social", ["cnpj_entidade", "razao_social", "municipio_nome", "uf", "data_atualizacao_cnes"], ["cnpj_entidade", "razao_social", "municipio_nome"], "data_atualizacao_cnes", "DATASUS CNES", "cnpj_entidade IS NOT NULL"),
    "saude/medicos": ("saude", "public.medicos", "id", "nome", ["id", "crm", "uf_crm", "nome", "situacao", "especialidades", "municipio_atuacao", "uf_atuacao", "cnes_id", "captado_em", "atualizado_em"], ["crm", "nome", "especialidades", "municipio_atuacao"], "atualizado_em", "CNES / cadastro médico"),
    "saude/operadoras": ("saude", "public.operadoras_ans", "registro_ans", "razao_social", ["registro_ans", "cnpj", "razao_social", "nome_fantasia", "modalidade", "municipio", "uf", "representante", "captado_em"], ["registro_ans", "cnpj", "razao_social", "nome_fantasia", "municipio"], "captado_em", "ANS operadoras"),
    "saude/capacidade-municipal": ("saude", "public.cnes_capacidade", "municipio_cod", "municipio_nome", ["municipio_cod", "municipio_nome", "uf", "populacao", "leitos_total", "leitos_sus", "leitos_uti", "leitos_sus_por_mil", "equip_tomografo", "equip_ressonancia", "equip_mamografo", "captado_em"], ["municipio_cod", "municipio_nome", "uf"], "captado_em", "DATASUS capacidade municipal"),
    "saude/desertos-medicos": ("saude", "public.desertos_medicos", "id", "municipio_nome", ["id", "municipio_cod", "municipio_nome", "uf", "populacao", "medicos_por_mil_hab", "estabelecimentos_sus", "classificacao", "n_medicos", "captado_em"], ["municipio_cod", "municipio_nome", "uf", "classificacao"], "captado_em", "DATASUS desertos médicos"),
    "saude/mercado": ("saude", "public.mercado_saude", "municipio_cod", "municipio_nome", ["municipio_cod", "municipio_nome", "uf", "populacao", "beneficiarios", "cobertura_privada_pct", "competencia", "captado_em"], ["municipio_cod", "municipio_nome", "uf"], "captado_em", "ANS mercado de saúde"),
    "saude/oportunidades": ("saude", "public.oportunidade_investimento", "municipio_cod", "municipio_nome", ["municipio_cod", "municipio_nome", "uf", "populacao", "medicos_por_mil", "leitos_sus_por_mil", "indice_oportunidade", "tier", "sweet_spot", "captado_em"], ["municipio_cod", "municipio_nome", "uf", "tier"], "captado_em", "DATASUS / ANS oportunidade de investimento"),
}

def _clean_text(value: Any) -> Any:
    """Converte controles C1 importados de Windows-1252 sem alterar UTF-8 válido."""
    if not isinstance(value, str) or not any(0x80 <= ord(ch) <= 0x9F for ch in value):
        return value
    return ''.join(bytes([ord(ch)]).decode('cp1252', errors='replace') if 0x80 <= ord(ch) <= 0x9F else ch for ch in value)

def _clean_record(value: Any) -> Any:
    if isinstance(value, dict): return {k: _clean_record(v) for k, v in value.items()}
    if isinstance(value, list): return [_clean_record(v) for v in value]
    return _clean_text(value)

def _clean_cnpj(value: Optional[str]) -> Optional[str]:
    digits = re.sub(r"\D", "", value or "")
    return digits if len(digits) == 14 else None

def _format_cnpj(value: str) -> str:
    return f"{value[:2]}.{value[2:5]}.{value[5:8]}/{value[8:12]}-{value[12:]}"

def _canonical(kind: str, source_id: Any) -> str:
    return f"{kind}_{hashlib.sha256(str(source_id).encode()).hexdigest()[:20]}"

def _mask_email(value: Optional[str]) -> Optional[str]:
    if not value or "@" not in value:
        return None
    local, domain = value.split("@", 1)
    return f"{local[:1]}***@{domain}"

def _mask_phone(value: Optional[str]) -> Optional[str]:
    digits = re.sub(r"\D", "", value or "")
    return f"***{digits[-4:]}" if len(digits) >= 4 else None

def _page(page: int, page_size: int) -> tuple[int, int]:
    safe_page = max(1, page)
    safe_size = max(1, min(MAX_PAGE_SIZE, page_size))
    return safe_size, (safe_page - 1) * safe_size

def _run(sql: str, params: list[Any], count_sql: Optional[str] = None, count_params: Optional[list[Any]] = None):
    conn = get_connection()
    try:
        conn.set_session(readonly=True, autocommit=False)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SET LOCAL statement_timeout = %s", (QUERY_TIMEOUT_MS,))
            total = None
            if count_sql:
                cur.execute(count_sql, count_params if count_params is not None else params)
                total = cur.fetchone()["total"]
            cur.execute(sql, params)
            rows = [_clean_record(dict(row)) for row in cur.fetchall()]
        conn.rollback()
        return rows, total
    finally:
        release_connection(conn)

def _meta(page: int, size: int, total: int, rows: list[dict], source: str):
    latest = max((r.get("source_updated_at") for r in rows if r.get("source_updated_at")), default=None)
    return {"page": page, "pageSize": size, "total": total, "returned": len(rows),
            "maxPageSize": MAX_PAGE_SIZE, "source": source, "lastUpdatedAt": latest,
            "partialData": any(r.get("partial_data", False) for r in rows)}

def _run_db(dbname: str, sql: str, params: list[Any] = None, domain: Optional[str] = None):
    if not domain:
        if dbname == "caminhao_vazio_staging":
            domain = "logistica"
        elif dbname == "wins_saude_staging":
            domain = "saude"
        elif dbname == "wins_agro" and ("prospeccao" in sql or "fazenda" in sql or "mercado" in sql):
            domain = "agro"
        else:
            domain = "engenharia"
    conn = get_connection(domain)
    try:
        conn.set_session(readonly=True, autocommit=False)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SET LOCAL statement_timeout = 20000;")
            cur.execute(sql, params or [])
            rows = [dict(r) for r in cur.fetchall()]
        conn.rollback()
        return rows
    finally:
        release_connection(conn, domain)

class Wave1Repository:

    @staticmethod
    def works(page=1, page_size=25, search=None, municipality=None, uf=None, status=None,
              phase=None, sector=None, company=None, investment_min=None, investment_max=None,
              period_start=None, period_end=None, has_supplier=None, has_decision_maker=None,
              has_opportunity=None, capex_homologado=None, sort="updated_desc"):
        size, offset = _page(page, page_size)
        # Mesma regra da carteira legada: NULL significa que a obra nunca foi
        # ocultada explicitamente e, portanto, continua visível.
        where = ["(o.visivel IS NULL OR o.visivel IS TRUE)"]
        params: list[Any] = []
        if search:
            where.append("(o.nome ILIKE %s OR o.empresa ILIKE %s OR o.descricao_publica ILIKE %s OR o.descricao ILIKE %s)")
            params += [f"%{search}%"] * 4
        if municipality: where.append("o.municipio ILIKE %s"); params.append(f"%{municipality}%")
        if uf: where.append("o.uf = %s"); params.append(uf.upper())
        status_bucket="""CASE WHEN lower(coalesce(o.status,o.fase,o.status_licenca,'')) LIKE '%%conclu%%' THEN 'Concluída' WHEN lower(coalesce(o.status,o.fase,o.status_licenca,'')) ~ '(paralis|suspens)' THEN 'Paralisada' WHEN lower(coalesce(o.status,o.fase,o.status_licenca,'')) ~ '(andamento|execu)' THEN 'Em andamento' ELSE 'Prevista' END"""
        phase_bucket="""CASE WHEN lower(coalesce(o.fase,'')) LIKE '%%licen%%' THEN 'Licenciamento' WHEN lower(coalesce(o.fase,'')) LIKE '%%mobil%%' THEN 'Mobilização' WHEN lower(coalesce(o.fase,'')) ~ '(execu|obra)' THEN 'Execução' WHEN lower(coalesce(o.fase,'')) ~ '(entreg|conclu)' THEN 'Entrega' ELSE 'Projeto' END"""
        if status:
            if status in ('Em andamento','Prevista','Concluída','Paralisada'): where.append(f"{status_bucket} = %s"); params.append(status)
            else: where.append("coalesce(o.status,o.fase,o.status_licenca) ILIKE %s"); params.append(status)
        if phase:
            if phase in ('Projeto','Licenciamento','Mobilização','Execução','Entrega'): where.append(f"{phase_bucket} = %s"); params.append(phase)
            else: where.append("o.fase ILIKE %s"); params.append(phase)
        if sector: where.append("o.setor ILIKE %s"); params.append(sector)
        if company: where.append("(o.empresa ILIKE %s OR o.cnpj = %s OR o.empresa_executora ILIKE %s OR o.cnpj_executora = %s)"); params += [f"%{company}%", _clean_cnpj(company) or company, f"%{company}%", _clean_cnpj(company) or company]
        if investment_min is not None: where.append("o.valor_estimado >= %s"); params.append(investment_min)
        if investment_max is not None: where.append("o.valor_estimado <= %s"); params.append(investment_max)
        if period_start: where.append("coalesce(o.data_publicacao,o.data_anuncio) >= %s"); params.append(period_start)
        if period_end: where.append("coalesce(o.data_publicacao,o.data_anuncio) <= %s"); params.append(period_end)
        supplier_exists = "(o.cnpj_executora IS NOT NULL OR o.fornecedor_principal IS NOT NULL OR EXISTS (SELECT 1 FROM engenharia.matches_v2 ms WHERE ms.obra_id=o.id))"
        decision_exists = "EXISTS (SELECT 1 FROM engenharia.decisores_obra d WHERE d.obra_id=o.id AND d.excluido_em IS NULL)"
        opportunity_exists = "EXISTS (SELECT 1 FROM engenharia.matches_v2 mo WHERE mo.obra_id=o.id)"
        if has_supplier is not None: where.append(supplier_exists if has_supplier else f"NOT {supplier_exists}")
        if has_decision_maker is not None: where.append(decision_exists if has_decision_maker else f"NOT {decision_exists}")
        if has_opportunity is not None: where.append(opportunity_exists if has_opportunity else f"NOT {opportunity_exists}")
        capex_exists="(o.valor_estimado IS NOT NULL AND o.capex_fonte IS NOT NULL)"
        if capex_homologado is not None: where.append(capex_exists if capex_homologado else f"NOT {capex_exists}")
        order = {
          "name_asc":"o.nome ASC NULLS LAST", "name_desc":"o.nome DESC NULLS LAST",
          "investment_desc":"o.valor_estimado DESC NULLS LAST", "investment_asc":"o.valor_estimado ASC NULLS LAST",
          "updated_desc":"coalesce(o.valor_atualizado_em,o.executora_atualizada_em,o.criado_em) DESC NULLS LAST",
          "updated_asc":"coalesce(o.valor_atualizado_em,o.executora_atualizada_em,o.criado_em) ASC NULLS LAST",
          "start_desc":"coalesce(o.data_publicacao,o.data_anuncio) DESC NULLS LAST",
          "start_asc":"coalesce(o.data_publicacao,o.data_anuncio) ASC NULLS LAST",
        }[sort]
        clause = " AND ".join(where)
        select = f"""SELECT o.id::text source_id,o.nome,o.empresa,o.cnpj,o.setor,o.municipio,o.uf,o.valor_estimado,
          coalesce(o.status,o.fase,o.status_licenca) status,o.fase,o.data_publicacao,o.data_anuncio,o.descricao_publica,o.descricao,
          o.fonte,o.url_fonte,o.capex_fonte,(o.valor_estimado IS NOT NULL AND o.capex_fonte IS NOT NULL) investment_homologated,
          coalesce(o.valor_atualizado_em,o.executora_atualizada_em,o.criado_em) source_updated_at,m.latitude,m.longitude,
          (o.municipio IS NULL OR o.uf IS NULL OR o.cnpj IS NULL OR o.valor_estimado IS NULL) partial_data
          FROM engenharia.obras o LEFT JOIN referencia.municipio m ON m.uf=o.uf AND m.nome_normalizado=upper(unaccent(o.municipio))
          WHERE {clause} ORDER BY {order} LIMIT %s OFFSET %s"""
        # Aggregate in separate, parameterized statements so KPIs cover the full cut, never the current page.
        aggregate_base=f"""SELECT count(*) total,
          count(*) FILTER (WHERE o.valor_estimado IS NOT NULL AND o.capex_fonte IS NOT NULL) investment_count,
          count(*) FILTER (WHERE o.valor_estimado IS NULL) investment_missing_count,
          count(*) FILTER (WHERE o.valor_estimado IS NOT NULL AND o.capex_fonte IS NULL) investment_unhomologated_count,
          sum(o.valor_estimado) FILTER (WHERE o.capex_fonte IS NOT NULL) investment_total,
          count(DISTINCT o.municipio) FILTER (WHERE o.municipio IS NOT NULL) municipality_count,
          count(DISTINCT coalesce(o.cnpj,o.cnpj_executora)) FILTER (WHERE coalesce(o.cnpj,o.cnpj_executora) IS NOT NULL) company_count,
          count(*) FILTER (WHERE nullif(trim(o.municipio),'') IS NULL OR nullif(trim(o.uf),'') IS NULL) missing_municipality_count,
          count(*) FILTER (WHERE coalesce(o.cnpj,o.cnpj_executora) IS NULL) missing_company_count,
          max(coalesce(o.valor_atualizado_em,o.executora_atualizada_em,o.criado_em)) source_updated_at
          FROM engenharia.obras o WHERE {clause}"""
        aggregates,_=_run(aggregate_base,params)
        status_sql=f"SELECT {status_bucket} label, count(*) value FROM engenharia.obras o WHERE {clause} GROUP BY 1 ORDER BY 1"
        phase_sql=f"SELECT {phase_bucket} label, count(*) value FROM engenharia.obras o WHERE {clause} GROUP BY 1 ORDER BY 1"
        statuses,_=_run(status_sql,params); phases,_=_run(phase_sql,params)
        territories,_=_run(f"""SELECT o.municipio,upper(o.uf) uf,count(*) works_count,
          sum(o.valor_estimado) FILTER (WHERE o.capex_fonte IS NOT NULL) investment_total,
          count(*) FILTER (WHERE o.valor_estimado IS NULL OR o.capex_fonte IS NULL) investment_unavailable_count,
          count(DISTINCT coalesce(o.cnpj,o.cnpj_executora)) FILTER (WHERE coalesce(o.cnpj,o.cnpj_executora) IS NOT NULL) company_count,
          sum(coalesce(mx.opportunity_count,0)) opportunity_count,max(coalesce(o.valor_atualizado_em,o.executora_atualizada_em,o.criado_em)) updated_at
          FROM engenharia.obras o LEFT JOIN (SELECT obra_id,count(DISTINCT cnpj) opportunity_count FROM engenharia.matches_v2 GROUP BY obra_id) mx ON mx.obra_id=o.id
          WHERE {clause} AND nullif(trim(o.municipio),'') IS NOT NULL AND nullif(trim(o.uf),'') IS NOT NULL
          GROUP BY o.municipio,upper(o.uf) ORDER BY works_count DESC,o.municipio LIMIT 12""",params)
        opportunity_rows,_=_run(f"""SELECT count(m.cnpj) matches_linked,
          count(m.cnpj) opportunities_linked,
          count(m.cnpj) FILTER (WHERE m.score >= 70) opportunities_active
          FROM engenharia.obras o LEFT JOIN engenharia.matches_v2 m ON m.obra_id=o.id WHERE {clause}""",params)
        works_with_opportunity_rows,_=_run(f"""SELECT count(*) works_with_opportunity FROM engenharia.obras o
          WHERE {clause} AND EXISTS (SELECT 1 FROM engenharia.matches_v2 mw WHERE mw.obra_id=o.id)""",params)
        opportunity_rows[0]["works_with_opportunity"]=works_with_opportunity_rows[0]["works_with_opportunity"]
        global_opportunity_rows,_=_run("""SELECT count(*) matches_total,count(*) opportunities_total,
          count(*) FILTER (WHERE score >= 70) opportunities_active_total FROM engenharia.matches_v2""",[])
        rows,_=_run(select,params+[size,offset])
        agg=aggregates[0]
        total=agg["total"]
        items=[]
        for r in rows:
            quality=100-sum([not r["nome"],not r["municipio"],not r["uf"],not r["cnpj"],r["valor_estimado"] is None])*12
            items.append({"canonicalId":_canonical("work",r["source_id"]),**r,"qualityScore":max(0,quality),
              "confidenceLevel":"confirmed" if quality>=88 else "probable","activeStatus":True,
              "geoPrecision":"municipality" if r["latitude"] is not None else "unknown",
              "provenance":{"sourceSystem":"wins_engenharia","sourceSchema":"engenharia","sourceTable":"obras","sourceId":r["source_id"],"sourceUpdatedAt":r["source_updated_at"]}})
        applied={k:v for k,v in {"search":search,"status":status,"phase":phase,"sector":sector,
          "municipality":municipality,"uf":uf.upper() if uf else None,"company":company,
          "investment_min":investment_min,"investment_max":investment_max,
          "period_start":str(period_start) if period_start else None,"period_end":str(period_end) if period_end else None,
          "has_supplier":has_supplier,"has_decision_maker":has_decision_maker,"has_opportunity":has_opportunity,
          "capex_homologado":capex_homologado,
          "sort":sort}.items() if v is not None}
        investment_available=agg["investment_count"] > 0
        investment_incomplete=agg["investment_missing_count"] + agg["investment_unhomologated_count"]
        response_aggregates={"works_total":total,"investment_total":agg["investment_total"],
          "investment_records_count":agg["investment_count"],"investment_missing_count":agg["investment_missing_count"],
          "investment_unhomologated_count":agg["investment_unhomologated_count"],
          "investment_status":"unavailable" if not investment_available else ("partial" if investment_incomplete else "complete"),
          "financial_coverage_pct":round((agg["investment_count"]*100/total),2) if total else 0,
          "municipality_count":agg["municipality_count"],"company_count":agg["company_count"],
          "status_counts":statuses,"phase_counts":phases,"territories":territories,
          "opportunities":{**global_opportunity_rows[0],**opportunity_rows[0],
            "works_without_opportunity":total-(opportunity_rows[0]["works_with_opportunity"] or 0),
            "active_rule":"score >= 70"},
          "missing_municipality_count":agg["missing_municipality_count"],"missing_company_count":agg["missing_company_count"],
          "last_updated_at":agg["source_updated_at"]}
        meta=_meta(page,size,total,rows,"wins_agro.engenharia.obras")
        meta.update({"lastUpdatedAt":agg["source_updated_at"],"appliedFilters":applied,"aggregates":response_aggregates})
        return {"items":items,"total":total,"page":page,"page_size":size,
          "applied_filters":applied,"aggregates":response_aggregates,"meta":meta}

    @staticmethod
    def work(work_id: str):
        rows,_=_run("""SELECT o.*,o.id::text source_id,m.latitude,m.longitude FROM engenharia.obras o
          LEFT JOIN referencia.municipio m ON m.uf=o.uf AND m.nome_normalizado=upper(unaccent(o.municipio))
          WHERE o.id::text=%s LIMIT 1""",[work_id])
        if not rows: return None
        r=rows[0]
        related,_=_run("""SELECT id::text source_id,nome,cargo,email,telefone,linkedin_url,fonte,
          qualidade_lead,registrado_em source_updated_at FROM engenharia.decisores_obra
          WHERE obra_id=%s AND excluido_em IS NULL ORDER BY qualidade_lead DESC NULLS LAST,registrado_em DESC LIMIT 20""",[work_id])
        opportunities,_=_run("""SELECT concat(m.obra_id,'-',m.cnpj) source_id,m.cnpj,m.score,m.score_breakdown,
          m.gerado_em source_updated_at,f.razao_social fornecedor,f.nome_fantasia
          FROM engenharia.matches_v2 m LEFT JOIN engenharia.fornecedores f ON f.cnpj=m.cnpj
          WHERE m.obra_id=%s ORDER BY m.score DESC,m.gerado_em DESC,m.cnpj ASC LIMIT 20""",[work_id])
        supplier=[]
        # O CNPJ da obra é o órgão/cliente. Só é fornecedor quando a fonte
        # identifica explicitamente a executora.
        principal_cnpj=r.get("cnpj_executora")
        if principal_cnpj:
            supplier,_=_run("""SELECT cnpj source_id,razao_social,nome_fantasia,cnae_principal,cnae_descricao,
              coalesce(municipio_nome,municipio_rfb) municipio,uf,atualizado_em source_updated_at
              FROM engenharia.fornecedores WHERE cnpj=%s LIMIT 1""",[principal_cnpj])
        if not supplier and r.get("fornecedor_principal"):
            supplier=[{"source_id":None,"razao_social":r.get("fornecedor_principal"),"nome_fantasia":None,
                       "cnae_principal":None,"cnae_descricao":None,"municipio":None,"uf":None,
                       "source_updated_at":r.get("valor_atualizado_em") or r.get("criado_em"),
                       "missingFields":["cnpj","cnae","municipality","state"]}]

        return {"canonicalId":_canonical("work",work_id),"sourceId":work_id,"name":r.get("nome"),"description":r.get("descricao_publica") or r.get("descricao"),
          "company":{"name":r.get("empresa"),"cnpj":r.get("cnpj")},"sector":r.get("setor"),"municipality":r.get("municipio"),"state":r.get("uf"),
          "latitude":r.get("latitude"),"longitude":r.get("longitude"),"geoPrecision":"municipality" if r.get("latitude") else "unknown",
          "status":r.get("status") or r.get("fase") or r.get("status_licenca"),"phase":r.get("fase"),
          "value":r.get("valor_estimado") if r.get("capex_fonte") else None,
          "investmentHomologated":bool(r.get("valor_estimado") is not None and r.get("capex_fonte")),
          "publishedAt":r.get("data_publicacao"),"deadline":r.get("data_anuncio"),"decisionMakers":related,"opportunities":opportunities,
          "supplier":supplier[0] if supplier else None,"organization":r.get("empresa_executora") or r.get("empresa"),
          "source":r.get("fonte"),"sourceUrl":r.get("url_fonte"),
          "missingFields":[field for field,value in {"municipality":r.get("municipio"),"state":r.get("uf"),"value":r.get("valor_estimado"),"companyCnpj":r.get("cnpj"),"deadline":r.get("data_anuncio")}.items() if value is None],
          "partialData":not all([r.get("municipio"),r.get("uf"),r.get("cnpj")]),"lastUpdatedAt":r.get("valor_atualizado_em") or r.get("executora_atualizada_em") or r.get("criado_em"),
          "provenance":{"sourceSystem":"wins_hub_comercial_legado","sourceDatabase":"wins_agro","sourceSchema":"engenharia","sourceTable":"obras","sourceId":work_id,"sourceUpdatedAt":r.get("valor_atualizado_em") or r.get("executora_atualizada_em") or r.get("criado_em"),"sourceUrl":r.get("url_fonte")}}

    @staticmethod
    def projects(**kwargs):
        result=Wave1Repository.works(**kwargs)
        for item in result["items"]: item["projectModel"]="work_projection"
        result["meta"]["warning"]="EngineeringProject projetado de Work; vw_projetos_mestre está vazia"
        return result

    @staticmethod
    def companies(page=1,page_size=25,search=None,cnpj=None,uf=None,active=None,sort="updated_desc"):
        size,offset=_page(page,page_size); where=["1=1"]; params=[]
        if cnpj: where.append("e.cnpj=%s"); params.append(_clean_cnpj(cnpj) or cnpj)
        if search: where.append("(e.razao_social ILIKE %s OR e.nome_fantasia ILIKE %s)"); params += [f"%{search}%",f"%{search}%"]
        if uf: where.append("e.uf=%s"); params.append(uf.upper())
        if active is not None: where.append("e.vivo=%s"); params.append(active)
        clause=" AND ".join(where); order="e.atualizado_em DESC" if sort=="updated_desc" else "e.razao_social ASC NULLS LAST"
        count_sql = "SELECT 4874219 as total" if clause == "1=1" else f"SELECT count(*) total FROM core.empresa e WHERE {clause}"
        rows,total=_run(f"""SELECT e.cnpj source_id,e.razao_social,e.nome_fantasia,e.situacao,e.porte,e.capital_social,e.uf,e.municipio,e.codigo_ibge,e.fonte,e.vivo,e.atualizado_em source_updated_at,
          (e.razao_social IS NULL OR e.municipio IS NULL) partial_data FROM core.empresa e WHERE {clause} ORDER BY {order} LIMIT %s OFFSET %s""",
          params+[size,offset],count_sql,params)
        for r in rows:
            r.update({"canonicalId":_canonical("company",r["source_id"]),"qualityScore":100-sum([not r["razao_social"],not r["municipio"],not r["uf"]])*15,
              "confidenceLevel":"confirmed","activeStatus":r["vivo"],"provenance":{"sourceSystem":"wins_core","sourceSchema":"core","sourceTable":"empresa","sourceId":r["source_id"],"sourceUpdatedAt":r["source_updated_at"]}})
        return {"items":rows,"meta":_meta(page,size,total,rows,"wins_agro.core.empresa")}

    @staticmethod
    def company(company_id: str):
        normalized_cnpj=_clean_cnpj(company_id)
        source_schema="engenharia"; source_table="fornecedores"
        if normalized_cnpj:
            rows,_=_run("""SELECT cnpj,razao_social,nome_fantasia,situacao_cadastral,porte,capital_social,uf,
              coalesce(municipio_nome,municipio_rfb) municipio,'RFB' fonte,true vivo,atualizado_em
              FROM engenharia.fornecedores WHERE cnpj=%s LIMIT 1""",[normalized_cnpj])
        else:
            rows=[]
        if not rows:
            rows,_=_run("SELECT cnpj, razao_social, nome_fantasia, situacao as situacao_cadastral, porte, capital_social, uf, municipio, fonte, vivo, atualizado_em FROM core.empresa WHERE cnpj=%s LIMIT 1",[company_id])
            source_schema="core"; source_table="empresa"
        if not rows:
            rows,_=_run("""SELECT cnpj,empresa razao_social,empresa nome_fantasia,NULL::text situacao_cadastral,
              NULL::text porte,NULL::numeric capital_social,uf,municipio,fonte,true vivo,
              max(coalesce(valor_atualizado_em,executora_atualizada_em,criado_em)) atualizado_em
              FROM engenharia.obras WHERE cnpj=%s GROUP BY cnpj,empresa,uf,municipio,fonte
              ORDER BY atualizado_em DESC NULLS LAST LIMIT 1""",[normalized_cnpj or company_id])
            source_schema="engenharia"; source_table="obras"
            if not rows: return None

        r=rows[0]; actual=r["cnpj"]
        works,_=_run("SELECT id::text,nome,municipio,uf,valor_estimado,fase FROM engenharia.obras WHERE cnpj=%s OR cnpj_executora=%s ORDER BY valor_estimado DESC NULLS LAST LIMIT 30",[actual,actual])
        supplier,_=_run("SELECT cnpj,razao_social,nome_fantasia,cnae_principal,cnae_descricao,matches_count FROM engenharia.fornecedores WHERE cnpj=%s LIMIT 1",[actual])
        decision_makers,_=_run("SELECT d.id::text, d.nome, d.cargo, d.email, d.telefone, o.nome as obra_nome FROM engenharia.decisores_obra d JOIN engenharia.obras o ON o.id=d.obra_id WHERE o.cnpj=%s LIMIT 15",[actual])
        opportunities,_=_run("SELECT concat(m.obra_id,'-',m.cnpj) source_id,m.obra_id::text, m.cnpj,o.nome as obra_nome, m.score, m.gerado_em FROM engenharia.matches_v2 m JOIN engenharia.obras o ON o.id=m.obra_id WHERE m.cnpj=%s ORDER BY m.score DESC LIMIT 15",[actual])

        basic = actual[:8] if actual else None
        agro_occurrences = _run_db("", """SELECT 'produtor ou holding rural' entity_type, cnpj14 source_id,
          coalesce(razao,nome_fantasia) display_name FROM prospeccao.holding_lead_ui WHERE cnpj14=%s
          UNION ALL SELECT 'empresa veterinária', cnpj_basico, razao_social FROM cnpj.empresa_vet WHERE cnpj_basico=%s
          UNION ALL SELECT 'estabelecimento veterinário',cnpj_basico,nome_fantasia
          FROM cnpj.estabelecimento_vet WHERE cnpj_basico=%s LIMIT 25""", [actual,basic,basic], domain="agro") if basic else []
        logistics_occurrences = _run_db("", """SELECT numero_rntrc::text source_id,nome_transportador display_name,
          municipio,uf,'transportador RNTRC' entity_type FROM public.rntrc_transportadores
          WHERE cpfcnpjtransportador IN (%s,%s) LIMIT 25""", [actual,_format_cnpj(actual)], domain="logistica") if actual else []
        health_occurrences = _run_db("", """SELECT cnes_id::text source_id,nome_fantasia display_name,
          municipio_nome municipality,uf,'estabelecimento CNES' entity_type FROM public.estabelecimentos
          WHERE cnpj=%s LIMIT 25""", [actual], domain="saude") if actual else []

        return {"canonicalId":_canonical("company",actual),"sourceId":actual,"cnpj":actual,"legalName":r.get("razao_social"),"tradeName":r.get("nome_fantasia"),
          "activeStatus":r.get("vivo") if r.get("vivo") is not None else True,"status":r.get("situacao_cadastral"),"size":r.get("porte"),"capital":r.get("capital_social"),
          "address":{"municipality":r.get("geo_municipio") or r.get("municipio"),"state":r.get("geo_uf") or r.get("uf"),"ibgeCode":r.get("geo_codigo_ibge") or r.get("codigo_ibge"),"postalCode":r.get("geo_cep")},
          "roles":r.get("papeis") or [],"verticals":r.get("verticais_ativas") or [],"works":works,"supplierProfile":supplier[0] if supplier else None,
          "decisionMakers": decision_makers, "opportunities": opportunities,
          "crossVerticalOccurrences":{"engenharia":works,"agro":agro_occurrences,
            "logistica":logistics_occurrences,"saude":health_occurrences},
          "qualityScore":int(r.get("confianca_geral") or 85),"confidenceLevel":"confirmed","lastUpdatedAt":r.get("atualizado_em"),
          "provenance":{"sourceSystem":"wins_hub_comercial_legado","sourceDatabase":"wins_agro","sourceSchema":source_schema,"sourceTable":source_table,"sourceId":actual,"sourceUpdatedAt":r.get("atualizado_em"),"sourceCount":r.get("total_fontes") or 1}}

    @staticmethod
    def suppliers(page=1,page_size=25,search=None,cnpj=None,municipality=None,uf=None,active=True,sort="matches_desc"):
        size,offset=_page(page,page_size); where=[]; params=[]
        if active: where.append("f.situacao_cadastral='02'")
        if cnpj: where.append("f.cnpj=%s"); params.append(_clean_cnpj(cnpj) or cnpj)
        if search:
            where.append("((COALESCE(f.razao_social,'') || ' ' || COALESCE(f.nome_fantasia,'') || ' ' || COALESCE(f.cnae_descricao,'')) ILIKE %s)")
            params.append(f"%{search}%")
        if municipality: where.append("coalesce(f.municipio_nome,f.municipio_rfb) ILIKE %s"); params.append(municipality)
        if uf: where.append("f.uf=%s"); params.append(uf.upper())
        clause=" AND ".join(where) if where else "1=1"; order="f.razao_social ASC NULLS LAST" if sort=="name" else "f.cnpj ASC"
        rows,total=_run(f"""SELECT f.cnpj source_id,f.razao_social,f.nome_fantasia,f.cnae_principal,f.cnae_descricao,f.porte,f.uf,coalesce(f.municipio_nome,f.municipio_rfb) municipio,
          f.situacao_cadastral,f.matches_count,f.atualizado_em source_updated_at,(f.endereco_completo IS NULL OR coalesce(f.municipio_nome,f.municipio_rfb) IS NULL) partial_data
          FROM engenharia.fornecedores f WHERE {clause} ORDER BY {order} LIMIT %s OFFSET %s""",params+[size,offset],
          f"SELECT count(*) total FROM engenharia.fornecedores f WHERE {clause}",params)
        total_from_window = total or 0
        for r in rows:
            r.update({"canonicalId":_canonical("supplier",r["source_id"]),"qualityScore":100-sum([not r["razao_social"],not r["municipio"],not r["uf"]])*15,"confidenceLevel":"confirmed","activeStatus":r["situacao_cadastral"]=='02',"provenance":{"sourceSystem":"wins_engenharia","sourceSchema":"engenharia","sourceTable":"fornecedores","sourceId":r["source_id"],"sourceUpdatedAt":r["source_updated_at"]}})
        return {"items":rows,"meta":_meta(page,size,total_from_window,rows,"wins_agro.engenharia.fornecedores")}

    @staticmethod
    def supplier(supplier_id:str):
        cnpj=_clean_cnpj(supplier_id) or supplier_id
        rows,_=_run("SELECT * FROM engenharia.fornecedores WHERE cnpj=%s LIMIT 1",[cnpj])
        if not rows:return None
        r=rows[0]; matches,_=_run("SELECT m.obra_id::text,o.nome,m.score,m.gerado_em FROM engenharia.matches_v2 m JOIN engenharia.obras o ON o.id=m.obra_id WHERE m.cnpj=%s ORDER BY m.score DESC LIMIT 30",[cnpj])
        for match in matches:
            match["opportunity_id"] = f"{match['obra_id']}-{cnpj}"
        return {"canonicalId":_canonical("supplier",cnpj),"sourceId":cnpj,"cnpj":cnpj,"legalName":r.get("razao_social"),"tradeName":r.get("nome_fantasia"),"cnae":r.get("cnae_principal"),"segment":r.get("cnae_descricao"),"municipality":r.get("municipio_nome") or r.get("municipio_rfb"),"state":r.get("uf"),"activeStatus":r.get("situacao_cadastral")=='02',"matches":matches,"lastUpdatedAt":r.get("atualizado_em"),"provenance":{"sourceSystem":"wins_engenharia","sourceSchema":"engenharia","sourceTable":"fornecedores","sourceId":cnpj,"sourceUpdatedAt":r.get("atualizado_em")}}

    @staticmethod
    def decision_maker(decision_id: str, include_sensitive=False):
        rows,_=_run("""SELECT d.id::text source_id,d.nome,d.cargo,d.email,d.telefone,d.linkedin_url,d.fonte,
          d.qualidade_lead,d.registrado_em source_updated_at,o.id::text work_id,o.nome work_name,
          o.cnpj company_cnpj,o.empresa company_name,o.municipio,o.uf
          FROM engenharia.decisores_obra d JOIN engenharia.obras o ON o.id=d.obra_id
          WHERE d.id::text=%s AND d.excluido_em IS NULL LIMIT 1""",[decision_id])
        if not rows:return None
        r=rows[0]
        if not include_sensitive:
            r["email"]=_mask_email(r.get("email"));r["telefone"]=_mask_phone(r.get("telefone"))
        r.update({"sensitiveFieldsMasked":not include_sensitive,"relationship":{"classification":"CONFIRMADO",
          "rule":"decisor vinculado diretamente à obra pela chave obra_id","confidence":100,
          "source":"engenharia.decisores_obra","updatedAt":r.get("source_updated_at")}})
        return r

    @staticmethod
    def opportunity(opportunity_id: str):
        rows,_=_run("""SELECT concat(m.obra_id,'-',m.cnpj) source_id,m.obra_id::text work_id,m.cnpj,
          m.score,m.score_breakdown,m.gerado_em source_updated_at,o.nome work_name,o.municipio,o.uf,
          f.razao_social supplier_name,f.nome_fantasia FROM engenharia.matches_v2 m
          JOIN engenharia.obras o ON o.id=m.obra_id LEFT JOIN engenharia.fornecedores f ON f.cnpj=m.cnpj
          WHERE concat(m.obra_id,'-',m.cnpj)=%s LIMIT 1""",[opportunity_id])
        if not rows:return None
        r=rows[0];r["relationship"]={"classification":"PROVÁVEL","rule":"match comercial calculado entre obra e fornecedor",
          "confidence":min(100,int(float(r.get("score") or 0))),"source":"engenharia.matches_v2","updatedAt":r.get("source_updated_at")}
        return r

    @staticmethod
    def decision_makers(page=1,page_size=25,search=None,title=None,work_id=None,include_sensitive=False):
        size,offset=_page(page,page_size); where=["d.excluido_em IS NULL"];params=[]
        if search:where.append("d.nome ILIKE %s");params.append(f"%{search}%")
        if title:where.append("d.cargo ILIKE %s");params.append(f"%{title}%")
        if work_id:where.append("d.obra_id::text=%s");params.append(work_id)
        clause=" AND ".join(where)
        rows,total=_run(f"""SELECT d.id::text source_id,d.obra_id::text,d.nome,d.cargo,d.email,d.telefone,d.linkedin_url,d.fonte,d.qualidade_lead,d.registrado_em source_updated_at,o.nome obra_nome,o.cnpj company_id,
          (d.email IS NULL AND d.telefone IS NULL AND d.linkedin_url IS NULL) partial_data FROM engenharia.decisores_obra d JOIN engenharia.obras o ON o.id=d.obra_id WHERE {clause} ORDER BY d.qualidade_lead DESC NULLS LAST,d.registrado_em DESC LIMIT %s OFFSET %s""",params+[size,offset],f"SELECT count(*) total FROM engenharia.decisores_obra d JOIN engenharia.obras o ON o.id=d.obra_id WHERE {clause}",params)
        for r in rows:
            classification="public" if r["fonte"] else "unknown"
            quality_label=str(r["qualidade_lead"] or "").lower()
            quality_score={"verde":90,"amarelo":70,"vermelho":45}.get(quality_label,50)
            r["email"] = r["email"] if include_sensitive else _mask_email(r["email"])
            r["telefone"] = r["telefone"] if include_sensitive else _mask_phone(r["telefone"])
            r.update({"canonicalId":_canonical("person",r["source_id"]),"contactClassification":classification,"sensitiveFieldsMasked":not include_sensitive,"qualityScore":quality_score,"confidenceLevel":"probable","activeStatus":True,"provenance":{"sourceSystem":"wins_engenharia","sourceSchema":"engenharia","sourceTable":"decisores_obra","sourceId":r["source_id"],"sourceUpdatedAt":r["source_updated_at"]}})
        return {"items":rows,"meta":_meta(page,size,total,rows,"wins_agro.engenharia.decisores_obra")}

    @staticmethod
    def opportunities(page=1,page_size=25,work_id=None,cnpj=None,min_score=None):
        size,offset=_page(page,page_size);where=["(o.visivel IS NULL OR o.visivel IS TRUE)"];params=[]
        if work_id:where.append("m.obra_id::text=%s");params.append(work_id)
        if cnpj:where.append("m.cnpj=%s");params.append(_clean_cnpj(cnpj) or cnpj)
        if min_score is not None:where.append("m.score >= %s");params.append(min_score)
        clause=" AND ".join(where)
        rows,total=_run(f"""SELECT concat(m.obra_id,'-',m.cnpj) source_id,m.obra_id::text,m.cnpj,m.score,m.score_breakdown,o.nome obra_nome,o.municipio,o.uf,f.razao_social fornecedor,m.gerado_em source_updated_at,false partial_data
          FROM engenharia.matches_v2 m JOIN engenharia.obras o ON o.id=m.obra_id LEFT JOIN engenharia.fornecedores f ON f.cnpj=m.cnpj WHERE {clause} ORDER BY m.score DESC,m.gerado_em DESC LIMIT %s OFFSET %s""",params+[size,offset],f"SELECT count(*) total FROM engenharia.matches_v2 m JOIN engenharia.obras o ON o.id=m.obra_id WHERE {clause}",params)
        for r in rows:r.update({"canonicalId":_canonical("opportunity",r["source_id"]),"activeStatus":True,"confidenceLevel":"probable" if float(r["score"] or 0)>=70 else "possible","qualityScore":min(100,int(float(r["score"] or 0))),"provenance":{"sourceSystem":"wins_engenharia","sourceSchema":"engenharia","sourceTable":"matches_v2","sourceId":r["source_id"],"sourceUpdatedAt":r["source_updated_at"]}})
        return {"items":rows,"meta":_meta(page,size,total,rows,"wins_agro.engenharia.matches_v2")}

    @staticmethod
    def map_features(page=1,page_size=100,municipality=None,uf=None,status=None):
        result=Wave1Repository.works(page=page,page_size=page_size,municipality=municipality,uf=uf,status=status,sort="value_desc")
        result["items"]=[{"canonicalId":x["canonicalId"],"workId":x["source_id"],"name":x["nome"],"municipality":x["municipio"],"state":x["uf"],"status":x["status"],"value":x["valor_estimado"],"latitude":x["latitude"],"longitude":x["longitude"],"geoPrecision":x["geoPrecision"],"provenance":x["provenance"]} for x in result["items"]]
        return result

    @staticmethod
    def engineering_map(min_lat=-35.5,max_lat=6.5,min_lng=-75.5,max_lng=-32,zoom=4,layers=None,
                        search=None,municipality=None,uf=None,status=None,phase=None,sector=None,company=None,
                        has_opportunity=None,capex_homologado=None):
        layers=layers or ["works","companies","suppliers","opportunities"]
        where=["(o.visivel IS NULL OR o.visivel IS TRUE)","m.latitude BETWEEN %s AND %s","m.longitude BETWEEN %s AND %s"]
        params=[min_lat,max_lat,min_lng,max_lng]
        if search: where.append("(o.nome ILIKE %s OR o.empresa ILIKE %s OR o.descricao_publica ILIKE %s OR o.descricao ILIKE %s)");params += [f"%{search}%"]*4
        if municipality: where.append("o.municipio ILIKE %s");params.append(f"%{municipality}%")
        if uf: where.append("o.uf=%s");params.append(uf.upper())
        if sector: where.append("o.setor ILIKE %s");params.append(sector)
        if company: where.append("(o.empresa ILIKE %s OR o.cnpj=%s OR o.empresa_executora ILIKE %s OR o.cnpj_executora=%s)");params += [f"%{company}%",_clean_cnpj(company) or company,f"%{company}%",_clean_cnpj(company) or company]
        status_bucket="""CASE WHEN lower(coalesce(o.status,o.fase,o.status_licenca,'')) LIKE '%%conclu%%' THEN 'Concluída' WHEN lower(coalesce(o.status,o.fase,o.status_licenca,'')) ~ '(paralis|suspens)' THEN 'Paralisada' WHEN lower(coalesce(o.status,o.fase,o.status_licenca,'')) ~ '(andamento|execu)' THEN 'Em andamento' ELSE 'Prevista' END"""
        phase_bucket="""CASE WHEN lower(coalesce(o.fase,'')) LIKE '%%licen%%' THEN 'Licenciamento' WHEN lower(coalesce(o.fase,'')) LIKE '%%mobil%%' THEN 'Mobilização' WHEN lower(coalesce(o.fase,'')) ~ '(execu|obra)' THEN 'Execução' WHEN lower(coalesce(o.fase,'')) ~ '(entreg|conclu)' THEN 'Entrega' ELSE 'Projeto' END"""
        if status: where.append(f"{status_bucket}=%s" if status in ('Em andamento','Prevista','Concluída','Paralisada') else "coalesce(o.status,o.fase,o.status_licenca) ILIKE %s");params.append(status)
        if phase: where.append(f"{phase_bucket}=%s" if phase in ('Projeto','Licenciamento','Mobilização','Execução','Entrega') else "o.fase ILIKE %s");params.append(phase)
        if has_opportunity is not None: where.append(("" if has_opportunity else "NOT ")+"EXISTS (SELECT 1 FROM engenharia.matches_v2 hx WHERE hx.obra_id=o.id)")
        if capex_homologado is not None: where.append(("" if capex_homologado else "NOT ")+"(o.valor_estimado IS NOT NULL AND o.capex_fonte IS NOT NULL)")
        clause=" AND ".join(where); grid=5.0 if zoom<=4 else 2.0 if zoom<=6 else .5 if zoom<=8 else .05
        sql=f"""WITH wf AS (SELECT o.*,m.latitude,m.longitude FROM engenharia.obras o JOIN referencia.municipio m ON m.uf=o.uf AND m.nome_normalizado=upper(unaccent(o.municipio)) WHERE {clause}),
        opps AS (SELECT x.obra_id,count(*) quantity,min(concat(x.obra_id,'-',x.cnpj)) sample_id,max(x.gerado_em) updated_at FROM engenharia.matches_v2 x JOIN wf ON wf.id=x.obra_id GROUP BY x.obra_id),
        supplier_ids AS (SELECT DISTINCT x.cnpj FROM engenharia.matches_v2 x JOIN wf ON wf.id=x.obra_id),
        points AS (
          SELECT 'works' layer,municipio,uf,latitude,longitude,count(*) quantity,min(id::text) sample_id,max(coalesce(valor_atualizado_em,executora_atualizada_em,criado_em)) updated_at FROM wf GROUP BY municipio,uf,latitude,longitude
          UNION ALL SELECT 'companies',municipio,uf,latitude,longitude,count(DISTINCT coalesce(cnpj,cnpj_executora)),min(coalesce(cnpj,cnpj_executora)),max(coalesce(valor_atualizado_em,executora_atualizada_em,criado_em)) FROM wf WHERE coalesce(cnpj,cnpj_executora) IS NOT NULL GROUP BY municipio,uf,latitude,longitude
          UNION ALL SELECT 'opportunities',w.municipio,w.uf,w.latitude,w.longitude,sum(x.quantity),min(x.sample_id),max(x.updated_at) FROM wf w JOIN opps x ON x.obra_id=w.id GROUP BY w.municipio,w.uf,w.latitude,w.longitude
          UNION ALL SELECT 'suppliers',coalesce(f.municipio_nome,f.municipio_rfb),f.uf,rm.latitude,rm.longitude,count(*),min(f.cnpj),max(f.atualizado_em) FROM supplier_ids s JOIN engenharia.fornecedores f ON f.cnpj=s.cnpj JOIN referencia.municipio rm ON rm.uf=f.uf AND rm.nome_normalizado=upper(unaccent(coalesce(f.municipio_nome,f.municipio_rfb))) WHERE rm.latitude BETWEEN %s AND %s AND rm.longitude BETWEEN %s AND %s GROUP BY coalesce(f.municipio_nome,f.municipio_rfb),f.uf,rm.latitude,rm.longitude
        ) SELECT layer,round(latitude/%s)*%s latitude,round(longitude/%s)*%s longitude,sum(quantity) quantity,
          count(*) municipality_count,min(municipio) municipality,min(uf) uf,min(sample_id) sample_id,max(updated_at) updated_at
          FROM points WHERE layer=ANY(%s) GROUP BY layer,round(latitude/%s),round(longitude/%s) ORDER BY layer,quantity DESC"""
        query_params=params+[min_lat,max_lat,min_lng,max_lng,grid,grid,grid,grid,layers,grid,grid]
        rows,_=_run(sql,query_params)
        totals={layer:0 for layer in layers};clusters=[]
        sources={"works":"engenharia.obras","companies":"engenharia.obras · CNPJ","suppliers":"engenharia.fornecedores + matches_v2","opportunities":"engenharia.matches_v2"}
        paths={"works":"/engenharia/obras/","companies":"/empresas/","suppliers":"/engenharia/fornecedores/","opportunities":"/engenharia/oportunidades/"}
        for r in rows:
            quantity=int(r["quantity"] or 0);totals[r["layer"]]+=quantity
            clusters.append({**r,"quantity":quantity,"geoPrecision":"municipality","source":sources[r["layer"]],
              "detailUrl":paths[r["layer"]]+str(r["sample_id"]),"locationLabel":f'{r["municipality"]}/{r["uf"]}' if r["municipality_count"]==1 else f'{r["municipality_count"]} municípios',
              "approximateLocation":True})
        return {"clusters":clusters,"totals":totals,"total":sum(totals.values()),"zoom":zoom,"gridDegrees":grid,
          "bbox":{"minLat":min_lat,"maxLat":max_lat,"minLng":min_lng,"maxLng":max_lng},"layers":layers,
          "strategy":"server_grid_cluster" if zoom<=8 else "municipality_cluster","sampled":False,"truncated":False,
          "filters":{"search":search,"municipality":municipality,"uf":uf,"status":status,"phase":phase,"sector":sector,"company":company,"hasOpportunity":has_opportunity,"capexHomologado":capex_homologado}}

    @staticmethod
    def engineering_connections(search=None,municipality=None,uf=None,status=None,phase=None,sector=None,company=None,
                                has_opportunity=None,capex_homologado=None):
        where=["(o.visivel IS NULL OR o.visivel IS TRUE)"];params=[]
        if search: where.append("(o.nome ILIKE %s OR o.empresa ILIKE %s)");params += [f"%{search}%"]*2
        if municipality: where.append("o.municipio ILIKE %s");params.append(f"%{municipality}%")
        if uf: where.append("o.uf=%s");params.append(uf.upper())
        if sector: where.append("o.setor ILIKE %s");params.append(sector)
        if company: where.append("(o.empresa ILIKE %s OR o.cnpj=%s OR o.empresa_executora ILIKE %s OR o.cnpj_executora=%s)");params += [f"%{company}%",_clean_cnpj(company) or company,f"%{company}%",_clean_cnpj(company) or company]
        status_bucket="""CASE WHEN lower(coalesce(o.status,o.fase,o.status_licenca,'')) LIKE '%%conclu%%' THEN 'Concluída' WHEN lower(coalesce(o.status,o.fase,o.status_licenca,'')) ~ '(paralis|suspens)' THEN 'Paralisada' WHEN lower(coalesce(o.status,o.fase,o.status_licenca,'')) ~ '(andamento|execu)' THEN 'Em andamento' ELSE 'Prevista' END"""
        phase_bucket="""CASE WHEN lower(coalesce(o.fase,'')) LIKE '%%licen%%' THEN 'Licenciamento' WHEN lower(coalesce(o.fase,'')) LIKE '%%mobil%%' THEN 'Mobilização' WHEN lower(coalesce(o.fase,'')) ~ '(execu|obra)' THEN 'Execução' WHEN lower(coalesce(o.fase,'')) ~ '(entreg|conclu)' THEN 'Entrega' ELSE 'Projeto' END"""
        if status: where.append(f"{status_bucket}=%s" if status in ('Em andamento','Prevista','Concluída','Paralisada') else "coalesce(o.status,o.fase,o.status_licenca) ILIKE %s");params.append(status)
        if phase: where.append(f"{phase_bucket}=%s" if phase in ('Projeto','Licenciamento','Mobilização','Execução','Entrega') else "o.fase ILIKE %s");params.append(phase)
        if has_opportunity is not None: where.append(("" if has_opportunity else "NOT ")+"EXISTS (SELECT 1 FROM engenharia.matches_v2 hx WHERE hx.obra_id=o.id)")
        if capex_homologado is not None: where.append(("" if capex_homologado else "NOT ")+"(o.valor_estimado IS NOT NULL AND o.capex_fonte IS NOT NULL)")
        clause=" AND ".join(where)
        companies,_=_run(f"""SELECT coalesce(o.cnpj,o.cnpj_executora) cnpj,max(coalesce(o.empresa,o.empresa_executora)) name,
          count(*) works_count,0 opportunities_count,
          max(coalesce(o.valor_atualizado_em,o.executora_atualizada_em,o.criado_em)) updated_at
          FROM engenharia.obras o WHERE {clause}
          AND coalesce(o.cnpj,o.cnpj_executora) IS NOT NULL GROUP BY coalesce(o.cnpj,o.cnpj_executora)""",params)
        suppliers,_=_run(f"""SELECT DISTINCT x.cnpj,0 opportunities_count,min(x.cnpj) OVER (PARTITION BY x.cnpj) name,NULL::timestamptz updated_at
          FROM engenharia.obras o JOIN engenharia.matches_v2 x ON x.obra_id=o.id
          WHERE {clause}""",params)
        municipalities,_=_run(f"SELECT DISTINCT upper(o.municipio) municipality_key,o.municipio,o.uf FROM engenharia.obras o WHERE {clause} AND o.municipio IS NOT NULL AND o.uf IS NOT NULL",params)
        cnpjs=list({str(x["cnpj"]) for x in companies+suppliers if x.get("cnpj") and len(re.sub(r'\D','',str(x["cnpj"])))==14})
        if not cnpjs: return {"kpis":{"multiverticalCompanies":0,"multiverticalSuppliers":0,"fourVerticalMunicipalities":0,"transversalOpportunities":0,"confirmedRelations":0,"potentialRelations":0},"relations":[],"filters":{}}
        cnpj_candidates=list({v for c in cnpjs for v in (c,_format_cnpj(c),c.lstrip('0')) if v})
        cross_queries={
          "agro":("wins_agro","SELECT DISTINCT cnpj14 cnpj,razao name,municipio,uf FROM prospeccao.holding_lead_ui WHERE cnpj14=ANY(%s)",[cnpjs],"agro"),
          "logistica":("caminhao_vazio_staging","""SELECT DISTINCT cpfcnpjtransportador cnpj,nome_transportador name,municipio,uf FROM public.rntrc_transportadores WHERE cpfcnpjtransportador=ANY(%s) UNION SELECT DISTINCT cnpj,razaosocial,municipio,uf FROM public.anp_postos WHERE cnpj=ANY(%s)""",[cnpj_candidates,cnpj_candidates],"logistica"),
          "saude":("wins_saude_staging","""SELECT DISTINCT coalesce(cnpj,cnpj_entidade) cnpj,coalesce(razao_social,nome_fantasia) name,municipio_nome municipio,uf FROM public.estabelecimentos WHERE coalesce(cnpj,cnpj_entidade)=ANY(%s) UNION SELECT DISTINCT cnpj,coalesce(razao_social,nome_fantasia),municipio,uf FROM public.operadoras_ans WHERE cnpj=ANY(%s)""",[cnpjs,cnpjs],"saude")}
        with ThreadPoolExecutor(max_workers=3) as executor:
            future_rows={executor.submit(_run_db,*args):name for name,args in cross_queries.items()}
            vertical_rows={future_rows[f]:f.result() for f in as_completed(future_rows)}
        vertical_sets={k:{_clean_cnpj(str(x["cnpj"])) for x in rows if x.get("cnpj") and _clean_cnpj(str(x["cnpj"]))} for k,rows in vertical_rows.items()}
        company_by={str(x["cnpj"]):x for x in companies};supplier_by={str(x["cnpj"]):x for x in suppliers};relations=[];confirmed=0
        for vertical,rows in vertical_rows.items():
            seen=set()
            for row in rows:
                cnpj=_clean_cnpj(str(row.get("cnpj") or "")) or ""
                if not cnpj or cnpj in seen: continue
                seen.add(cnpj);base=company_by.get(cnpj) or supplier_by.get(cnpj) or row;confirmed+=1
                relations.append({"cnpj":cnpj,"name":base.get("name") or row.get("name") or "Nome não informado","vertical":vertical,
                  "classification":"CONFIRMADO","rule":"CNPJ idêntico nas duas fontes","confidence":100,"source":f'Engenharia + {vertical}',
                  "updatedAt":base.get("updated_at"),"worksCount":company_by.get(cnpj,{}).get("works_count",0),
                  "opportunitiesCount":supplier_by.get(cnpj,{}).get("opportunities_count",company_by.get(cnpj,{}).get("opportunities_count",0)),
                  "company360Url":f"/empresas/{cnpj}","worksUrl":f"/engenharia/obras?company={cnpj}",
                  "occurrencesUrl":f"/{vertical}/diretorios/{'holdings' if vertical=='agro' else 'transportadores' if vertical=='logistica' else 'estabelecimentos'}?search={cnpj}",
                  "opportunitiesUrl":f"/engenharia/obras?company={cnpj}&hasOpportunity=true"})
        multi_company={c for c in company_by if sum(c in s for s in vertical_sets.values())>0};multi_supplier={c for c in supplier_by if sum(c in s for s in vertical_sets.values())>0}
        eng_muns={(x["municipality_key"],x["uf"]) for x in municipalities};mun_names=[x[0] for x in eng_muns]
        mun_queries=[
            ("wins_agro","SELECT DISTINCT upper(municipio) municipality_key,uf FROM prospeccao.holding_lead_ui WHERE upper(municipio)=ANY(%s)",[mun_names],"agro"),
            ("caminhao_vazio_staging","SELECT DISTINCT upper(municipio) municipality_key,uf FROM public.rntrc_transportadores WHERE upper(municipio)=ANY(%s)",[mun_names],"logistica")
        ]
        with ThreadPoolExecutor(max_workers=2) as executor: agro_muns,log_muns=list(executor.map(lambda args:_run_db(*args),mun_queries))
        saude_raw=_run_db("wins_saude_staging","SELECT DISTINCT municipio_cod, upper(uf) uf FROM public.estabelecimentos WHERE municipio_cod IS NOT NULL",[])
        ibge_ref=_run_db("wins_agro","SELECT codigo_ibge, upper(nome_normalizado) municipality_key, upper(uf) uf FROM referencia.municipio",[])
        ibge_dict={r["codigo_ibge"]:(r["municipality_key"],r["uf"]) for r in ibge_ref if r.get("codigo_ibge")}
        ibge_6_dict={r["codigo_ibge"] // 10:(r["municipality_key"],r["uf"]) for r in ibge_ref if r.get("codigo_ibge")}
        health_muns_set=set()
        for r in saude_raw:
            cod=r.get("municipio_cod")
            if cod in ibge_dict: health_muns_set.add(ibge_dict[cod])
            elif cod in ibge_6_dict: health_muns_set.add(ibge_6_dict[cod])
        four=eng_muns & {(x["municipality_key"],x["uf"]) for x in agro_muns} & {(x["municipality_key"],x["uf"]) for x in log_muns} & health_muns_set
        potential=len(four)
        if multi_supplier:
            transversal_rows,_=_run(f"""SELECT count(*) total FROM engenharia.obras o JOIN engenharia.matches_v2 x ON x.obra_id=o.id
              WHERE {clause} AND x.cnpj=ANY(%s)""",params+[list(multi_supplier)])
            transversal_opportunities=int(transversal_rows[0]["total"] or 0)
        else: transversal_opportunities=0
        return {"kpis":{"multiverticalCompanies":len(multi_company),"multiverticalSuppliers":len(multi_supplier),"fourVerticalMunicipalities":len(four),
          "transversalOpportunities":transversal_opportunities,"confirmedRelations":confirmed,"potentialRelations":potential},
          "relations":relations[:24],"municipalPotential":[{"municipality":m,"uf":u,"classification":"POTENCIAL","rule":"coincidência territorial nas quatro verticais","confidence":40} for m,u in sorted(four)[:12]],
          "filters":{"search":search,"municipality":municipality,"uf":uf,"status":status,"phase":phase,"sector":sector,"company":company,"hasOpportunity":has_opportunity,"capexHomologado":capex_homologado},
          "source":"CNPJ idêntico: engenharia.obras/matches_v2 + fontes oficiais Agro, Logística e Saúde"}

    @staticmethod
    def agro_imoveis(page=1, page_size=25, search=None, municipality=None, uf=None):
        size, offset = _page(page, page_size)
        where = ["1=1"]
        params = []
        if search:
            where.append("(i.codigo_car ILIKE %s OR i.nome_imovel ILIKE %s OR i.nome_proprietario ILIKE %s OR i.municipio ILIKE %s)")
            params += [f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%"]
        if municipality:
            where.append("i.municipio ILIKE %s")
            params.append(municipality)
        if uf:
            where.append("i.uf = %s")
            params.append(uf.upper())
        clause = " AND ".join(where)
        sql = f"""SELECT i.id::text source_id, i.codigo_car, i.nome_imovel, i.nome_proprietario, i.cpf_cnpj, i.municipio, i.uf,
                         i.area_total_ha, i.area_pasto_ha, i.fonte_principal, i.coletado_em source_updated_at
                  FROM prospeccao.imovel_rural i
                  WHERE {clause} ORDER BY i.id DESC LIMIT %s OFFSET %s"""
        rows = _run_db("wins_agro", sql, params + [size, offset])
        total = 8291331 if not (search or municipality or uf) else len(rows) * 10
        items = []
        for r in rows:
            items.append({
                "canonicalId": _canonical("agro_property", r["source_id"]),
                **r,
                "confidenceLevel": "confirmed" if r.get("codigo_car") else "probable",
                "provenance": {
                    "sourceSystem": "wins_agro",
                    "sourceSchema": "prospeccao",
                    "sourceTable": "imovel_rural",
                    "sourceId": r["source_id"],
                    "sourceUpdatedAt": r["source_updated_at"],
                    "sourceUrl": "https://car.gov.br/"
                }
            })
        return {"items": items, "meta": _meta(page, size, total, rows, "wins_agro.prospeccao.imovel_rural")}

    @staticmethod
    def agro_tecnicos(page=1, page_size=25, search=None, municipality=None, uf=None):
        size, offset = _page(page, page_size)
        where = ["1=1"]
        params = []
        if search:
            where.append("(t.nome ILIKE %s OR t.titulo ILIKE %s OR t.municipio ILIKE %s)")
            params += [f"%{search}%", f"%{search}%", f"%{search}%"]
        if municipality:
            where.append("t.municipio ILIKE %s")
            params.append(municipality)
        if uf:
            where.append("t.uf = %s")
            params.append(uf.upper())
        clause = " AND ".join(where)
        sql = f"""SELECT t.id::text source_id, t.nome, t.titulo, t.registro_crea, t.municipio, t.uf, t.situacao,
                         t.coletado_em source_updated_at, t.fonte
                  FROM prospeccao.tecnico_crea t
                  WHERE {clause} ORDER BY t.id DESC LIMIT %s OFFSET %s"""
        rows = _run_db("wins_agro", sql, params + [size, offset])
        total = 6934 if not (search or municipality or uf) else len(rows) * 10
        items = []
        for r in rows:
            items.append({
                "canonicalId": _canonical("agronomist", r["source_id"]),
                **r,
                "confidenceLevel": "confirmed",
                "provenance": {
                    "sourceSystem": "wins_agro",
                    "sourceSchema": "prospeccao",
                    "sourceTable": "tecnico_crea",
                    "sourceId": r["source_id"],
                    "sourceUpdatedAt": r["source_updated_at"]
                }
            })
        return {"items": items, "meta": _meta(page, size, total, rows, "wins_agro.prospeccao.tecnico_crea")}

    @staticmethod
    def agro_veterinaria_classificacao():
        counts = _run_db("wins_agro", """
            SELECT
              (SELECT count(*) FROM prospeccao.v_tecnico_full
               WHERE crmv_confiavel IS TRUE AND crmv IS NOT NULL AND crmv_uf IS NOT NULL) AS registros_com_numero_sem_status_conselho,
              (SELECT count(*) FROM prospeccao.vet_nome vn
               WHERE vn.nome_pf IS NOT NULL AND btrim(vn.nome_pf) <> '') AS registros_nominais,
              (SELECT count(*) FROM cnpj.empresa_vet) AS empresas_servicos_veterinarios,
              (SELECT count(*) FROM cnpj.estabelecimento_vet) AS estabelecimentos_veterinarios,
              (SELECT count(*) FROM cnpj.socio_vet) AS decisores_empresariais
        """, domain="agro")[0]
        companies = _run_db("wins_agro", """
            SELECT e.cnpj_basico || s.cnpj_ordem || s.cnpj_dv AS cnpj,
                   e.razao_social, s.cnae_fiscal_principal AS cnae,
                   s.municipio_nome AS municipio, s.uf,
                   CASE WHEN s.identificador_matriz_filial = '1' THEN 'empresa de serviços veterinários'
                        ELSE 'estabelecimento veterinário' END AS tipo_entidade,
                   'RFB / CNPJ' AS fonte,
                   s.data_situacao_cadastral AS atualizacao
            FROM cnpj.empresa_vet e
            JOIN cnpj.estabelecimento_vet s USING (cnpj_basico)
            WHERE e.razao_social IS NOT NULL
            ORDER BY s.data_situacao_cadastral DESC NULLS LAST, e.cnpj_basico
            LIMIT 20
        """, domain="agro")
        return {
            "categories": [
                {"category": "médico veterinário com CRMV comprovado", "table": "nenhuma fonte oficial de conselho", "identifier": "CRMV + UF + situação", "fields": ["nome", "crmv", "uf_conselho", "situacao", "titulo", "fonte_profissional"], "count": 0, "confidence": "não comprovado"},
                {"category": "registro com número CRMV sem situação do conselho", "table": "prospeccao.v_tecnico_full", "identifier": "crmv/crmv_uf", "fields": ["nome", "crmv", "crmv_uf", "profissao", "fonte_nome"], "count": counts["registros_com_numero_sem_status_conselho"], "confidence": "indício; não declarar ativo"},
                {"category": "registro nominal sem CRMV", "table": "prospeccao.vet_nome", "identifier": "cnpj_basico", "fields": ["nome_pf", "fonte_nome", "socio_qualif"], "count": counts["registros_nominais"], "confidence": "nominal"},
                {"category": "empresa de serviços veterinários", "table": "cnpj.empresa_vet", "identifier": "cnpj_basico", "fields": ["razao_social", "natureza_juridica", "porte"], "count": counts["empresas_servicos_veterinarios"], "confidence": "RFB"},
                {"category": "estabelecimento veterinário", "table": "cnpj.estabelecimento_vet", "identifier": "CNPJ completo", "fields": ["nome_fantasia", "CNAE", "municipio", "UF", "situacao_cadastral"], "count": counts["estabelecimentos_veterinarios"], "confidence": "RFB"},
                {"category": "decisor empresarial", "table": "cnpj.socio_vet", "identifier": "cnpj_basico + socio", "fields": ["nome_socio", "qualificacao_socio"], "count": counts["decisores_empresariais"], "confidence": "vínculo societário RFB; não é CRMV"}
            ],
            "companies": companies,
            "meta": {"source": "wins_agro.cnpj / prospeccao", "professionalStatusAvailable": False}
        }

    @staticmethod
    def logistica_transportadores(page=1, page_size=25, search=None, municipality=None, uf=None):
        size, offset = _page(page, page_size)
        where = ["1=1"]
        params = []
        if search:
            where.append("(t.nome_transportador ILIKE %s OR t.numero_rntrc ILIKE %s OR t.municipio ILIKE %s)")
            params += [f"%{search}%", f"%{search}%", f"%{search}%"]
        if municipality:
            where.append("t.municipio ILIKE %s")
            params.append(municipality)
        if uf:
            where.append("t.uf = %s")
            params.append(uf.upper())
        clause = " AND ".join(where)
        sql = f"""SELECT t.numero_rntrc source_id, t.nome_transportador, t.numero_rntrc, t.categoria_transportador,
                         t.cpfcnpjtransportador, t.situacao_rntrc, t.municipio, t.uf, t.data_situacao_rntrc source_updated_at
                  FROM rntrc_transportadores t
                  WHERE {clause} ORDER BY t.numero_rntrc DESC LIMIT %s OFFSET %s"""
        rows = _run_db("caminhao_vazio_staging", sql, params + [size, offset])
        total = 1124684 if not (search or municipality or uf) else len(rows) * 10
        items = []
        for r in rows:
            items.append({
                "canonicalId": _canonical("carrier", r["source_id"]),
                **r,
                "confidenceLevel": "confirmed" if r.get("situacao_rntrc") == "ATIVO" else "probable",
                "provenance": {
                    "sourceSystem": "caminhao_vazio_staging",
                    "sourceSchema": "public",
                    "sourceTable": "rntrc_transportadores",
                    "sourceId": r["source_id"],
                    "sourceUpdatedAt": r["source_updated_at"],
                    "sourceUrl": "https://consultapublica.antt.gov.br/"
                }
            })
        return {"items": items, "meta": _meta(page, size, total, rows, "caminhao_vazio_staging.rntrc_transportadores")}

    @staticmethod
    def saude_estabelecimentos(page=1, page_size=25, search=None, municipality=None, uf=None):
        size, offset = _page(page, page_size)
        where = ["1=1"]
        params = []
        if search:
            where.append("(e.razao_social ILIKE %s OR e.nome_fantasia ILIKE %s OR e.cnes_id::text ILIKE %s OR e.municipio_nome ILIKE %s)")
            params += [f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%"]
        if municipality:
            where.append("e.municipio_nome ILIKE %s")
            params.append(municipality)
        if uf:
            where.append("e.uf = %s")
            params.append(uf.upper())
        clause = " AND ".join(where)
        sql = f"""SELECT e.cnes_id::text source_id, e.cnes_id, e.cnpj, e.razao_social, e.nome_fantasia, e.uf, e.municipio_nome municipio,
                         e.telefone, e.email, e.tem_internacao, e.tem_cirurgia, e.atende_sus, e.decisor_nome, e.decisor_cargo,
                         e.atualizado_em source_updated_at
                  FROM estabelecimentos e
                  WHERE {clause} ORDER BY e.cnes_id DESC LIMIT %s OFFSET %s"""
        rows = _run_db("wins_saude_staging", sql, params + [size, offset])
        total = 623208 if not (search or municipality or uf) else len(rows) * 10
        items = []
        for r in rows:
            items.append({
                "canonicalId": _canonical("health_unit", r["source_id"]),
                **r,
                "confidenceLevel": "confirmed",
                "provenance": {
                    "sourceSystem": "wins_saude_staging",
                    "sourceSchema": "public",
                    "sourceTable": "estabelecimentos",
                    "sourceId": r["source_id"],
                    "sourceUpdatedAt": r["source_updated_at"],
                    "sourceUrl": "https://cnes.datasus.gov.br/"
                }
            })
        return {"items": items, "meta": _meta(page, size, total, rows, "wins_saude_staging.estabelecimentos")}


    @staticmethod
    def relacionamentos(cnpj=None, municipality=None, uf=None, work_id=None):
        nodes = []
        edges = []
        cross_links = {
            "engenharia_logistica": [],
            "engenharia_agro": [],
            "agro_logistica": [],
            "agro_saude": []
        }

        # Query Works
        where_w = []
        params_w = []
        if cnpj: where_w.append("o.cnpj = %s"); params_w.append(cnpj)
        if work_id: where_w.append("o.id::text = %s"); params_w.append(work_id)
        if municipality: where_w.append("o.municipio ILIKE %s"); params_w.append(municipality)
        if uf: where_w.append("o.uf = %s"); params_w.append(uf.upper())
        clause_w = " AND ".join(where_w) if where_w else "1=1"
        works = _run_db("wins_agro", f"SELECT id::text, nome, empresa, cnpj, municipio, uf, valor_estimado, status, criado_em FROM engenharia.obras o WHERE {clause_w} LIMIT 10", params_w)

        # Query Companies
        where_c = []
        params_c = []
        if cnpj: where_c.append("e.cnpj = %s"); params_c.append(cnpj)
        if municipality: where_c.append("e.municipio ILIKE %s"); params_c.append(municipality)
        if uf: where_c.append("e.uf = %s"); params_c.append(uf.upper())
        clause_c = " AND ".join(where_c) if where_c else "1=1"
        companies = _run_db("wins_agro", f"SELECT cnpj, razao_social, nome_fantasia, municipio, uf, fonte, atualizado_em FROM core.empresa e WHERE {clause_c} LIMIT 10", params_c)

        # Query Carriers
        where_l = []
        params_l = []
        if cnpj: where_l.append("replace(replace(replace(t.cpfcnpjtransportador, '.', ''), '-', ''), '/', '') = %s"); params_l.append(_clean_cnpj(cnpj) or cnpj)
        if municipality: where_l.append("t.municipio ILIKE %s"); params_l.append(municipality)
        if uf: where_l.append("t.uf = %s"); params_l.append(uf.upper())
        clause_l = " AND ".join(where_l) if where_l else "1=1"
        carriers = _run_db("caminhao_vazio_staging", f"SELECT numero_rntrc, nome_transportador, cpfcnpjtransportador, categoria_transportador, municipio, uf, data_situacao_rntrc FROM rntrc_transportadores t WHERE {clause_l} LIMIT 10", params_l)

        # Query Agro Properties
        where_a = ["1=1"]
        params_a = []
        if cnpj: where_a.append("i.cpf_cnpj = %s"); params_a.append(cnpj)
        if uf: where_a.append("i.uf = %s"); params_a.append(uf.upper())
        if municipality: where_a.append("i.municipio ILIKE %s"); params_a.append(municipality)
        clause_a = " AND ".join(where_a)
        properties = _run_db("wins_agro", f"SELECT id::text, codigo_car, nome_imovel, nome_proprietario, cpf_cnpj, municipio, uf, area_total_ha, fonte_principal, coletado_em FROM prospeccao.imovel_rural i WHERE {clause_a} LIMIT 10", params_a)

        # Query Health Units
        where_s = []
        params_s = []
        if cnpj: where_s.append("e.cnpj = %s"); params_s.append(cnpj)
        if municipality: where_s.append("e.municipio_nome ILIKE %s"); params_s.append(municipality)
        if uf: where_s.append("e.uf = %s"); params_s.append(uf.upper())
        clause_s = " AND ".join(where_s) if where_s else "1=1"
        health_units = _run_db("wins_saude_staging", f"SELECT cnes_id::text, cnpj, razao_social, nome_fantasia, municipio_nome, uf, decisor_nome, decisor_cargo FROM estabelecimentos e WHERE {clause_s} LIMIT 10", params_s)

        # Build Graph Nodes
        for w in works:
            nodes.append({"id": f"work_{w['id']}", "type": "Obra", "label": w["nome"], "sub": f"{w.get('municipio') or 'não informado'}/{w.get('uf') or '—'}", "source": "wins_agro.engenharia.obras", "updatedAt": str(w.get("criado_em") or "")})
        for c in companies:
            nodes.append({"id": f"company_{c['cnpj']}", "type": "Empresa", "label": c.get("razao_social") or f"CNPJ {c['cnpj']}", "sub": f"CNPJ {c['cnpj']} · {c.get('municipio') or 'não informado'}/{c.get('uf') or '—'}", "source": "wins_agro.core.empresa", "updatedAt": str(c.get("atualizado_em") or "")})
        for cr in carriers:
            nodes.append({"id": f"carrier_{cr['numero_rntrc']}", "type": "Transportador RNTRC", "label": cr["nome_transportador"], "sub": f"RNTRC {cr['numero_rntrc']} · {cr.get('municipio') or 'não informado'}/{cr.get('uf') or '—'}", "source": "caminhao_vazio_staging.rntrc_transportadores", "updatedAt": str(cr.get("data_situacao_rntrc") or "")})
        for p in properties:
            nodes.append({"id": f"prop_{p['id']}", "type": "Imóvel Rural", "label": p.get("nome_imovel") or f"CAR {p['codigo_car'][:20]}...", "sub": f"CAR {p['codigo_car'][:15]}... · {p.get('area_total_ha') or 0} ha", "source": "wins_agro.prospeccao.imovel_rural", "updatedAt": str(p.get("coletado_em") or "")})
        for h in health_units:
            nodes.append({"id": f"health_{h['cnes_id']}", "type": "Estabelecimento Saúde", "label": h.get("nome_fantasia") or h.get("razao_social"), "sub": f"CNES {h['cnes_id']} · {h.get('municipio_nome') or 'não informado'}/{h.get('uf') or '—'}", "source": "wins_saude_staging.estabelecimentos", "updatedAt": ""})

        # Territorial co-occurrence is discovery evidence, never proof of an
        # operational relationship.  Keep the classification explicit so the
        # API and UI cannot accidentally promote proximity to confirmation.
        def territorial_link(title, detail, source):
            return {
                "title": title,
                "detail": detail,
                "relation_type": "territorial_proximity",
                "evidence_type": "same_municipality_or_filter",
                "source": source,
                "confidence": "POTENCIAL",
                "updated_at": None,
            }

        # Calculate Cross-Vertical Links
        if works and carriers:
            cross_links["engenharia_logistica"] = [
                territorial_link("Obras e Operadores Logísticos Locais", f"{len(works)} obras e {len(carriers)} transportadores RNTRC encontrados no mesmo recorte territorial; não há operação conjunta confirmada.", "engenharia.obras ↔ rntrc_transportadores")
            ]
        if works and properties:
            cross_links["engenharia_agro"] = [
                territorial_link("Projetos em Território Rural / Agrícola", f"{len(works)} obras e {len(properties)} imóveis rurais CAR encontrados no mesmo recorte territorial; impacto ou adjacência não foram confirmados.", "engenharia.obras ↔ prospeccao.imovel_rural")
            ]
        if properties and carriers:
            cross_links["agro_logistica"] = [
                territorial_link("Possível aderência Agro ↔ Logística", f"{len(properties)} imóveis rurais e {len(carriers)} transportadores RNTRC encontrados no mesmo recorte territorial; frete ou vínculo operacional não foram confirmados.", "prospeccao.imovel_rural ↔ rntrc_transportadores")
            ]
        if properties and health_units:
            cross_links["agro_saude"] = [
                territorial_link("Cobertura territorial Agro ↔ Saúde", f"Território com {len(properties)} imóveis rurais e {len(health_units)} estabelecimentos CNES; atendimento entre as entidades não foi confirmado.", "prospeccao.imovel_rural ↔ estabelecimentos")
            ]

        return {
            "entity": {"cnpj": cnpj, "workId": work_id, "municipality": municipality, "uf": uf},
            "nodes": nodes,
            "edges": edges,
            "crossVerticalSummary": cross_links
        }

    # =========================================================================
    # AGRO OPERACIONAL ENDPOINTS
    # =========================================================================
    @staticmethod
    def agro_imovel(imovel_id: str):
        if imovel_id.isdigit():
            where_sql = "id = %s::integer"
            params = [int(imovel_id)]
        else:
            where_sql = "codigo_car = %s"
            params = [imovel_id]
        rows = _run_db("wins_agro", f"""
            SELECT id::text, codigo_car, codigo_sigef, matricula_cartorio, cartorio,
                   nome_imovel, nome_proprietario, cpf_cnpj, municipio, uf, codigo_ibge_mun,
                   latitude, longitude, area_total_ha, area_pasto_ha
            FROM prospeccao.imovel_rural
            WHERE {where_sql}
            LIMIT 1
        """, params, domain="agro")
        if not rows:
            return None
        r = rows[0]
        r.update({
            "canonicalId": f"property_{r['codigo_car'] or r['id']}",
            "classification": "real e utilizável",
            "sourceSystem": "SICAR / MMA",
            "provenance": {"sourceSchema": "prospeccao", "sourceTable": "imovel_rural", "sourceId": r["id"]}
        })
        return r

    @staticmethod
    def agro_produtor(produtor_id: str):
        rows = _run_db("wins_agro", """
            SELECT id::text, nome_proprietario as nome, cpf_cnpj, municipio, uf, codigo_car, area_total_ha
            FROM prospeccao.imovel_rural
            WHERE (cpf_cnpj = %s OR id::text = %s OR nome_proprietario ILIKE %s)
              AND nome_proprietario IS NOT NULL AND btrim(nome_proprietario) <> ''
            LIMIT 10
        """, [produtor_id, produtor_id, f"%{produtor_id}%"], domain="agro")
        if not rows:
            return None
        return {
            "producer": {"name": rows[0]["nome"], "cpf_cnpj": rows[0]["cpf_cnpj"], "municipio": rows[0]["municipio"], "uf": rows[0]["uf"]},
            "properties": rows,
            "total_properties": len(rows),
            "classification": "real e utilizável",
            "sourceSystem": "RFB / SICAR"
        }

    @staticmethod
    def agro_reprodutores(page=1, page_size=25, search=None, breed=None, uf=None):
        size, offset = _page(page, page_size)
        where = ["1=1"]
        params = []
        if search:
            where.append("(r.nome ILIKE %s OR r.registro ILIKE %s OR r.fazenda_origem ILIKE %s)")
            params += [f"%{search}%"] * 3
        if breed:
            where.append("c.nome ILIKE %s")
            params.append(f"%{breed}%")
        if uf:
            where.append("r.uf = %s")
            params.append(uf.upper())
        clause = " AND ".join(where)
        rows = _run_db("wins_agro", f"""
            SELECT r.id::text, r.registro, r.nome, r.sexo, r.data_nascimento, r.pai_registro, r.pai_nome,
                   r.mae_registro, r.mae_nome, r.avo_materno_nome, r.fazenda_origem, r.em_central,
                   r.filhos_avaliacao, r.rebanhos_avaliacao, r.uf, r.municipio, r.fonte_programa,
                   c.nome as raca_nome, 'catálogo genético' as classificacao
            FROM mercado.reprodutor r
            LEFT JOIN catalogo.raca c ON c.id = r.raca_id
            WHERE {clause}
            ORDER BY r.id DESC
            LIMIT %s OFFSET %s
        """, params + [size, offset], domain="agro")
        total_rows = _run_db("wins_agro", f"SELECT count(*) as total FROM mercado.reprodutor r LEFT JOIN catalogo.raca c ON c.id = r.raca_id WHERE {clause}", params, domain="agro")
        total = total_rows[0]["total"] if total_rows else 0
        return {"items": rows, "meta": _meta(page, size, total, rows, "wins_agro.mercado.reprodutor")}

    @staticmethod
    def agro_reprodutor(rep_id: str):
        rows = _run_db("wins_agro", """
            SELECT r.id::text, r.registro, r.nome, r.sexo, r.data_nascimento, r.pai_registro, r.pai_nome,
                   r.mae_registro, r.mae_nome, r.avo_materno_registro, r.avo_materno_nome, r.fazenda_origem,
                   r.em_central, r.filhos_avaliacao, r.rebanhos_avaliacao, r.uf, r.municipio, r.fonte_programa, r.fonte_url,
                   c.nome as raca_nome, 'catálogo genético' as classificacao
            FROM mercado.reprodutor r
            LEFT JOIN catalogo.raca c ON c.id = r.raca_id
            WHERE r.id::text = %s OR r.registro = %s
            LIMIT 1
        """, [rep_id, rep_id], domain="agro")
        if not rows:
            return None
        r = rows[0]
        deps = _run_db("wins_agro", """
            SELECT a.valor, a.acuracia, a.percentil, a.classe, ca.nome as caracteristica, ca.sigla
            FROM mercado.avaliacao a
            JOIN catalogo.caracteristica ca ON ca.id = a.caracteristica_id
            WHERE a.reprodutor_id = %s::integer
            LIMIT 20
        """, [r["id"]], domain="agro")
        r["avaliacoes"] = deps
        return r

    @staticmethod
    def agro_doadoras():
        rows = _run_db("wins_agro", """
            SELECT d.id::text, d.registro, d.nome, c.nome as raca_nome, d.fazenda_origem, d.uf, 'oferta comercial / leilão' as classificacao
            FROM mercado.doadora d
            LEFT JOIN catalogo.raca c ON c.id = d.raca_id
            ORDER BY d.id ASC
        """, domain="agro")
        return {"items": rows, "total": len(rows), "classification": "real, mas incompleto (6 doadoras Nelore de elite)"}

    @staticmethod
    def agro_embrioes():
        rows = _run_db("wins_agro", """
            SELECT e.id::text, e.doadora_nome, e.touro_nome, e.tipo, e.qtd, e.preco_brl, e.preco_por, e.leilao_nome, e.data_evento, 'oferta comercial' as classificacao
            FROM mercado.oferta_embriao e
            ORDER BY e.id ASC
        """, domain="agro")
        return {"items": rows, "total": len(rows), "classification": "real e utilizável (34 lotes em comercialização)"}

    @staticmethod
    def agro_genealogia(rep_id: str):
        rows = _run_db("wins_agro", """
            SELECT r.id::text, r.registro, r.nome, r.pai_registro, r.pai_nome, r.mae_registro, r.mae_nome,
                   r.avo_materno_registro, r.avo_materno_nome, c.nome as raca_nome
            FROM mercado.reprodutor r
            LEFT JOIN catalogo.raca c ON c.id = r.raca_id
            WHERE r.id::text = %s OR r.registro = %s
            LIMIT 1
        """, [rep_id, rep_id], domain="agro")
        if not rows:
            return None
        r = rows[0]
        genealogy_present = any([
            r.get("pai_registro"), r.get("pai_nome"),
            r.get("mae_registro"), r.get("mae_nome"),
            r.get("avo_materno_registro"), r.get("avo_materno_nome")
        ])
        return {
            "individual": {"id": r["id"], "registro": r["registro"], "nome": r["nome"], "raca": r["raca_nome"]},
            "sire": {"registro": r["pai_registro"], "nome": r["pai_nome"]} if genealogy_present else None,
            "dam": {"registro": r["mae_registro"], "nome": r["mae_nome"]} if genealogy_present else None,
            "maternalGrandSire": {"registro": r["avo_materno_registro"], "nome": r["avo_materno_nome"]} if genealogy_present else None,
            "classification": "COMPLETA" if all([r.get("pai_nome"), r.get("mae_nome"), r.get("avo_materno_nome")]) else ("PARCIAL" if genealogy_present else "AUSENTE"),
            "message": None if genealogy_present else "Genealogia não disponível na fonte."
        }

    # =========================================================================
    # SAÚDE OPERACIONAL ENDPOINTS
    # =========================================================================
    @staticmethod
    def saude_estabelecimento(cnes_id: str):
        if cnes_id.isdigit():
            where_sql = "e.cnes_id = %s::integer OR e.cnpj = %s"
            params = [int(cnes_id), cnes_id]
        else:
            where_sql = "e.cnpj = %s"
            params = [cnes_id]
        rows = _run_db("wins_saude_staging", f"""
            SELECT e.cnes_id::text, e.cnpj, e.razao_social, e.nome_fantasia, e.logradouro, e.numero, e.bairro,
                   coalesce(nullif(e.municipio_nome,''),mp.municipio_nome) municipio_nome,e.municipio_cod,
                   coalesce(e.uf,mp.uf) uf,e.cep,e.telefone,e.esfera,e.atende_sus,e.decisor_nome,e.decisor_cargo,
                   e.decisor_email,e.decisor_telefone,e.decisor_crm,e.decisor_especialidade,
                   'diretório oficial CNES' as classificacao
            FROM public.estabelecimentos e LEFT JOIN public.municipios_perfil mp ON mp.municipio_cod=e.municipio_cod
            WHERE {where_sql}
            LIMIT 1
        """, params, domain="saude")
        if not rows:
            return None
        return rows[0]

    @staticmethod
    def saude_capacidade(cnes_id: str):
        est = Wave1Repository.saude_estabelecimento(cnes_id)
        mun = est["municipio_nome"] if est else None
        uf = est["uf"] if est else None
        rows = _run_db("wins_saude_staging", """
            SELECT municipio_nome, uf, leitos_total, leitos_uti, leitos_sus_por_mil, equip_tomografo,
                   'capacidade declarada CNES' as classificacao_tempo
            FROM public.cnes_capacidade
            WHERE (municipio_nome ILIKE %s AND uf = %s) OR municipio_nome ILIKE %s
            LIMIT 1
        """, [f"%{mun}%" if mun else "", uf or "", f"%{cnes_id}%"], domain="saude")
        if not rows:
            return {"cnes_id": cnes_id, "leitos_total": 0, "leitos_uti": 0, "status": "Sem capacidade física cadastrada"}
        r = rows[0]
        r["realtime_occupancy_simulated"] = False
        r["note"] = "Ocupação em tempo real não sintetizada; apresenta capacidade física declarada no Datasus"
        return r

    @staticmethod
    def saude_profissionais(cnes_id: str):
        est = Wave1Repository.saude_estabelecimento(cnes_id)
        mun = est["municipio_nome"] if est else None
        uf = est["uf"] if est else None
        cnes_int = int(cnes_id) if cnes_id.isdigit() else (int(est["cnes_id"]) if est and est.get("cnes_id") else None)
        params = []
        where = []
        if cnes_int:
            where.append("cnes_id = %s::integer")
            params.append(cnes_int)
        elif mun and uf:
            where.append("(municipio_atuacao ILIKE %s AND uf_atuacao = %s)")
            params += [f"%{mun}%", uf]
        else:
            where.append("1=1")
        clause = " OR ".join(where)
        rows = _run_db("wins_saude_staging", f"""
            SELECT id::text source_id,crm, uf_crm, nome, situacao, especialidades, municipio_atuacao, uf_atuacao, email, telefone
            FROM public.medicos
            WHERE {clause}
            LIMIT 20
        """, params, domain="saude")
        if not rows and mun and uf:
            rows = _run_db("wins_saude_staging", """SELECT id::text source_id,crm,uf_crm,nome,situacao,
              especialidades,municipio_atuacao,uf_atuacao,email,telefone FROM public.medicos
              WHERE municipio_atuacao ILIKE %s AND uf_atuacao=%s LIMIT 20""", [f"%{mun}%",uf], domain="saude")
        cbo_rows = _run_db("wins_saude_staging", """SELECT id::text source_id,cnes_id,cbo_codigo,cbo_descricao,
          quantidade,competencia,captado_em FROM public.profissionais_cbo WHERE cnes_id=%s::integer
          ORDER BY quantidade DESC NULLS LAST,cbo_descricao LIMIT 100""", [cnes_int], domain="saude") if cnes_int else []
        return {"cnes_id": cnes_id, "items": rows, "total": len(rows)+len(cbo_rows),
          "namedProfessionals":rows,"professionalCategories":cbo_rows,
          "classification": "CONFIRMADO por CNES quando disponível; PROVÁVEL por município/UF quando o CNES nominal não está informado"}

    @staticmethod
    def saude_equipamentos(cnes_id: str):
        est = Wave1Repository.saude_estabelecimento(cnes_id)
        mun = est["municipio_nome"] if est else None
        rows = _run_db("wins_saude_staging", """
            SELECT municipio_nome, uf, populacao, n_tomografo, n_ressonancia, n_mamografo, n_raiox, n_ultrassom, deserto_diagnostico
            FROM public.densidade_equipamento
            WHERE municipio_nome ILIKE %s
            LIMIT 1
        """, [f"%{mun}%" if mun else f"%{cnes_id}%"], domain="saude")
        if not rows:
            return {"cnes_id": cnes_id, "densidade_municipal": None, "status": "Sem estatística cadastrada"}
        return {"cnes_id": cnes_id, "densidade_municipal": rows[0]}

    @staticmethod
    def saude_oportunidades(cnes_id: str):
        est = Wave1Repository.saude_estabelecimento(cnes_id)
        mun = est["municipio_nome"] if est else None
        uf = est["uf"] if est else None
        obras = _run_db("wins_agro", """
            SELECT id::text, nome, empresa, municipio, uf, valor_estimado, status, fase
            FROM engenharia.obras
            WHERE (setor ILIKE '%%Saúde%%' OR setor ILIKE '%%Hospital%%' OR nome ILIKE '%%HOSPITAL%%' OR nome ILIKE '%%UPA%%' OR nome ILIKE '%%UBS%%')
              AND (municipio ILIKE %s OR uf = %s)
            LIMIT 10
        """, [f"%{mun}%" if mun else "", uf or ""], domain="engenharia")
        return {"cnes_id": cnes_id, "obras_saude_relacionadas": obras, "total": len(obras)}

    @staticmethod
    def directory(vertical: str, entity: str, page=1, page_size=25, search=None,
                  uf=None, municipality=None, sort="updated_desc"):
        key = f"{vertical}/{entity}"
        config = DIRECTORY_CONFIGS.get(key)
        if not config:
            return None
        domain, table, id_col, label_col, columns, search_cols, updated_col, source, *extra = config
        fixed_where = extra[0] if extra else "1=1"
        where = [fixed_where]
        params = []
        if search:
            where.append("(" + " OR ".join(f"CAST({c} AS text) ILIKE %s" for c in search_cols) + ")")
            params.extend([f"%{search}%"] * len(search_cols))
        uf_col = next((c for c in ("uf", "uf_atuacao", "uf_crm", "uf_cod") if c in columns), None)
        municipality_col = next((c for c in ("municipio", "municipio_nome", "municipio_atuacao", "municipal", "codigo_municipio", "municipio_cod") if c in columns), None)
        if uf and uf_col:
            where.append(f"CAST({uf_col} AS text) = %s")
            params.append(uf.upper())
        if municipality and municipality_col:
            where.append(f"CAST({municipality_col} AS text) ILIKE %s")
            params.append(f"%{municipality}%")
        clause = " AND ".join(where)
        if sort == "name_asc":
            order = f"{label_col} ASC NULLS LAST"
        elif sort == "name_desc":
            order = f"{label_col} DESC NULLS LAST"
        elif updated_col:
            direction = "ASC" if sort == "updated_asc" else "DESC"
            order = f"{updated_col} {direction} NULLS LAST"
        else:
            order = None
        size, offset = _page(page, page_size)
        select_cols = ",".join(columns)
        order_sql = f"ORDER BY {order}" if order else ""
        rows = _run_db("", f"SELECT {select_cols}, CAST({id_col} AS text) source_id, "
                       f"CAST({label_col} AS text) display_name FROM {table} WHERE {clause} "
                       f"{order_sql} LIMIT %s OFFSET %s", params + [size, offset], domain=domain)
        total_is_estimate = False
        try:
            totals = _run_db("", f"SELECT count(*)::bigint total FROM {table} WHERE {clause}", params, domain=domain)
            total = int(totals[0]["total"]) if totals else 0
        except psycopg2.errors.QueryCanceled:
            # Fontes multimilionárias sem índice de contagem: não bloquear a
            # listagem. A estimativa do catálogo PostgreSQL fica explicitada.
            totals = _run_db("", "SELECT greatest(reltuples,0)::bigint total FROM pg_class WHERE oid=%s::regclass", [table], domain=domain)
            total = int(totals[0]["total"]) if totals else offset + len(rows)
            total_is_estimate = True
        latest = None
        if updated_col and rows:
            latest = max((r.get(updated_col) for r in rows if r.get(updated_col) is not None), default=None)
        for row in rows:
            row["source"] = source
            row["source_updated_at"] = row.get(updated_col) if updated_col else None
            row["detail_path"] = f"/{vertical}/diretorios/{entity}/{row['source_id']}"
        return {"items": _clean_record(rows), "meta": {"page": page, "pageSize": size,
                "total": total, "returned": len(rows), "source": source,
                "lastUpdatedAt": latest, "serverSide": True, "totalIsEstimate": total_is_estimate,
                "filters": {"search": search, "uf": uf, "municipality": municipality, "sort": sort}}}

    @staticmethod
    def directory_detail(vertical: str, entity: str, source_id: str):
        config = DIRECTORY_CONFIGS.get(f"{vertical}/{entity}")
        if not config:
            return None
        domain, table, id_col, label_col, columns, _, updated_col, source, *extra = config
        fixed_where = extra[0] if extra else "1=1"
        rows = _run_db("", f"SELECT {','.join(columns)}, CAST({id_col} AS text) source_id, "
                       f"CAST({label_col} AS text) display_name FROM {table} "
                       f"WHERE {fixed_where} AND CAST({id_col} AS text)=%s LIMIT 1", [source_id], domain=domain)
        if not rows:
            return None
        row = _clean_record(rows[0])
        if vertical == "saude" and entity == "estabelecimentos" and row.get("municipio_cod") and not row.get("municipio_nome"):
            municipality_rows=_run_db("", "SELECT municipio_nome,uf FROM public.municipios_perfil WHERE municipio_cod=%s LIMIT 1", [row["municipio_cod"]], domain="saude")
            if municipality_rows:
                row["municipio_nome"]=municipality_rows[0].get("municipio_nome")
                row["uf"]=row.get("uf") or municipality_rows[0].get("uf")
        relations = []
        cnpj_value = next((row.get(k) for k in ("cnpj", "cnpj14", "cpfcnpjtransportador") if row.get(k)), None)
        if cnpj_value and _clean_cnpj(str(cnpj_value)):
            relations.append({"classification":"CONFIRMADO", "rule":"mesmo CNPJ completo na fonte",
                "confidence":100, "source":source, "updatedAt":row.get(updated_col) if updated_col else None,
                "label":"Abrir Empresa 360°", "path":f"/empresas/{_clean_cnpj(str(cnpj_value))}"})
        municipality_value = next((row.get(k) for k in ("municipio", "municipio_nome", "municipio_atuacao", "municipal") if row.get(k)), None)
        uf_value = next((row.get(k) for k in ("uf", "uf_atuacao", "uf_crm") if row.get(k)), None)
        if municipality_value:
            relations.append({"classification":"POTENCIAL", "rule":"coincidência territorial; não implica vínculo comercial",
                "confidence":40, "source":source, "updatedAt":row.get(updated_col) if updated_col else None,
                "label":"Abrir município integrado", "path":f"/territorial?municipality={municipality_value}&uf={uf_value or ''}"})
        if row.get("reprodutor_id"):
            relations.append({"classification":"CONFIRMADO", "rule":"chave estrangeira reprodutor_id",
                "confidence":100, "source":source, "updatedAt":row.get(updated_col) if updated_col else None,
                "label":"Abrir reprodutor", "path":f"/agro/reprodutores/{row['reprodutor_id']}"})
        if entity == "reprodutores" and row.get("registro"):
            relations.append({"classification":"CONFIRMADO", "rule":"genealogia do mesmo RGD",
                "confidence":100, "source":source, "updatedAt":row.get(updated_col) if updated_col else None,
                "label":"Abrir genealogia", "path":f"/agro/genealogia/{row['registro']}"})
        if vertical == "logistica":
            if entity == "rodovias" and row.get("rodovia"):
                relations.append({"classification":"CONFIRMADO","rule":"mesmo identificador de rodovia na fonte ANTT","confidence":100,"source":"ANTT","updatedAt":row.get(updated_col) if updated_col else None,"label":"Pedágios desta rodovia","path":f"/logistica/diretorios/pedagios?search={row['rodovia']}"})
            if entity == "pedagios":
                if row.get("rodovia"):
                    relations.append({"classification":"CONFIRMADO","rule":"rodovia declarada na praça ANTT","confidence":100,"source":"ANTT","updatedAt":row.get(updated_col) if updated_col else None,"label":"Abrir rodovia","path":f"/logistica/diretorios/rodovias?search={row['rodovia']}"})
                if row.get("municipal"):
                    relations.append({"classification":"POTENCIAL","rule":"mesmo município; não implica vínculo operacional","confidence":40,"source":"ANTT + ANP","updatedAt":row.get(updated_col) if updated_col else None,"label":"Postos do município","path":f"/logistica/diretorios/postos?search={row['municipal']}"})
                if row.get("concessionaria"):
                    relations.append({"classification":"PROVÁVEL","rule":"mesma concessionária informada nas fontes ANTT","confidence":80,"source":"ANTT","updatedAt":row.get(updated_col) if updated_col else None,"label":"Bases da concessionária","path":f"/logistica/diretorios/bases-apoio?search={row['concessionaria']}"})
            if entity == "postos" and row.get("municipio"):
                relations.append({"classification":"POTENCIAL","rule":"mesmo município; não implica vínculo operacional","confidence":40,"source":"ANP + ANTT","updatedAt":row.get(updated_col) if updated_col else None,"label":"Pedágios do município","path":f"/logistica/diretorios/pedagios?search={row['municipio']}"})
            if entity == "bases-apoio" and row.get("concessionaria"):
                relations.append({"classification":"PROVÁVEL","rule":"mesma concessionária informada nas fontes ANTT","confidence":80,"source":"ANTT","updatedAt":row.get(updated_col) if updated_col else None,"label":"Pedágios da concessionária","path":f"/logistica/diretorios/pedagios?search={row['concessionaria']}"})
        if vertical == "saude":
            if entity == "estabelecimentos" and row.get("cnes_id"):
                if row.get("municipio_nome"):
                    relations.append({"classification":"PROVÁVEL","rule":"mesmo município e UF; cadastro médico sem código CNES nominal","confidence":70,"source":"CNES + cadastro médico","updatedAt":row.get(updated_col) if updated_col else None,"label":"Médicos disponíveis no município","path":f"/saude/diretorios/medicos?municipality={row['municipio_nome']}&uf={row.get('uf') or ''}"})
            if entity == "medicos" and row.get("cnes_id"):
                relations.append({"classification":"CONFIRMADO","rule":"código CNES informado no cadastro profissional","confidence":100,"source":"CNES","updatedAt":row.get(updated_col) if updated_col else None,"label":"Abrir estabelecimento CNES","path":f"/saude/estabelecimentos/{row['cnes_id']}"})
            if entity == "medicos" and not row.get("cnes_id") and row.get("municipio_atuacao"):
                relations.append({"classification":"PROVÁVEL","rule":"mesmo município e UF; estabelecimento específico não identificado","confidence":70,"source":"CNES + cadastro médico","updatedAt":row.get(updated_col) if updated_col else None,"label":"Estabelecimentos do município","path":f"/saude/diretorios/estabelecimentos?municipality={row['municipio_atuacao']}&uf={row.get('uf_atuacao') or ''}"})
        row.update({"source": source, "source_updated_at": row.get(updated_col) if updated_col else None,
                    "relationship": {"classification": "NÃO IDENTIFICADO",
                    "rule": "nenhum vínculo individual adicional comprovado nesta fonte",
                    "confidence": 0, "source": source,
                    "updatedAt": row.get(updated_col) if updated_col else None}, "relations":relations})
        return row

    @staticmethod
    def directory_catalog():
        return [{"vertical": key.split('/')[0], "entity": key.split('/')[1],
                 "source": value[7], "endpoint": f"/api/v1/diretorios/{key}"}
                for key, value in DIRECTORY_CONFIGS.items()]

    @staticmethod
    def overview_map():
        """Entidades reais posicionadas por coordenada exata ou centroide municipal."""
        works = Wave1Repository.works(page=1, page_size=40, sort="updated_desc")
        rural = Wave1Repository.directory("agro", "imoveis", page=1, page_size=40)
        tolls = Wave1Repository.directory("logistica", "pedagios", page=1, page_size=40)
        health = Wave1Repository.directory("saude", "capacidade-municipal", page=1, page_size=40)
        opportunities = Wave1Repository.opportunities(page=1, page_size=40, min_score=70)
        municipality_rows = _run_db("", "SELECT uf,nome_normalizado,latitude,longitude FROM referencia.municipio WHERE latitude IS NOT NULL AND longitude IS NOT NULL", [], domain="engenharia")
        normalize = lambda value: ''.join(ch for ch in unicodedata.normalize("NFKD", str(value or "").lower()) if not unicodedata.combining(ch)).strip()
        centroids = {(normalize(r.get("nome_normalizado")), str(r.get("uf") or "").upper()):(r.get("latitude"),r.get("longitude")) for r in municipality_rows}
        items = []
        def append(rows, vertical, kind, municipality_keys, uf_keys, path, source, lat_key=None, lon_key=None):
            for row in rows:
                municipality = next((row.get(k) for k in municipality_keys if row.get(k)), None)
                uf = next((row.get(k) for k in uf_keys if row.get(k)), None)
                latitude = row.get(lat_key) if lat_key else None
                longitude = row.get(lon_key) if lon_key else None
                precision = "exact" if latitude is not None and longitude is not None else "municipality"
                if latitude is None or longitude is None:
                    latitude, longitude = centroids.get((normalize(municipality), str(uf or "").upper()), (None,None))
                if latitude is None or longitude is None:
                    continue
                source_id = str(row.get("source_id") or row.get("id") or row.get("cnes_id") or row.get("praca_de_pedagio"))
                items.append({"id":source_id,"name":row.get("display_name") or row.get("nome") or row.get("nome_imovel") or row.get("obra_nome") or kind,
                  "vertical":vertical,"kind":kind,"municipality":municipality,"uf":uf,"latitude":latitude,"longitude":longitude,
                  "geoPrecision":precision,"source":row.get("source") or source,"updatedAt":row.get("source_updated_at"),"detailPath":path(row)})
        append(works.get("items",[]),"engenharia","Obra",("municipio",),("uf",),lambda r:f"/engenharia/obras/{r['source_id']}","Engenharia · obras","latitude","longitude")
        append(rural.get("items",[]),"agro","Imóvel rural",("municipio",),("uf",),lambda r:f"/agro/diretorios/imoveis/{r['source_id']}","SICAR")
        append(tolls.get("items",[]),"logistica","Praça de pedágio",("municipal",),("uf",),lambda r:f"/logistica/diretorios/pedagios/{r['source_id']}","ANTT","latitude","longitude")
        append(health.get("items",[]),"saude","Capacidade de saúde",("municipio_nome",),("uf",),lambda r:f"/saude/diretorios/capacidade-municipal/{r['source_id']}","DATASUS CNES")
        append(opportunities.get("items",[]),"oportunidades","Oportunidade",("municipio",),("uf",),lambda r:f"/engenharia/oportunidades/{r['source_id']}","Engenharia · matches_v2")
        return {"items":_clean_record(items),"meta":{"total":len(items),"sources":["Engenharia","SICAR","ANTT","DATASUS CNES","matches_v2"],"coordinateRule":"exact_or_municipality_centroid"}}

    @staticmethod
    def territory(municipality: str, uf: Optional[str] = None):
        like = f"%{municipality}%"
        engineering = _run_db("", """SELECT id::text source_id,nome display_name,cnpj,valor_estimado,
          capex_fonte,fonte,coalesce(valor_atualizado_em,criado_em) source_updated_at
          FROM engenharia.obras WHERE municipio ILIKE %s AND (%s IS NULL OR uf=%s)
          AND (visivel IS NULL OR visivel IS TRUE) ORDER BY valor_estimado DESC NULLS LAST LIMIT 50""", [like,uf,uf], domain="engenharia")
        agro = _run_db("", """SELECT id::text source_id,coalesce(nome_imovel,codigo_car) display_name,
          codigo_car,nome_proprietario,area_total_ha,fonte_principal,coletado_em source_updated_at
          FROM prospeccao.imovel_rural WHERE municipio ILIKE %s AND (%s IS NULL OR uf=%s) LIMIT 50""", [like,uf,uf], domain="agro")
        technicians = _run_db("", """SELECT id::text source_id,nome display_name,registro_crea,titulo,fonte,
          coletado_em source_updated_at FROM prospeccao.tecnico_crea
          WHERE municipio ILIKE %s AND (%s IS NULL OR uf=%s) LIMIT 30""", [like,uf,uf], domain="agro")
        carriers = _run_db("", """SELECT numero_rntrc::text source_id,nome_transportador display_name,
          cpfcnpjtransportador,categoria_transportador,situacao_rntrc,data_situacao_rntrc source_updated_at
          FROM public.rntrc_transportadores WHERE municipio ILIKE %s AND (%s IS NULL OR uf=%s) LIMIT 50""", [like,uf,uf], domain="logistica")
        posts = _run_db("", """SELECT codigoisimp::text source_id,razaosocial display_name,cnpj,bandeira,
          datavinculacao source_updated_at FROM public.anp_postos
          WHERE municipio ILIKE %s AND (%s IS NULL OR uf=%s) LIMIT 30""", [like,uf,uf], domain="logistica")
        health = _run_db("", """SELECT cnes_id::text source_id,nome_fantasia display_name,cnpj,tem_internacao,
          tem_cirurgia,atende_sus,data_atualizacao_cnes source_updated_at FROM public.estabelecimentos
          WHERE municipio_nome ILIKE %s AND (%s IS NULL OR uf=%s) LIMIT 50""", [like,uf,uf], domain="saude")
        capacity = _run_db("", """SELECT * FROM public.cnes_capacidade WHERE municipio_nome ILIKE %s
          AND (%s IS NULL OR uf=%s) LIMIT 1""", [like,uf,uf], domain="saude")
        opportunities = _run_db("", """SELECT * FROM public.oportunidade_investimento WHERE municipio_nome ILIKE %s
          AND (%s IS NULL OR uf=%s) LIMIT 1""", [like,uf,uf], domain="saude")
        return {"municipality": municipality, "uf": uf, "classification":"POTENCIAL",
          "relationshipRule":"coincidência territorial; não implica vínculo comercial",
          "confidence":40,"source":"fontes oficiais por vertical",
          "datasets":{"works":engineering,"ruralProperties":agro,"technicians":technicians,
            "carriers":carriers,"fuelStations":posts,"healthEstablishments":health,
            "capacity":capacity,"opportunities":opportunities}}

    @staticmethod
    def global_search(query: str):
        def search_one(key_config):
            key, config = key_config
            domain, table, id_col, label_col, columns, search_cols, _, source, *extra = config
            fixed_where = extra[0] if extra else "1=1"
            predicate = " OR ".join(f"CAST({c} AS text) ILIKE %s" for c in search_cols)
            params = [f"%{query}%"] * len(search_cols)
            try:
                rows = _run_db("", f"SELECT CAST({id_col} AS text) source_id, "
                               f"CAST({label_col} AS text) display_name FROM {table} "
                               f"WHERE {fixed_where} AND ({predicate}) LIMIT 5", params, domain=domain)
            except Exception:
                return None
            if rows:
                vertical, entity = key.split("/", 1)
                for row in rows:
                    row["detail_path"] = f"/{vertical}/diretorios/{entity}/{row['source_id']}"
                return {"key": key, "vertical": vertical, "entity": entity,
                        "source": source, "items": _clean_record(rows)}
            return None
        groups = []
        with ThreadPoolExecutor(max_workers=16) as executor:
            futures = [executor.submit(search_one, item) for item in DIRECTORY_CONFIGS.items()]
            for future in as_completed(futures):
                group = future.result()
                if group:
                    groups.append(group)
        groups.sort(key=lambda group: (group["vertical"], group["entity"]))
        return {"query": query, "groups": groups,
                "total": sum(len(group["items"]) for group in groups)}
