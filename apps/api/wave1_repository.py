import hashlib
import logging
import re
import unicodedata
import psycopg2
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any, Optional

from psycopg2.extras import RealDictCursor
from database import get_connection, release_connection, get_write_connection, release_write_connection

logger = logging.getLogger("wins_hub_api.wave1")



import time
import threading

_AGRO_CACHE_LOCK = threading.Lock()
_AGRO_MUN_CACHE = {"data": None, "timestamp": 0}
_AGRO_REF_MUN_CACHE = {"data": None, "timestamp": 0}

MAX_PAGE_SIZE = 100
QUERY_TIMEOUT_MS = 120000  # 2 min — Agro aggregate queries need more than 60s

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
            cur.execute("SET LOCAL statement_timeout = %s;", (QUERY_TIMEOUT_MS,))
            cur.execute(sql, params or [])
            rows = [dict(r) for r in cur.fetchall()]
        conn.rollback()
        return rows
    finally:
        release_connection(conn, domain)

def _run_agro_logistics(sql: str, params: Optional[list[Any]] = None):
    """Executa somente leitura no pool canônico compartilhado.

    A camada logística do Agro lê objetos do schema ``log`` que não são
    concedidos ao papel isolado ``agro``. Este helper é deliberadamente local:
    não altera a seleção de pool das demais funcionalidades.
    """
    conn = get_connection()
    try:
        conn.set_session(readonly=True, autocommit=False)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SET LOCAL statement_timeout = %s", (QUERY_TIMEOUT_MS,))
            cur.execute(sql, params or [])
            rows = [_clean_record(dict(row)) for row in cur.fetchall()]
        conn.rollback()
        return rows
    finally:
        release_connection(conn)

def _estimate_total(table: str, clause: str, params: list, default: int) -> int:
    """Estimate total rows with fallback. Uses pg_class for full table, count for filtered."""
    if clause in ("1=1", "f.situacao_cadastral = '02'", "f.situacao_cadastral = '02'"):
        return default
    try:
        rows, _ = _run(f"SELECT count(*) total FROM {table} WHERE {clause}", params)
        return int(rows[0]["total"]) if rows else default
    except Exception:
        return default

def _demanda_insumos_por_disciplina(disciplina_nome: str) -> list[str]:
    """Mapeia uma disciplina de obra para categorias técnicas prováveis de insumos.
    Não retorna fornecedores, apenas a demanda técnica estimada."""
    nome = (disciplina_nome or "").upper()
    if "ELÉTRICA" in nome or "ELETRICA" in nome:
        return ["Cabos e condutores", "Quadros elétricos", "Transformadores"]
    if "HIDRAULICA" in nome or "HIDRÁULICA" in nome or "SANITÁRIA" in nome:
        return ["Tubos e conexões", "Bombas hidráulicas", "Registros e válvulas"]
    if "CLIMATIZA" in nome:
        return ["Equipamentos de climatização", "Dutos e difusores"]
    if "ESTRUTURA" in nome or "FUNDA" in nome:
        return ["Aço", "Concreto", "Fôrmas"]
    if "PAVIMENTA" in nome:
        return ["Asfalto", "Concreto para pavimentação"]
    if "AUTOMA" in nome:
        return ["Sensores", "Controladores", "Cabos de controle"]
    if "INCÊNDIO" in nome or "INCENDIO" in nome or "PPCI" in nome:
        return ["Extintores", "Mangueiras", "Sprinklers"]
    if "ELEVADOR" in nome:
        return ["Cabos de aço", "Motores", "Botoeiras"]
    return ["Materiais diversos"]

class Wave1Repository:

    @staticmethod
    def works(page=1, page_size=25, search=None, municipality=None, uf=None, status=None,
              phase=None, sector=None, priority=None, capex_class=None, source=None,
              company=None, investment_min=None, investment_max=None,
              period_start=None, period_end=None, has_supplier=None, has_decision_maker=None,
              has_opportunity=None, has_inputs=None, has_supply_chain=None,
              capex_homologado=None, sort="updated_desc"):
        size, offset = _page(page, page_size)
        # Mesma regra da carteira legada: NULL significa que a obra nunca foi
        # ocultada explicitamente e, portanto, continua visível.
        where = ["(o.visivel IS NULL OR o.visivel IS TRUE)"]
        params: list[Any] = []
        if search:
            clean_s = _clean_cnpj(search) or search
            where.append("(o.nome ILIKE %s OR o.empresa ILIKE %s OR o.cnpj = %s OR o.id_externo ILIKE %s OR o.descricao_publica ILIKE %s OR o.descricao ILIKE %s OR o.municipio ILIKE %s)")
            params += [f"%{search}%", f"%{search}%", clean_s, f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%"]
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
        if priority:
            p_up = priority.upper()
            if p_up == 'OURO': where.append("(o.classificacao_computed = 'OURO' OR o.lead_score >= 80)")
            elif p_up == 'PRATA': where.append("(o.classificacao_computed = 'PRATA' OR (o.lead_score >= 50 AND o.lead_score < 80))")
            else: where.append("(coalesce(o.classificacao_computed, 'BRONZE') IN ('BRONZE', 'PIPELINE') OR o.lead_score < 50 OR o.lead_score IS NULL)")
        if capex_class:
            c_up = capex_class.upper()
            if c_up == 'HOMOLOGADO': where.append("(o.valor_estimado IS NOT NULL AND o.capex_fonte IS NOT NULL AND o.status_portao = 'APROVADA')")
            elif c_up == 'PUBLICADO': where.append("(o.valor_estimado IS NOT NULL AND o.fonte_tipo = 'OFICIAL')")
            elif c_up == 'ESTIMADO_FONTE': where.append("(o.valor_estimado IS NOT NULL AND o.capex_fonte IS NOT NULL)")
            elif c_up == 'ESTIMADO_REGRA': where.append("(o.valor_estimado IS NOT NULL AND o.capex_fonte IS NULL)")
            elif c_up == 'ESTIMADO_MODELO': where.append("(o.valor_estimado IS NOT NULL AND o.confianca_extracao IS NOT NULL)")
            elif c_up == 'INDISPONIVEL': where.append("(o.valor_estimado IS NULL)")
        if source: where.append("o.fonte ILIKE %s"); params.append(f"%{source}%")
        if company: where.append("(o.empresa ILIKE %s OR o.cnpj = %s OR o.empresa_executora ILIKE %s OR o.cnpj_executora = %s)"); params += [f"%{company}%", _clean_cnpj(company) or company, f"%{company}%", _clean_cnpj(company) or company]
        if investment_min is not None: where.append("o.valor_estimado >= %s"); params.append(investment_min)
        if investment_max is not None: where.append("o.valor_estimado <= %s"); params.append(investment_max)
        if period_start: where.append("coalesce(o.data_publicacao,o.data_anuncio,o.criado_em) >= %s"); params.append(period_start)
        if period_end: where.append("coalesce(o.data_publicacao,o.data_anuncio,o.criado_em) <= %s"); params.append(period_end)
        supplier_exists = "(o.cnpj_executora IS NOT NULL OR o.fornecedor_principal IS NOT NULL OR EXISTS (SELECT 1 FROM engenharia.matches_v2 ms WHERE ms.obra_id=o.id))"
        decision_exists = "EXISTS (SELECT 1 FROM engenharia.decisores_obra d WHERE d.obra_id=o.id AND d.excluido_em IS NULL)"
        opportunity_exists = "EXISTS (SELECT 1 FROM engenharia.matches_v2 mo WHERE mo.obra_id=o.id)"
        inputs_exists = "EXISTS (SELECT 1 FROM engenharia.matches_cadeia_obra mc WHERE mc.obra_id=o.id)"
        if has_supplier is not None: where.append(supplier_exists if has_supplier else f"NOT {supplier_exists}")
        if has_decision_maker is not None: where.append(decision_exists if has_decision_maker else f"NOT {decision_exists}")
        if has_opportunity is not None: where.append(opportunity_exists if has_opportunity else f"NOT {opportunity_exists}")
        if has_inputs is not None: where.append(inputs_exists if has_inputs else f"NOT {inputs_exists}")
        if has_supply_chain is not None: where.append(inputs_exists if has_supply_chain else f"NOT {inputs_exists}")
        capex_exists="(o.valor_estimado IS NOT NULL AND o.capex_fonte IS NOT NULL)"
        if capex_homologado is not None: where.append(capex_exists if capex_homologado else f"NOT {capex_exists}")
        order = {
          "name_asc":"o.nome ASC NULLS LAST", "name_desc":"o.nome DESC NULLS LAST",
          "investment_desc":"o.valor_estimado DESC NULLS LAST", "investment_asc":"o.valor_estimado ASC NULLS LAST",
          "updated_desc":"coalesce(o.valor_atualizado_em,o.executora_atualizada_em,o.criado_em) DESC NULLS LAST",
          "updated_asc":"coalesce(o.valor_atualizado_em,o.executora_atualizada_em,o.criado_em) ASC NULLS LAST",
          "start_desc":"coalesce(o.data_publicacao,o.data_anuncio) DESC NULLS LAST",
          "start_asc":"coalesce(o.data_publicacao,o.data_anuncio) ASC NULLS LAST",
          "priority_desc":"CASE WHEN o.classificacao_computed = 'OURO' THEN 1 WHEN o.classificacao_computed = 'PRATA' THEN 2 ELSE 3 END ASC, o.lead_score DESC NULLS LAST",
          "municipality_asc":"o.municipio ASC NULLS LAST",
          "phase_asc":"o.fase ASC NULLS LAST",
          "sector_asc":"o.setor ASC NULLS LAST"
        }.get(sort, "coalesce(o.valor_atualizado_em,o.executora_atualizada_em,o.criado_em) DESC NULLS LAST")
        clause = " AND ".join(where)
        select = f"""SELECT o.id::text source_id,o.nome,o.empresa,o.cnpj,o.empresa_executora,o.cnpj_executora,o.setor,o.municipio,o.uf,o.valor_estimado,
          coalesce(o.status,o.fase,o.status_licenca) status,o.fase,o.data_publicacao,o.data_anuncio,o.descricao_publica,o.descricao,
          o.fonte,o.url_fonte,o.capex_fonte,o.fonte_tipo,o.lead_score,o.classificacao_computed,
          (o.valor_estimado IS NOT NULL AND o.capex_fonte IS NOT NULL AND o.status_portao = 'APROVADA') investment_homologated,
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
            v_est = r.get("valor_estimado")
            c_fonte = r.get("capex_fonte")
            f_tipo = r.get("fonte_tipo")
            if v_est is None: capex_tax = "INDISPONIVEL"
            elif r.get("investment_homologated"): capex_tax = "HOMOLOGADO"
            elif f_tipo == "OFICIAL": capex_tax = "PUBLICADO"
            elif c_fonte: capex_tax = "ESTIMADO_FONTE"
            else: capex_tax = "ESTIMADO_REGRA"

            emp_name = r.get("empresa") or r.get("empresa_executora") or None
            emp_cnpj = r.get("cnpj") or r.get("cnpj_executora") or None
            if r.get("cnpj_executora"): emp_role = "executora confirmada"
            elif r.get("cnpj"): emp_role = "responsável"
            elif r.get("empresa"): emp_role = "empresa vinculada"
            else: emp_role = "empresa sugerida"

            score_val = r.get("lead_score") or 0
            computed = r.get("classificacao_computed")
            if computed == "OURO" or score_val >= 80: prio = "Ouro"
            elif computed == "PRATA" or score_val >= 50: prio = "Prata"
            else: prio = "Bronze"

            items.append({
                "canonicalId":_canonical("work",r["source_id"]),
                **r,
                "capex_taxonomy": capex_tax,
                "company_name": emp_name,
                "company_cnpj": emp_cnpj,
                "company_role": emp_role,
                "commercial_priority": prio,
                "qualityScore":max(0,quality),
                "confidenceLevel":"confirmed" if quality>=88 else "probable",
                "activeStatus":True,
                "geoPrecision":"municipality" if r["latitude"] is not None else "unknown",
                "provenance":{"sourceSystem":"wins_engenharia","sourceSchema":"engenharia","sourceTable":"obras","sourceId":r["source_id"],"sourceUpdatedAt":r["source_updated_at"]}
            })
        applied={k:v for k,v in {"search":search,"status":status,"phase":phase,"sector":sector,
          "priority":priority,"capex_class":capex_class,"source":source,
          "municipality":municipality,"uf":uf.upper() if uf else None,"company":company,
          "investment_min":investment_min,"investment_max":investment_max,
          "period_start":str(period_start) if period_start else None,"period_end":str(period_end) if period_end else None,
          "has_supplier":has_supplier,"has_decision_maker":has_decision_maker,"has_opportunity":has_opportunity,
          "has_inputs":has_inputs,"has_supply_chain":has_supply_chain,
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
          qualidade_lead,confianca_match,observacoes,hipotese_replicacao,email_status,
          email_verify_result,email_verificado_em,registrado_em source_updated_at
          FROM engenharia.decisores_obra
          WHERE obra_id=%s AND excluido_em IS NULL ORDER BY qualidade_lead DESC NULLS LAST,registrado_em DESC LIMIT 20""",[work_id])
        for dm in related:
            qualidade_raw = str(dm.get("qualidade_lead") or "").lower()
            qualidade_contato_normalizada = {"verde":90,"amarelo":70,"vermelho":45}.get(qualidade_raw,50)
            confianca_vinculo = int(dm.get("confianca_match") or 0)
            observacoes = str(dm.get("observacoes") or "").lower()
            hipotese = str(dm.get("hipotese_replicacao") or "").lower()
            has_org = bool(dm.get("cargo") and dm.get("fonte") and dm.get("fonte") != "ALGORITMO")
            has_verified_contact = (
                dm.get("email_status") == "valid"
                and dm.get("email_verify_result") == "deliverable"
                and bool(dm.get("email_verificado_em"))
            )
            is_known_false_positive = "falso_positivo" in hipotese or "area_errada" in observacoes
            # A pontuação algorítmica nunca comprova vínculo. Só uma anotação
            # explícita da fonte que liga a pessoa à obra/empreendimento.
            has_explicit_work_evidence = "decisor_buzios" in observacoes
            if has_org and has_explicit_work_evidence and not is_known_false_positive:
                status_validacao = "DECISOR_VALIDADO"
                vinculo_apresentacao = "validado"
            elif has_org and has_verified_contact and not is_known_false_positive:
                status_validacao = "CONTATO_VALIDADO"
                vinculo_apresentacao = "não comprovado"
            else:
                status_validacao = "CONTATO_SUGERIDO"
                vinculo_apresentacao = "sugerido"
            dm["qualidadeLeadRaw"] = qualidade_raw
            dm["qualidadeContatoNormalizada"] = qualidade_contato_normalizada
            dm["qualidadeContato"] = {"verde":"alta","amarelo":"média","vermelho":"baixa"}.get(qualidade_raw,"não classificada")
            dm["confiancaVinculoObra"] = confianca_vinculo
            dm["vinculoObra"] = vinculo_apresentacao
            dm["statusValidacao"] = status_validacao
            dm["dataVerificacao"] = str(dm.get("source_updated_at")) if dm.get("source_updated_at") else None
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
    def agro_imoveis(page=1, page_size=25, **filters):
        return Wave1Repository.agro_imoveis_catalog(page=page, page_size=page_size, **filters)

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

        # Assemble materialized edges matching nodes or filters
        node_ids = set(n["id"] for n in nodes)
        if node_ids:
            try:
                edges_raw = _run_db("wins_agro", """
                    SELECT e.relationship_id as id, e.source_id as source, e.target_id as target,
                           e.source_type as "sourceType", e.target_type as "targetType",
                           e.tipo_relacao, COALESCE(r.classificacao_nova, e.classificacao) as classification,
                           e.score as confidence, e.fonte, e.tipo_fonte, e.evidencia as evidence,
                           e.versao_regra, e.calculado_em, e.verificado_em, e.limitacoes,
                           CASE WHEN r.id IS NOT NULL THEN 'concluida' ELSE e.status_revisao END as status_revisao
                    FROM public.relationship_edges e
                    LEFT JOIN (
                        SELECT DISTINCT ON (relationship_id) id, relationship_id, classificacao_nova
                        FROM public.relationship_reviews
                        ORDER BY relationship_id, created_at DESC
                    ) r ON r.relationship_id = e.relationship_id
                    WHERE e.source_id = ANY(%s) OR e.target_id = ANY(%s)
                    LIMIT 100;
                """, [list(node_ids), list(node_ids)])
                for er in edges_raw:
                    er_dict = dict(er)
                    if er_dict.get("confidence") is not None:
                        er_dict["confidence"] = float(er_dict["confidence"])
                    if er_dict.get("calculado_em"):
                        er_dict["calculado_em"] = str(er_dict["calculado_em"])
                    if er_dict.get("verificado_em"):
                        er_dict["verificado_em"] = str(er_dict["verificado_em"])
                    edges.append(er_dict)
            except Exception as ex:
                print(f"Erro ao carregar arestas materializadas: {ex}")

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

    @staticmethod
    def ensure_review_tables():
        conn = get_write_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS public.relationship_reviews (
                        id SERIAL PRIMARY KEY,
                        relationship_id VARCHAR(255) NOT NULL,
                        classificacao_anterior VARCHAR(30) NOT NULL DEFAULT '',
                        classificacao_nova VARCHAR(30) NOT NULL,
                        justificativa TEXT NOT NULL DEFAULT '',
                        user_id VARCHAR(255) NOT NULL,
                        username VARCHAR(255) NOT NULL DEFAULT '',
                        roles TEXT NOT NULL DEFAULT '',
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );
                    CREATE INDEX IF NOT EXISTS idx_review_rel_id
                        ON public.relationship_reviews(relationship_id);
                """)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS public.review_audit_log (
                        id SERIAL PRIMARY KEY,
                        relationship_id VARCHAR(255) NOT NULL,
                        classificacao_anterior VARCHAR(30) NOT NULL DEFAULT '',
                        classificacao_nova VARCHAR(30) NOT NULL,
                        justificativa TEXT NOT NULL DEFAULT '',
                        user_id VARCHAR(255) NOT NULL,
                        username VARCHAR(255) NOT NULL DEFAULT '',
                        roles TEXT NOT NULL DEFAULT '',
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        action VARCHAR(30) NOT NULL DEFAULT 'update'
                    );
                    CREATE INDEX IF NOT EXISTS idx_audit_rel_id
                        ON public.review_audit_log(relationship_id);
                    CREATE INDEX IF NOT EXISTS idx_audit_user_id
                        ON public.review_audit_log(user_id);
                    CREATE INDEX IF NOT EXISTS idx_audit_created_at
                        ON public.review_audit_log(created_at);
                """)
                conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            release_write_connection(conn)

    @staticmethod
    def get_review_status(relationship_id: str) -> Optional[dict]:
        rows = _run_db("wins_agro", """
            SELECT id, relationship_id, classificacao_anterior, classificacao_nova,
                   justificativa, user_id, username, created_at
            FROM public.relationship_reviews
            WHERE relationship_id = %s
            ORDER BY created_at DESC
            LIMIT 1
        """, [relationship_id])
        return rows[0] if rows else None

    @staticmethod
    def save_review(relationship_id: str, classificacao_anterior: str,
                    classificacao_nova: str, justificativa: str,
                    user_id: str, username: str, roles: str) -> dict:
        conn = get_write_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    INSERT INTO public.relationship_reviews
                        (relationship_id, classificacao_anterior, classificacao_nova,
                         justificativa, user_id, username, roles)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id, relationship_id, classificacao_anterior,
                              classificacao_nova, justificativa, user_id, username, created_at
                """, [relationship_id, classificacao_anterior, classificacao_nova,
                      justificativa, user_id, username, roles])
                review = dict(cur.fetchone())

                cur.execute("""
                    INSERT INTO public.review_audit_log
                        (relationship_id, classificacao_anterior, classificacao_nova,
                         justificativa, user_id, username, roles, action)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, 'update')
                """, [relationship_id, classificacao_anterior, classificacao_nova,
                      justificativa, user_id, username, roles])
                conn.commit()
            return review
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            release_write_connection(conn)

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

    # =========================================================================
    # ENGINEERING SUPPLY CHAIN ENDPOINTS
    # =========================================================================

    @staticmethod
    def executors(page=1, page_size=25, search=None, uf=None, municipality=None, especialidade=None,
                  cnae=None, sector=None, classification=None, situacao_cadastral=None, porte=None,
                  has_relationships=None, has_confirmed=None, has_probable=None,
                  has_potential=None, has_contact=None, has_site=None, min_works=None,
                  include_unmatched=False, sort="rel_probable_desc"):
        size, offset = _page(page, page_size)
        where = []
        params = []

        if situacao_cadastral:
            where.append("f.situacao_cadastral = %s")
            params.append(situacao_cadastral)
        else:
            where.append("f.situacao_cadastral = '02'")

        # Regra de Reconciliação Canônica: por padrão, o catálogo lista apenas prestadores qualificados
        if not include_unmatched:
            where.append("prs.total_matches > 0")

        if search:
            clean_s = search.replace(".", "").replace("/", "").replace("-", "")
            where.append("(f.razao_social ILIKE %s OR f.nome_fantasia ILIKE %s OR f.cnpj ILIKE %s OR f.cnae_descricao ILIKE %s OR f.municipio_nome ILIKE %s)")
            params += [f"%{search}%", f"%{search}%", f"%{clean_s}%", f"%{search}%", f"%{search}%"]

        if uf:
            where.append("f.uf = %s")
            params.append(uf.upper())

        if municipality:
            where.append("f.municipio_nome ILIKE %s")
            params.append(f"%{municipality}%")

        if especialidade:
            where.append("(f.cnae_descricao ILIKE %s OR f.cnae_principal ILIKE %s)")
            params += [f"%{especialidade}%", f"%{especialidade}%"]

        if cnae:
            where.append("(f.cnae_principal ILIKE %s OR f.cnae_descricao ILIKE %s)")
            params += [f"%{cnae}%", f"%{cnae}%"]

        if porte:
            where.append("(f.porte ILIKE %s OR f.porte_descricao ILIKE %s)")
            params += [f"%{porte}%", f"%{porte}%"]

        if has_contact:
            where.append("((f.email IS NOT NULL AND f.email != '') OR (f.telefone_1 IS NOT NULL AND f.telefone_1 != ''))")

        if has_relationships:
            where.append("prs.total_matches > 0")

        if has_confirmed:
            where.append("prs.confirmed_count > 0")

        if has_probable:
            where.append("(prs.probable_count > 0 OR prs.confirmed_count > 0)")

        if has_potential:
            where.append("prs.potential_count > 0")

        if min_works and min_works > 0:
            where.append("prs.total_matches >= %s")
            params.append(min_works)

        if classification:
            c_upper = classification.upper()
            if c_upper == "CONFIRMADO":
                # Confirmação documental estrita: 0 se não houver documento anexado
                where.append("1=0")
            elif c_upper in ["PROVÁVEL", "PROVAVEL"]:
                where.append("(prs.probable_count > 0 OR prs.confirmed_count > 0)")
            elif c_upper == "POTENCIAL":
                where.append("prs.potential_count > 0 AND prs.probable_count = 0 AND prs.confirmed_count = 0")

        clause = " AND ".join(where) if where else "1=1"

        if sort in ["rel_confirmed_desc", "rel_probable_desc"]:
            order = "(prs.probable_count + prs.confirmed_count) DESC NULLS LAST, prs.total_matches DESC NULLS LAST, f.razao_social ASC"
        elif sort == "works_desc":
            order = "prs.total_matches DESC NULLS LAST, f.razao_social ASC"
        elif sort == "score_desc":
            order = "prs.best_score DESC NULLS LAST, f.razao_social ASC"
        elif sort == "updated_desc":
            order = "f.atualizado_em DESC NULLS LAST"
        elif sort == "location_asc":
            order = "f.uf ASC, f.municipio_nome ASC"
        else:
            order = "f.razao_social ASC NULLS LAST"

        rows, _ = _run(f"""SELECT f.cnpj, f.razao_social, f.nome_fantasia, f.cnae_principal, f.cnae_descricao,
          f.cnae_secundarios, f.municipio_nome, f.uf, f.porte, f.porte_descricao, f.capital_social,
          f.atualizado_em source_updated_at, f.situacao, f.situacao_cadastral, f.email, f.telefone_1,
          coalesce(prs.total_matches, 0) as total_works,
          coalesce(prs.best_score, 0) as best_score,
          coalesce(prs.confirmed_count, 0) as raw_confirmed_count,
          coalesce(prs.probable_count, 0) as raw_probable_count,
          coalesce(prs.potential_count, 0) as potential_count,
          prs.best_work_id,
          prs.best_work_name
          FROM engenharia.fornecedores f
          LEFT JOIN public.provider_relationship_summary prs ON prs.cnpj = f.cnpj
          WHERE {clause} ORDER BY {order} LIMIT %s OFFSET %s""",
          params + [size, offset])

        count_rows, _ = _run(f"""SELECT count(*) total FROM engenharia.fornecedores f
          LEFT JOIN public.provider_relationship_summary prs ON prs.cnpj = f.cnpj
          WHERE {clause}""", params)
        total = count_rows[0]["total"] if count_rows else 27937

        items = []
        for r in rows:
            cnpj = r["cnpj"]
            c_raw = cnpj.replace(".", "").replace("/", "").replace("-", "").strip()
            cnpj_fmt = f"{c_raw[:2]}.{c_raw[2:5]}.{c_raw[5:8]}/{c_raw[8:12]}-{c_raw[12:14]}" if len(c_raw) == 14 else cnpj

            cnaes = [r["cnae_principal"]] if r.get("cnae_principal") else []
            if r.get("cnae_secundarios"):
                cnaes += list(r["cnae_secundarios"])

            especialidade_desc = r.get("cnae_descricao") or "Serviços de Engenharia Geral"
            especialidades_list = [especialidade_desc]
            if len(cnaes) > 1:
                especialidades_list.append(f"CNAE {cnaes[1]}")

            municipio = r.get("municipio_nome")
            uf_val = r.get("uf") or "—"
            loc_fmt = f"{municipio}, {uf_val}" if municipio else f"Município não informado, {uf_val}"

            # Auditoria Estrita: Sem documento comprobatório real, confirmados = 0
            # Matches algorítmicos são reclassificados como PROVÁVEL
            raw_conf = int(r.get("raw_confirmed_count") or 0)
            raw_prov = int(r.get("raw_probable_count") or 0)
            pot = int(r.get("potential_count") or 0)

            conf = 0 # 0 confirmados documentais
            prov = raw_conf + raw_prov # Reclassificado para provável
            tot_w = int(r.get("total_works") or 0)

            best_class = "PROVÁVEL" if prov > 0 else ("POTENCIAL" if pot > 0 else "NENHUMA")
            best_sc = round(float(r.get("best_score") or 0), 1)

            best_work_name = r.get("best_work_name") or "Obra em prospecção de compatibilidade"
            best_work_id = r.get("best_work_id") or ""

            items.append({
                "id": cnpj, "cnpj": cnpj, "cnpj_formatted": cnpj_fmt,
                "razaoSocial": r["razao_social"],
                "nomeFantasia": r.get("nome_fantasia") or r["razao_social"],
                "especialidades": especialidades_list,
                "cnaes": cnaes, "municipality": r.get("municipio_nome") or "Município não informado",
                "state": uf_val, "location_formatted": loc_fmt,
                "worksConfirmedCount": conf, "worksProvaveisCount": prov, "worksPotenciaisCount": pot,
                "totalWorksCount": tot_w,
                "relationships_summary": f"{conf} confirmadas · {prov} prováveis · {pot} potenciais",
                "best_classification": best_class, "best_score": best_sc,
                "best_score_label": f"Melhor score em obra: {int(best_sc)}/100" if best_sc > 0 else "Sem score",
                "best_work_name": best_work_name,
                "best_work_id": best_work_id,
                "porte": r.get("porte_descricao") or r.get("porte") or "Não informado",
                "situacaoCadastral": "Ativa" if r.get("situacao_cadastral") == "02" else (r.get("situacao") or "Regular"),
                "hasContact": bool(r.get("email") or r.get("telefone_1")),
                "updatedAt": str(r["source_updated_at"]) if r.get("source_updated_at") else None,
            })
        meta = {
            "page": page, "pageSize": size, "total": total, "returned": len(items),
            "title": "Empresas Prestadoras de Serviços",
            "universe_summary": {
                "empresas_analisadas_universo": 4094206,
                "prestadores_qualificados_cnpjs": 29814,
                "cnpjs_reconciliados_fornecedores": 27937,
                "relacoes_totais_obra_prestador": 1314135,
                "confirmados_documentais": 0,
                "provaveis_relacoes": 52893,
                "potenciais_relacoes": 1261242,
                "nao_classificados": 325,
                "excluidos": 39
            },
            "source": "wins_agro.engenharia.fornecedores + provider_relationship_summary"
        }
        return {"items": items, "meta": meta}

    @staticmethod
    def executor(executor_id: str):
        cnpj = _clean_cnpj(executor_id) or executor_id
        rows, _ = _run("SELECT * FROM engenharia.fornecedores WHERE cnpj=%s LIMIT 1", [cnpj])
        if not rows:
            return None
        r = rows[0]
        cnaes = [r["cnae_principal"]] if r.get("cnae_principal") else []
        if r.get("cnae_secundarios"):
            cnaes += list(r["cnae_secundarios"])
        match_rows, _ = _run("""SELECT m.obra_id::text, o.nome, o.setor, o.fase, m.score
          FROM engenharia.matches_v2 m JOIN engenharia.obras o ON o.id = m.obra_id
          WHERE m.cnpj = %s AND (o.visivel IS NULL OR o.visivel IS TRUE)
          ORDER BY m.score DESC LIMIT 50""", [cnpj])
        works_confirmed = []
        works_provaveis = []
        for m in match_rows:
            w = {"workId": m["obra_id"], "workName": m["nome"], "sector": m["setor"], "phase": m["fase"]}
            if m["score"] and m["score"] >= 80:
                works_confirmed.append(w)
            else:
                works_provaveis.append(w)
        territories = [r.get("uf")] if r.get("uf") else []
        try:
            uf_rows, _ = _run("SELECT DISTINCT o.uf FROM engenharia.obras o JOIN engenharia.matches_v2 m ON m.obra_id = o.id WHERE m.cnpj = %s AND o.uf IS NOT NULL", [cnpj])
            for u in uf_rows:
                if u.get("uf") and u["uf"] not in territories:
                    territories.append(u["uf"])
        except Exception:
            pass
        total_matches = len(match_rows)
        high_score = sum(1 for m in match_rows if m["score"] and m["score"] >= 80)
        score_pct = min(100, (high_score * 100 // max(1, total_matches))) if total_matches > 0 else 0
        classification_val = "POTENCIAL"
        evidence = "Matching territorial ou CNAE sem vínculo contratual"
        if score_pct >= 60:
            classification_val = "PROVÁVEL"
            evidence = "Múltiplas correspondências CNAE/território com score >= 70"
        if score_pct >= 85 and high_score >= 3:
            classification_val = "CONFIRMADO"
            evidence = f"{high_score} vínculos diretos obra-executor com score >= 80"
        input_links, _ = _run("""SELECT DISTINCT fc.fornecedor_cnpj cnpj, f2.razao_social nome
          FROM engenharia.matches_cadeia_fornecedor fc
          LEFT JOIN engenharia.fornecedores f2 ON f2.cnpj = fc.fornecedor_cnpj
          WHERE fc.fornecedor_cnpj = %s LIMIT 20""", [cnpj])
        return {
            "id": cnpj, "cnpj": cnpj, "razaoSocial": r["razao_social"],
            "nomeFantasia": r.get("nome_fantasia") or r["razao_social"],
            "papel": "PRESTADOR_SERVICO", "especialidades": [r["cnae_descricao"]] if r.get("cnae_descricao") else [],
            "cnaes": cnaes, "municipality": r["municipio_nome"], "state": r["uf"],
            "territories": territories,
            "worksConfirmed": works_confirmed, "worksProvaveis": works_provaveis,
            "porte": r.get("porte_descricao") or r.get("porte") or "Não informado",
            "score": score_pct, "classification": classification_val, "evidence": evidence,
            "source": "engenharia.fornecedores + engenharia.matches_v2",
            "updatedAt": str(r["atualizado_em"]) if r.get("atualizado_em") else None,
            "endereco": {"logradouro": r.get("logradouro"), "numero": r.get("numero"),
              "bairro": r.get("bairro"), "cep": r.get("cep"), "municipio": r.get("municipio_nome"), "uf": r.get("uf")},
            "contato": {"telefone": r.get("telefone_1"), "email": r.get("email")},
            "supplierInputIds": [x["cnpj"] for x in input_links if x.get("cnpj")],
        }

    @staticmethod
    def _load_input_suppliers():
        import os, json
        data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
        data_file = os.path.join(data_dir, "fornecedores_insumos_evidenciados.json")
        if not os.path.exists(data_file):
            return {"items": [], "total_evidenced": 0, "facets": {"categories": [], "roles": [], "ufs": []},
                    "coverage_status": "PARTIAL", "updated_at": None, "summary": {}}
        with open(data_file, "r", encoding="utf-8") as f:
            return json.load(f)

    @staticmethod
    def input_suppliers(page=1, page_size=25, search=None, uf=None, categoria=None, tipo=None, sort="name_asc"):
        data = Wave1Repository._load_input_suppliers()
        items = data.get("items", [])

        if search:
            q = search.lower()
            items = [i for i in items if q in i.get("razaoSocial", "").lower() or q in i.get("cnpj", "")]
        if uf:
            uf_upper = uf.upper()
            items = [i for i in items if i.get("uf", "").upper() == uf_upper]
        if categoria:
            items = [i for i in items if i.get("categoria", "").lower() == categoria.lower()]
        if tipo:
            tipo_upper = tipo.upper()
            items = [i for i in items if i.get("papel", "").upper() == tipo_upper]

        total = len(items)
        size = max(1, min(100, page_size))
        offset = (max(1, page) - 1) * size
        page_items = items[offset:offset + size]

        return {
            "availability": "AVAILABLE",
            "items": page_items,
            "meta": {
                "total": total,
                "page": page,
                "pageSize": size,
                "source": "Piloto Fornecedores de Insumos · Lotes 3+4",
                "lastUpdatedAt": data.get("updated_at"),
                "partialData": False
            },
            "message": None
        }

    @staticmethod
    def input_supplier(supplier_id: str):
        data = Wave1Repository._load_input_suppliers()
        for item in data.get("items", []):
            if item.get("id") == supplier_id or item.get("cnpj") == supplier_id:
                return {
                    "availability": "AVAILABLE",
                    "item": item,
                    "message": None
                }
        return {
            "availability": "AVAILABLE",
            "item": None,
            "message": "Fornecedor de insumo não encontrado"
        }

    @staticmethod
    def input_suppliers_summary():
        data = Wave1Repository._load_input_suppliers()
        return {
            "total_evidenced": data.get("total_evidenced", 0),
            "categories": data.get("facets", {}).get("categories", []),
            "roles": data.get("facets", {}).get("roles", []),
            "ufs": data.get("facets", {}).get("ufs", []),
            "coverage_status": data.get("coverage_status", "PARTIAL"),
            "updated_at": data.get("updated_at"),
            "summary": data.get("summary", {})
        }

    @staticmethod
    def input_suppliers_facets():
        data = Wave1Repository._load_input_suppliers()
        return {
            "categories": data.get("facets", {}).get("categories", []),
            "roles": data.get("facets", {}).get("roles", []),
            "ufs": data.get("facets", {}).get("ufs", []),
            "total_evidenced": data.get("total_evidenced", 0)
        }

    @staticmethod
    def work_executors(work_id: str):
        rows, _ = _run("""SELECT m.cnpj, m.score, m.nivel_proximidade, m.ranking, m.categoria_id,
          cs.nome categoria_nome, f.razao_social, f.nome_fantasia, f.cnae_descricao, f.municipio_nome, f.uf
          FROM engenharia.matches_obra_prestador m
          LEFT JOIN engenharia.categorias_servico cs ON cs.id = m.categoria_id
          LEFT JOIN engenharia.fornecedores f ON f.cnpj = m.cnpj
          WHERE m.obra_id = %s::uuid AND f.cnpj IS NOT NULL
          ORDER BY m.score DESC NULLS LAST, m.ranking ASC NULLS LAST
          LIMIT 50""", [work_id])
        if not rows:
            # Fallback: buscar prestadores compatíveis via matches_v2 quando
            # matches_obra_prestador está vazia para esta obra.
            rows, _ = _run("""SELECT m.cnpj, m.score, NULL::int nivel_proximidade,
              NULL::int ranking, NULL::int categoria_id,
              NULL::text categoria_nome, f.razao_social, f.nome_fantasia,
              f.cnae_descricao, f.municipio_nome, f.uf
              FROM engenharia.matches_v2 m
              JOIN engenharia.fornecedores f ON f.cnpj = m.cnpj
              WHERE m.obra_id = %s::uuid AND f.situacao_cadastral = '02'
              ORDER BY m.score DESC NULLS LAST
              LIMIT 50""", [work_id])
        items = []
        for r in rows:
            classification = "PROVÁVEL"
            evidence = "Score >= 70 por CNAE/território - compatibilidade técnica sem vínculo documental"
            score_val = float(r["score"]) if r.get("score") else 0
            if score_val >= 90:
                classification = "PROVÁVEL"
                evidence = "Score >= 90 - compatibilidade forte, sem documento"
            elif score_val >= 70:
                classification = "PROVÁVEL"
                evidence = f"Score {int(score_val)} - compatibilidade CNAE/territorial"
            elif score_val > 0:
                classification = "POTENCIAL"
                evidence = "Compatibilidade cadastral ou territorial básica"
            else:
                classification = "POTENCIAL"
                evidence = "Compatibilidade cadastral, técnica ou territorial"
            items.append({
                "id": r["cnpj"], "cnpj": r["cnpj"],
                "razaoSocial": r["razao_social"] or r["nome_fantasia"] or f"CNPJ {r['cnpj']}",
                "nomeFantasia": r.get("nome_fantasia") or r.get("razao_social"),
                "papel": "PRESTADOR_SERVICO",
                "especialidades": [r["categoria_nome"]] if r.get("categoria_nome") else [],
                "cnaes": [],
                "municipality": r["municipio_nome"], "state": r["uf"],
                "territories": [r["uf"]] if r.get("uf") else [],
                "score": int(score_val),
                "classification": classification, "evidence": evidence,
                "source": "engenharia.matches_v2" if not r.get("categoria_id") else "engenharia.matches_obra_prestador",
            })
        return {"items": items, "total": len(items),
                "source": "wins_agro.engenharia.matches_obra_prestador" if rows and rows[0].get("categoria_id") else "wins_agro.engenharia.matches_v2"}

    @staticmethod
    def work_disciplinas(work_id: str):
        work_rows, _ = _run("SELECT setor, fase FROM engenharia.obras WHERE id::text = %s LIMIT 1", [work_id])
        if not work_rows:
            return {"items": [], "total": 0, "message": "Obra não encontrada"}
        w = work_rows[0]
        setor = w.get("setor", "").upper()
        fase = w.get("fase", "")
        compat = _run_db("", """SELECT sc.setor_obra, sc.cnae_codigo, sc.peso, sc.fases_aplicaveis, sc.fonte,
          cs.id categoria_id, cs.nome categoria_nome, cs.descricao categoria_descricao
          FROM engenharia.setor_cnae_compatibility sc
          LEFT JOIN engenharia.categorias_servico cs ON cs.cnaes @> ARRAY[sc.cnae_codigo]
          WHERE sc.setor_obra = %s ORDER BY sc.peso DESC, cs.ordem ASC NULLS LAST""",
          [setor], domain="engenharia") if setor else []
        seen = set()
        items = []
        for c in compat:
            if c["categoria_id"] in seen:
                continue
            seen.add(c["categoria_id"])
            is_confirmado = c["fonte"] == "contractual" if c.get("fonte") else False
            items.append({
                "id": str(c["categoria_id"]),
                "nome": c["categoria_nome"] or f"Serviço CNAE {c['cnae_codigo']}",
                "descricao": c.get("categoria_descricao") or "",
                "fase": fase or "NÃO INFORMADA",
                "status": "DEMANDA_TÉCNICA_PROVÁVEL",
                "executorIdentificado": None,
                "empresasCompativeis": [],
                "evidence": f"Setor {setor} requer CNAE {c['cnae_codigo']} (peso {c['peso']})" if not is_confirmado else f"Contratação confirmada para setor {setor}",
                "classification": "CONFIRMADO" if is_confirmado else "PROVÁVEL",
            })
        if not items:
            items_default = [
                {"id": "ESTRUTURA", "nome": "Estruturas e Fundações", "descricao": "Serviços de concreto, aço e fundações",
                 "fase": fase or "NÃO INFORMADA", "status": "DEMANDA_TÉCNICA_PROVÁVEL",
                 "executorIdentificado": None, "empresasCompativeis": [],
                 "evidence": f"Demanda técnica provável para obra do setor {setor}" if setor else "Demanda técnica genérica",
                 "classification": "PROVÁVEL"},
                {"id": "INST_ELETRICA", "nome": "Instalações Elétricas", "descricao": "Cabeamento, quadros, iluminação",
                 "fase": fase or "NÃO INFORMADA", "status": "DEMANDA_TÉCNICA_PROVÁVEL",
                 "executorIdentificado": None, "empresasCompativeis": [],
                 "evidence": f"Demanda técnica provável para obra do setor {setor}" if setor else "Demanda técnica genérica",
                 "classification": "PROVÁVEL"},
                {"id": "INST_HIDRAULICA", "nome": "Instalações Hidráulicas", "descricao": "Água, esgoto, drenagem",
                 "fase": fase or "NÃO INFORMADA", "status": "DEMANDA_TÉCNICA_PROVÁVEL",
                 "executorIdentificado": None, "empresasCompativeis": [],
                 "evidence": f"Demanda técnica provável para obra do setor {setor}" if setor else "Demanda técnica genérica",
                 "classification": "PROVÁVEL"},
                {"id": "PAVIMENTACAO", "nome": "Pavimentação e Vias", "descricao": "Asfalto, concreto, pátios",
                 "fase": fase or "NÃO INFORMADA", "status": "DEMANDA_TÉCNICA_PROVÁVEL",
                 "executorIdentificado": None, "empresasCompativeis": [],
                 "evidence": f"Demanda técnica provável para obra do setor {setor}" if setor else "Demanda técnica genérica",
                 "classification": "PROVÁVEL"},
            ]
            items = items_default
        return {"items": items, "total": len(items), "setor": setor, "fase": fase,
                "source": "engenharia.setor_cnae_compatibility + categorias_servico"}

    @staticmethod
    def work_insumos(work_id: str):
        rows, _ = _run("""SELECT mc.id, mc.cnae_insumo_div, mc.setor_insumo_nome, mc.coeficiente_leontief,
          mc.demanda_estimada_mi, mc.fornecedores_na_base, mc.fornecedores_no_uf, mc.com_decisor, mc.gerado_em
          FROM engenharia.matches_cadeia_obra mc WHERE mc.obra_id::text = %s
          ORDER BY mc.demanda_estimada_mi DESC NULLS LAST LIMIT 30""", [work_id])
        items = []
        div_to_categoria = {
            "10": "Alimentos e Bebidas", "13": "Têxtil", "20": "Químicos",
            "23": "Metalurgia", "25": "Produtos de Metal", "26": "Eletrônicos",
            "27": "Máquinas e Equipamentos", "28": "Máquinas e Equipamentos",
            "31": "Móveis", "35": "Energia Elétrica", "36": "Água e Saneamento",
            "41": "Construção Civil", "42": "Construção Civil - Infraestrutura",
            "43": "Construção Civil - Especializada",
            "01": "Agricultura", "02": "Pecuária", "03": "Silvicultura",
            "05": "Mineração", "06": "Petróleo e Gás",
            "45": "Comércio de Veículos", "46": "Comércio Atacadista",
            "47": "Comércio Varejista", "49": "Transporte Terrestre",
            "55": "Alojamento", "56": "Alimentação", "61": "Telecomunicações",
            "62": "Desenvolvimento de Sistemas", "64": "Intermediação Financeira",
            "71": "Arquitetura e Engenharia", "77": "Aluguéis",
            "78": "Seleção e Agenciamento", "80": "Segurança",
            "81": "Serviços para Edificações", "82": "Serviços Administrativos",
            "86": "Saúde", "94": "Associações", "96": "Serviços Pessoais",
        }
        for r in rows:
            div = r.get("cnae_insumo_div", "").strip()
            categoria = div_to_categoria.get(div) or f"CNAE Divisão {div}"
            items.append({
                "id": str(r["id"]),
                "categoria": categoria, "subcategoria": r.get("setor_insumo_nome") or "",
                "unidade": "R$ mil", "quantidade": None,
                "faseNecessidade": "EXECUÇÃO",
                "especificacao": "",
                "fonteDemanda": "Matriz Insumo-Produto (coeficiente Leontief)",
                "confiabilidade": "inferido",
                "workId": work_id,
            })
        return {"items": items, "total": len(items),
                "source": "engenharia.matches_cadeia_obra"}

    @staticmethod
    def work_opportunities(work_id: str):
        return Wave1Repository.opportunities(page=1, page_size=50, work_id=work_id)

    @staticmethod
    def work_supply_chain(work_id: str):
        work_rows, _ = _run("SELECT id::text, nome, setor, fase, municipio, uf FROM engenharia.obras WHERE id::text = %s LIMIT 1", [work_id])
        obra = work_rows[0] if work_rows else None
        if not obra:
            return {"obra": None, "executores": [], "disciplinas": [], "servicos": [],
                    "insumos": [], "fornecedores_insumos": [], "opportunities": [],
                    "relationships": [], "updated_at": None}
        executors = Wave1Repository.work_executors(work_id)
        disciplinas = Wave1Repository.work_disciplinas(work_id)
        opportunities = Wave1Repository.opportunities(page=1, page_size=20, work_id=work_id)
        relationships = []
        for ex in executors.get("items", []):
            relationships.append({
                "obra_id": work_id, "empresa_id": ex["cnpj"],
                "relation_type": "EXECUTOR_COMPATIVEL",
                "classification": ex["classification"],
                "confidence": ex["score"],
                "evidence": ex["evidence"],
                "source": "engenharia.matches_obra_prestador",
                "algorithm_version": "v2.0",
            })
        for d in disciplinas.get("items", []):
            relationships.append({
                "obra_id": work_id, "disciplina_id": d["id"],
                "relation_type": "DEMANDA_DISCIPLINA",
                "classification": d.get("classification", "PROVÁVEL"),
                "confidence": 70 if d.get("classification") == "PROVÁVEL" else 95,
                "evidence": d["evidence"],
                "source": "engenharia.setor_cnae_compatibility",
                "algorithm_version": "v2.0",
            })
        # Fornecedores de insumos ainda não foram mapeados. Apresenta apenas
        # categorias técnicas prováveis derivadas das disciplinas.
        categorias_insumos = []
        for d in disciplinas.get("items", []):
            nome = d.get("nome", "")
            for categoria in _demanda_insumos_por_disciplina(nome):
                categorias_insumos.append({
                    "categoria": categoria,
                    "disciplina": nome,
                    "relation_type": "DEMANDA_INSUMO_PROVAVEL",
                    "classification": "PROVÁVEL",
                    "confidence": 55,
                    "evidence": f"Demanda técnica provável derivada da disciplina {nome}",
                    "source": "engenharia.setor_cnae_compatibility",
                    "algorithm_version": "v2.0",
                })
        return {
            "obra": obra,
            "executores": executors.get("items", []),
            "disciplinas": disciplinas.get("items", []),
            "servicos": [],
            "insumos": [],
            "fornecedores_insumos": [],
            "categorias_insumos": categorias_insumos,
            "opportunities": opportunities.get("items", []),
            "relationships": relationships,
            "updated_at": str(datetime.now(timezone.utc)),
        }

    @staticmethod
    def _get_agro_ref_municipios():
        with _AGRO_CACHE_LOCK:
            now = time.time()
            if _AGRO_REF_MUN_CACHE["data"] is not None and (now - _AGRO_REF_MUN_CACHE["timestamp"]) < 86400:
                return _AGRO_REF_MUN_CACHE["data"]
            rows = _run_db("wins_agro", "SELECT codigo_ibge, nome, upper(nome_normalizado) nome_norm, upper(uf) uf, latitude, longitude FROM referencia.municipio", [], domain="agro")
            by_ibge = {}
            for r in rows:
                if r.get("codigo_ibge"):
                    by_ibge[str(r["codigo_ibge"])] = r
            _AGRO_REF_MUN_CACHE["data"] = by_ibge
            _AGRO_REF_MUN_CACHE["timestamp"] = now
            return by_ibge

    @staticmethod
    def refresh_agro_cache(force=True):
        """Atomic cache rebuild with fallback to previous valid cache on failure."""
        now = time.time()
        iso_now = datetime.fromtimestamp(now, tz=timezone.utc).isoformat()
        try:
            rows = _run_db("wins_agro", """
                SELECT
                  i.codigo_ibge_mun,
                  min(i.municipio) municipio,
                  i.uf,
                  count(*)::int total_imoveis,
                  count(i.area_total_ha) FILTER (WHERE i.area_total_ha IS NOT NULL)::int com_area_declarada,
                  coalesce(sum(i.area_total_ha),0)::float area_total_declarada_ha,
                  coalesce(sum(i.area_pasto_ha),0)::float area_pasto_ha,
                  coalesce(sum(i.area_lavoura_ha),0)::float area_lavoura_ha,
                  coalesce(sum(i.area_vegetacao_nativa_ha),0)::float area_vegetacao_nativa_ha,
                  max(i.coletado_em)::text ultima_atualizacao
                FROM prospeccao.imovel_rural i
                WHERE i.codigo_ibge_mun IS NOT NULL
                GROUP BY i.codigo_ibge_mun, i.uf
            """, [], domain="agro")
            if rows:
                with _AGRO_CACHE_LOCK:
                    _AGRO_MUN_CACHE["data"] = rows
                    _AGRO_MUN_CACHE["timestamp"] = now
                    _AGRO_MUN_CACHE["iso_timestamp"] = iso_now
                return {"status": "ok", "message": "Cache agro recarregado com sucesso", "records": len(rows), "cache_updated_at": iso_now}
            else:
                logger.warning("Query de refresh retornou lista vazia; mantendo cache anterior.")
        except Exception as ex:
            logger.warning(f"Falha na reconstrução do cache agro: {ex}. Mantendo cache anterior como fallback.")
        return {"status": "fallback", "message": "Mantido cache anterior", "cache_updated_at": _AGRO_MUN_CACHE.get("iso_timestamp")}

    @staticmethod
    def _get_agro_mun_summary():
        with _AGRO_CACHE_LOCK:
            now = time.time()
            if _AGRO_MUN_CACHE["data"] is not None and (now - _AGRO_MUN_CACHE["timestamp"]) < 3600:
                return _AGRO_MUN_CACHE["data"]
        Wave1Repository.refresh_agro_cache(force=False)
        with _AGRO_CACHE_LOCK:
            return _AGRO_MUN_CACHE.get("data") or []

    @staticmethod
    def agro_kpis(uf=None, bioma=None, municipio=None):
        summary = Wave1Repository._get_agro_mun_summary()
        uf_upper = uf.upper() if uf else None
        mun_lower = municipio.lower() if municipio else None

        filtered = summary
        if uf_upper:
            filtered = [r for r in filtered if r.get("uf") == uf_upper]
        if mun_lower:
            filtered = [r for r in filtered if r.get("municipio") and mun_lower in r["municipio"].lower()]

        total_imoveis = sum(r["total_imoveis"] for r in filtered)
        codigos_car = total_imoveis
        area_total = sum(r["area_total_declarada_ha"] for r in filtered)
        area_pasto = sum(r["area_pasto_ha"] for r in filtered)
        area_lavoura = sum(r["area_lavoura_ha"] for r in filtered)
        area_veg = sum(r["area_vegetacao_nativa_ha"] for r in filtered)
        last_update = max((r["ultima_atualizacao"] for r in filtered if r.get("ultima_atualizacao")), default=None)

        # Global metrics cached or computed
        total_cnpjs = 67362
        total_municipios_ibge = 5570
        total_ufs = len(set(r["uf"] for r in summary if r.get("uf")))
        mun_car_count = len(set(r["codigo_ibge_mun"] for r in filtered if r.get("codigo_ibge_mun")))
        cache_ts = _AGRO_MUN_CACHE.get("iso_timestamp") or datetime.now(timezone.utc).isoformat()

        try:
            cnpj_rows = _run_db("wins_agro", "SELECT count(*)::int total FROM prospeccao.holding_lead_ui", [], domain="agro")
            total_cnpjs = cnpj_rows[0]["total"] if cnpj_rows else 0
        except Exception:
            logger.warning("Falha ao contar CNPJs de holding_lead_ui; mantendo fallback.")
        try:
            mun_rows = _run_db("wins_agro", "SELECT count(*)::int total FROM referencia.municipio", [], domain="agro")
            total_municipios_ibge = mun_rows[0]["total"] if mun_rows else total_municipios_ibge
        except Exception:
            logger.warning("Falha ao contar municipios de referencia.municipio; mantendo fallback.")

        return {
            "total_imoveis_car": total_imoveis,
            "codigos_car_unicos": codigos_car,
            "geometrias_validas": 0,
            "area_declarada_ha": float(area_total),
            "area_pasto_ha": float(area_pasto),
            "area_lavoura_ha": float(area_lavoura),
            "area_vegetacao_nativa_ha": float(area_veg),
            "municipios_com_registro_car": mun_car_count,
            "municipios_ibge_total": total_municipios_ibge,
            "ufs_presentes": total_ufs,
            "pessoas_juridicas_relacionadas": total_cnpjs,
            "ultima_atualizacao": last_update,
            "cache_updated_at": cache_ts,
            "metodologia": {
                "area_declarada": "Soma da coluna area_total_ha declarada pelo proprietário no SICAR/CAR. Não inclui área geométrica calculada sobre polígonos nem área dissolvida sem sobreposição. 99,7% dos registros possuem área > 0; mediana de 10,5 ha.",
                "geometrias_validas": "Indisponível - imovel_rural não possui coluna de geometria para validação geoespacial. A área declarada (area_total_ha) é o único indicador disponível.",
                "municipios": f"{mun_car_count} de {total_municipios_ibge} municípios brasileiros com ao menos um imóvel registrado no CAR (fonte: codigo_ibge_mun distinto em prospeccao.imovel_rural vs referencia.municipio). 8 municípios sem qualquer registro CAR.",
                "imoveis_car": f"{total_imoveis} CARs únicos — cada linha em prospeccao.imovel_rural equivale a 1 código CAR distinto, sem duplicatas (coluna codigo_car: UNIQUE, 0 NULLs, 0 duplicatas).",
                "pessoas_juridicas": f"{total_cnpjs} CNPJs de holdings, investidores e imobiliárias com sócio em comum com empresas rurais/agro (fontes: RFB via CNAE + sócios em comum). Principais CNAEs: 6462-0/00 (participações societárias), 6810-2/01 (compra/venda imóveis), 6810-2/02 (aluguel imóveis)."
            },
            "fontes": ["SICAR/CAR via prospeccao.imovel_rural", "RFB via prospeccao.holding_lead_ui", "IBGE via referencia.municipio"],
            "classificacao": "Dados declaratórios CAR (SICAR) e derivados RFB (CNAEs/sócios), sem validação geoespacial",
            "filtros_aplicados": {"uf": uf, "municipio": municipio}
        }

    @staticmethod
    def agro_distribuicao(tipo="bioma", uf=None, municipio=None):
        summary = Wave1Repository._get_agro_mun_summary()
        uf_upper = uf.upper() if uf else None
        mun_lower = municipio.lower() if municipio else None

        filtered = summary
        if uf_upper:
            filtered = [r for r in filtered if r.get("uf") == uf_upper]
        if mun_lower:
            filtered = [r for r in filtered if r.get("municipio") and mun_lower in r["municipio"].lower()]

        if tipo == "uso_solo":
            pasto = sum(r["area_pasto_ha"] for r in filtered)
            lavoura = sum(r["area_lavoura_ha"] for r in filtered)
            veg = sum(r["area_vegetacao_nativa_ha"] for r in filtered)
            classified_total = float(pasto + lavoura + veg)
            declared_total = float(sum(r["area_total_declarada_ha"] for r in filtered))
            unclassified = float(max(0, declared_total - classified_total))
            def pct(val): return round(float(val) * 100 / declared_total, 1) if declared_total > 0 else 0
            return {
                "tipo": "uso_do_solo",
                "categorias": [
                    {"classe": "Pastagem", "area_ha": float(pasto), "percentual": pct(pasto), "fonte": "SICAR/CAR (area_pasto_ha)"},
                    {"classe": "Agricultura", "area_ha": float(lavoura), "percentual": pct(lavoura), "fonte": "SICAR/CAR (area_lavoura_ha)"},
                    {"classe": "Vegetação Nativa", "area_ha": float(veg), "percentual": pct(veg), "fonte": "SICAR/CAR (area_vegetacao_nativa_ha)"},
                    {"classe": "Não Classificado", "area_ha": unclassified, "percentual": pct(unclassified), "fonte": "Diferença entre área total declarada e soma das classes"}
                ],
                "area_total_analisada_ha": declared_total,
                "nota": f"Uso do solo declarado no CAR pelo proprietário. Denominador de {declared_total:,.0f} ha.",
                "filtros": {"uf": uf, "municipio": municipio}
            }

        bioma_por_uf = {
            "AC":"Amazônia","AL":"Mata Atlântica","AP":"Amazônia","AM":"Amazônia",
            "BA":"Caatinga","CE":"Caatinga","DF":"Cerrado","ES":"Mata Atlântica",
            "GO":"Cerrado","MA":"Cerrado","MT":"Cerrado","MS":"Cerrado",
            "MG":"Cerrado","PA":"Amazônia","PB":"Caatinga","PR":"Mata Atlântica",
            "PE":"Caatinga","PI":"Caatinga","RJ":"Mata Atlântica","RN":"Caatinga",
            "RS":"Pampa","RO":"Amazônia","RR":"Amazônia","SC":"Mata Atlântica",
            "SP":"Mata Atlântica","SE":"Mata Atlântica","TO":"Cerrado"
        }
        biomas = {}
        for r in filtered:
            b = bioma_por_uf.get(r["uf"], "Não Classificado")
            if b not in biomas:
                biomas[b] = {"imoveis": 0, "area_ha": 0.0}
            biomas[b]["imoveis"] += int(r["total_imoveis"])
            biomas[b]["area_ha"] += float(r["area_total_declarada_ha"])
        total_imoveis = sum(v["imoveis"] for v in biomas.values())
        total_area = sum(v["area_ha"] for v in biomas.values())
        categorias = []
        ordem = ["Amazônia","Cerrado","Mata Atlântica","Caatinga","Pampa","Pantanal","Não Classificado"]
        for b in ordem:
            if b in biomas:
                v = biomas[b]
                categorias.append({
                    "bioma": b, "imoveis": v["imoveis"], "percentual_imoveis": round(v["imoveis"]*100/total_imoveis,1) if total_imoveis else 0,
                    "area_ha": v["area_ha"], "percentual_area": round(v["area_ha"]*100/total_area,1) if total_area else 0,
                    "fonte": "Classificação UF→Bioma IBGE"
                })
            else:
                categorias.append({"bioma": b, "imoveis": 0, "percentual_imoveis": 0, "area_ha": 0, "percentual_area": 0, "fonte": "Sem registros no recorte"})
        return {
            "tipo": "bioma",
            "categorias": categorias,
            "total_imoveis": total_imoveis,
            "area_total_ha": total_area,
            "nota": "Bioma inferido pela UF do cadastro (mapeamento IBGE UF→bioma dominante).",
            "biomas_ausentes": [b for b in ["Pantanal","Caatinga"] if b not in biomas or biomas[b]["imoveis"]==0],
            "filtros": {"uf": uf, "municipio": municipio}
        }

    @staticmethod
    def agro_mapa(min_lat=-35.5, max_lat=6.5, min_lng=-75.5, max_lng=-32, zoom=4, uf=None, bioma=None, uso_solo=None):
        summary = Wave1Repository._get_agro_mun_summary()
        ref_muns = Wave1Repository._get_agro_ref_municipios()
        grid = 5.0 if zoom <= 4 else 2.0 if zoom <= 6 else 0.5 if zoom <= 8 else 0.05
        uf_upper = uf.upper() if uf else None

        cluster_map = {}
        total_no_recorte = 0

        for r in summary:
            ibge_code = str(r["codigo_ibge_mun"])
            ref = ref_muns.get(ibge_code)
            if not ref:
                continue
            lat = float(ref["latitude"])
            lng = float(ref["longitude"])

            if uf_upper and r.get("uf") != uf_upper:
                continue
            if not (min_lat <= lat <= max_lat and min_lng <= lng <= max_lng):
                continue

            total_no_recorte += r["total_imoveis"]

            grid_lat = round(lat / grid) * grid
            grid_lng = round(lng / grid) * grid
            key = (grid_lat, grid_lng)

            if key not in cluster_map:
                cluster_map[key] = {
                    "lat": grid_lat,
                    "lng": grid_lng,
                    "quantidade": 0,
                    "municipios": set(),
                    "sample_mun": r["municipio"],
                    "uf": r["uf"],
                    "area_ha": 0.0
                }
            c = cluster_map[key]
            c["quantidade"] += r["total_imoveis"]
            c["municipios"].add(r["codigo_ibge_mun"])
            c["area_ha"] += r["area_total_declarada_ha"]

        clusters = []
        for (lat, lng), data in sorted(cluster_map.items(), key=lambda x: x[1]["quantidade"], reverse=True)[:200]:
            clusters.append({
                "lat": data["lat"],
                "lng": data["lng"],
                "quantidade": data["quantidade"],
                "municipios": len(data["municipios"]),
                "municipio": data["sample_mun"],
                "uf": data["uf"],
                "area_ha": round(data["area_ha"], 2)
            })

        return {
            "clusters": clusters,
            "total_no_recorte": total_no_recorte,
            "exibidos": len(clusters),
            "zoom": zoom,
            "grid_degrees": grid,
            "bbox": {"min_lat": min_lat, "max_lat": max_lat, "min_lng": min_lng, "max_lng": max_lng},
            "strategy": "server_grid_cluster",
            "nota": f"{len(clusters)} clusters de {total_no_recorte} cadastros CAR agregados por grade de {grid}° sobre coordenadas municipais (referencia.municipio.latitude/longitude).",
            "sem_geometria": True,
            "fontes": ["SICAR/CAR via prospeccao.imovel_rural", "IBGE via referencia.municipio"],
            "ultima_atualizacao": max((r.get("ultima_atualizacao") for r in summary if r.get("ultima_atualizacao")), default=None),
            "referencia_geografica": "Coordenadas municipais de referência IBGE; não representam a geometria dos imóveis.",
            "filtros": {"uf": uf}
        }

    @staticmethod
    def agro_oportunidades(imovel_id=None):
        rows = _run_db("wins_agro", """
            SELECT e.relationship_id id, e.source_id, e.target_id, e.tipo_relacao titulo,
                   e.evidencia descricao, e.tipo_fonte vertical_origem,
                   e.classificacao, e.score, e.versao_regra, e.calculado_em::text,
                   e.limitacoes
            FROM public.relationship_edges e
            WHERE (e.source_id LIKE 'prop_%%' OR e.target_id LIKE 'prop_%%')
              AND e.classificacao IN ('CONFIRMADO','PROVÁVEL')
            ORDER BY e.score DESC NULLS LAST
            LIMIT 20
        """, domain="agro")
        if not rows:
            return {"oportunidades": [], "total": 0, "message": "Oportunidades ainda não calculadas para este recorte."}
        return {
            "oportunidades": rows,
            "total": len(rows),
            "fonte": "public.relationship_edges",
            "message": None
        }

    @staticmethod
    def agro_relacoes(imovel_id=None, cnpj=None):
        # Fail-closed: no dashboard Agro, relações só podem envolver entidades
        # Agro (prefixo prop_ de propriedade rural ou CNPJ agro). Sem recorte,
        # NÃO se devolvem relações globais de outras verticais (ex.: Engenharia
        # Obra -> Decisor), evitando vazamento cross-domain no dashboard.
        clauses = []
        params = []
        if imovel_id:
            clauses.append("(e.source_id = %s OR e.target_id = %s)")
            params += [f"prop_{imovel_id}", f"prop_{imovel_id}"]
        if cnpj:
            cleaned = _clean_cnpj(cnpj) or cnpj
            clauses.append("(e.source_id LIKE %s OR e.target_id LIKE %s)")
            params += [f"%{cleaned}%", f"%{cleaned}%"]
        if not clauses:
            return {
                "relacoes": [],
                "total": 0,
                "message": "Nenhuma relação cross-domain Agro materializada no recorte atual. Relações de outras verticais não são exibidas no módulo Agro.",
                "nota": "Recorte Agro necessário (imovel_id ou cnpj) para listar relações."
            }
        clause = " AND ".join(clauses)
        rows = _run_db("wins_agro", f"""
            SELECT e.relationship_id, e.source_id, e.target_id, e.source_type,
                   e.target_type, e.tipo_relacao, e.classificacao, e.score,
                   e.fonte, e.tipo_fonte, e.evidencia, e.versao_regra,
                   e.calculado_em::text, e.verificado_em::text, e.limitacoes,
                   e.status_revisao
            FROM public.relationship_edges e
            WHERE {clause}
            ORDER BY e.score DESC NULLS LAST, e.calculado_em DESC NULLS LAST
            LIMIT 50
        """, params, domain="agro")
        if not rows:
            return {"relacoes": [], "total": 0, "message": "Nenhuma relação cross-domain encontrada para este recorte."}
        classifications = {}
        for r in rows:
            c = r["classificacao"]
            classifications[c] = classifications.get(c, 0) + 1
        return {
            "relacoes": rows,
            "total": len(rows),
            "sumario_classificacao": classifications,
            "fonte": "public.relationship_edges",
            "nota": "Relações materializadas por regras de vínculo documental, cadastral e territorial."
        }

    @staticmethod
    def agro_imoveis_catalog(page=1, page_size=25, q=None, uf=None, municipio=None,
                             area_min=None, area_max=None, com_titular=None, com_cnpj=None,
                             com_bioma=None, com_uso_solo=None, cobertura_veterinaria=None,
                             completude_min=None, sort="relevancia", order="desc"):
        size = page_size if page_size in (25, 50, 100) else 25
        safe_page = max(1, min(int(page), 1000))
        offset = (safe_page - 1) * size
        bioma = """CASE i.uf WHEN 'AC' THEN 'Amazônia' WHEN 'AP' THEN 'Amazônia' WHEN 'AM' THEN 'Amazônia'
          WHEN 'PA' THEN 'Amazônia' WHEN 'RO' THEN 'Amazônia' WHEN 'RR' THEN 'Amazônia'
          WHEN 'AL' THEN 'Mata Atlântica' WHEN 'ES' THEN 'Mata Atlântica' WHEN 'PR' THEN 'Mata Atlântica'
          WHEN 'RJ' THEN 'Mata Atlântica' WHEN 'SC' THEN 'Mata Atlântica' WHEN 'SP' THEN 'Mata Atlântica'
          WHEN 'BA' THEN 'Caatinga' WHEN 'CE' THEN 'Caatinga' WHEN 'PB' THEN 'Caatinga'
          WHEN 'PE' THEN 'Caatinga' WHEN 'PI' THEN 'Caatinga' WHEN 'RN' THEN 'Caatinga' WHEN 'SE' THEN 'Caatinga'
          WHEN 'DF' THEN 'Cerrado' WHEN 'GO' THEN 'Cerrado' WHEN 'MA' THEN 'Cerrado'
          WHEN 'MT' THEN 'Cerrado' WHEN 'MS' THEN 'Cerrado' WHEN 'MG' THEN 'Cerrado' WHEN 'TO' THEN 'Cerrado'
          WHEN 'RS' THEN 'Pampa' END"""
        cnpj = "(regexp_replace(COALESCE(i.cpf_cnpj,''),'\\D','','g') ~ '^[0-9]{14}$')"
        titular = "(NULLIF(btrim(i.nome_proprietario),'') IS NOT NULL)"
        uso = "(i.area_pasto_ha IS NOT NULL OR i.area_lavoura_ha IS NOT NULL OR i.area_vegetacao_nativa_ha IS NOT NULL)"
        score = f"""((i.codigo_car IS NOT NULL AND btrim(i.codigo_car)<>'')::int*20
          + (i.municipio IS NOT NULL AND i.uf IS NOT NULL)::int*15
          + (i.area_total_ha IS NOT NULL AND i.area_total_ha>0)::int*15
          + {titular}::int*15 + {cnpj}::int*15 + ({bioma} IS NOT NULL)::int*10 + {uso}::int*10)"""
        base = f"""SELECT i.id::text detail_id, i.codigo_car, i.municipio, i.uf,
          i.codigo_ibge_mun codigo_ibge, i.area_total_ha::float area_ha,
          NULLIF(btrim(i.nome_proprietario),'') titular_nome, {titular} tem_titular,
          {cnpj} tem_cnpj, CASE WHEN {cnpj} THEN regexp_replace(i.cpf_cnpj,'\\D','','g') END cnpj_vinculado,
          {bioma} bioma, i.area_pasto_ha::float area_pasto_ha,
          i.area_lavoura_ha::float area_lavoura_ha, i.area_vegetacao_nativa_ha::float area_vegetacao_nativa_ha,
          {uso} tem_uso_solo, {score} completude_score,
          i.fonte_principal, i.coletado_em::text data_atualizacao
          FROM prospeccao.imovel_rural i"""
        where, params = ["i.fonte_principal='SICAR'"], []
        if q:
            where.append("(i.codigo_car ILIKE %s OR i.nome_imovel ILIKE %s OR i.municipio ILIKE %s OR i.nome_proprietario ILIKE %s)")
            params.extend([f"%{q}%"] * 4)
        if uf: where.append("i.uf=%s"); params.append(uf.upper())
        if municipio: where.append("i.municipio ILIKE %s"); params.append(municipio)
        if area_min is not None: where.append("i.area_total_ha >= %s"); params.append(area_min)
        if area_max is not None: where.append("i.area_total_ha <= %s"); params.append(area_max)
        for value, expression in ((com_titular,titular),(com_cnpj,cnpj),(com_bioma,f"({bioma} IS NOT NULL)"),(com_uso_solo,uso)):
            if value is not None: where.append(expression if value else f"NOT {expression}")
        if cobertura_veterinaria:
            coverage_rows = _run_db("wins_agro", """SELECT codigo_ibge::text codigo_ibge
              FROM prospeccao.v_white_space_pecuaria
              WHERE replace(classificacao_vet,' ','_')=%s""", [cobertura_veterinaria], domain="agro")
            coverage_codes = [r["codigo_ibge"] for r in coverage_rows]
            if cobertura_veterinaria == "INDISPONIVEL":
                all_rows = _run_db("wins_agro", "SELECT codigo_ibge::text codigo_ibge FROM prospeccao.v_white_space_pecuaria", [], domain="agro")
                where.append("NOT (i.codigo_ibge_mun::text=ANY(%s::text[]))"); params.append([r["codigo_ibge"] for r in all_rows])
            elif coverage_codes:
                where.append("i.codigo_ibge_mun::text=ANY(%s::text[])"); params.append(coverage_codes)
            else:
                where.append("FALSE")
        if completude_min is not None: where.append(f"{score} >= %s"); params.append(completude_min)
        clause = " AND ".join(where)
        sort_map = {"area":"area_ha", "municipio":"municipio", "uf":"uf",
                    "completude":"completude_score", "codigo_car":"codigo_car"}
        if sort == "relevancia":
            ordering = "completude_score DESC, area_ha DESC NULLS LAST, codigo_car ASC"
        else:
            col = sort_map.get(sort, "completude_score")
            direction = "ASC" if str(order).lower() == "asc" else "DESC"
            ordering = f"{col} {direction} NULLS LAST, codigo_car ASC"
        try:
            count_rows = _run_db("wins_agro", f"SELECT count(*)::int total FROM ({base} WHERE {clause}) c", params, domain="agro")
            total = int(count_rows[0]["total"] if count_rows else 0)
            rows = _run_db("wins_agro", f"""SELECT c.*,
                COALESCE(replace(w.classificacao_vet,' ','_'),'INDISPONIVEL') cobertura_veterinaria,
                w.bovinos::bigint bovinos_municipio, w.tecnicos_75km::int
              FROM (SELECT * FROM ({base} WHERE {clause}) c0 ORDER BY {ordering} LIMIT %s OFFSET %s) c
              LEFT JOIN prospeccao.v_white_space_pecuaria w ON w.codigo_ibge::text=c.codigo_ibge::text
              ORDER BY {ordering}""", params + [size, offset], domain="agro")
            items = [Wave1Repository._agro_catalog_item(row) for row in rows]
            pages = (total + size - 1) // size if total else 0
            limitations = ["Paginação operacional limitada às primeiras 1.000 páginas; use filtros para recortes mais profundos."]
            return {"items":items,"total":total,"page":safe_page,"page_size":size,"total_pages":pages,
                    "has_previous":safe_page>1,"has_next":safe_page<pages and safe_page<1000,
                    "sort":sort,"order":order,"status":"ok",
                    "sources":["SICAR/CAR — prospeccao.imovel_rural","IBGE — referencia municipal","prospeccao.v_white_space_pecuaria"],
                    "limitations":limitations}
        except Exception as exc:
            logger.error("Falha no catálogo de propriedades: %s", exc)
            return {"items":[],"total":0,"page":safe_page,"page_size":size,"total_pages":0,
                    "has_previous":False,"has_next":False,"sort":sort,"order":order,"status":"partial",
                    "sources":["SICAR/CAR — prospeccao.imovel_rural"],
                    "limitations":["Não foi possível carregar o catálogo de propriedades."]}

    @staticmethod
    def _agro_catalog_item(r):
        uso = None
        if r.get("tem_uso_solo"):
            uso = {"pastagem_ha":r.get("area_pasto_ha"),"agricultura_ha":r.get("area_lavoura_ha"),
                   "vegetacao_nativa_ha":r.get("area_vegetacao_nativa_ha")}
        score = int(r.get("completude_score") or 0)
        flags = {"car":bool(r.get("codigo_car")),"localizacao":bool(r.get("municipio") and r.get("uf")),
                 "area":r.get("area_ha") is not None and r.get("area_ha")>0,"titular":bool(r.get("tem_titular")),
                 "cnpj":bool(r.get("tem_cnpj")),"bioma":bool(r.get("bioma")),"uso_solo":bool(r.get("tem_uso_solo"))}
        return {"detail_id":r["detail_id"],"detail_available":True,"codigo_car":r.get("codigo_car"),
                "codigo_car_exibicao":r.get("codigo_car"),"municipio":r.get("municipio"),"uf":r.get("uf"),
                "codigo_ibge":r.get("codigo_ibge"),"area_ha":r.get("area_ha"),
                "titular_nome":r.get("titular_nome"),"titular_status":"DISPONIVEL_NA_FONTE" if r.get("tem_titular") else "NAO_DISPONIBILIZADO",
                "documento_status":"CNPJ_COMPROVADO" if r.get("tem_cnpj") else "NAO_EXPOSTO_OU_NAO_COMPROVADO",
                "cnpj_vinculado":r.get("cnpj_vinculado"),"cnpj_evidencia":"Vínculo declarado no cadastro SICAR/CAR" if r.get("tem_cnpj") else None,
                "bioma":r.get("bioma"),"bioma_origem":"INFERIDO_PELA_UF" if r.get("bioma") else "INDISPONIVEL",
                "uso_solo":uso,"uso_solo_origem":"DECLARADO_NO_CADASTRO_CAR" if uso else "INDISPONIVEL",
                "cobertura_veterinaria":r.get("cobertura_veterinaria") or "INDISPONIVEL",
                "bovinos_municipio":r.get("bovinos_municipio"),"tecnicos_75km":r.get("tecnicos_75km"),
                "completude_score":score,"completude_flags":flags,
                "sources":[r.get("fonte_principal") or "SICAR/CAR","Classificação municipal de cobertura veterinária"],
                "limitations":["Cadastro declaratório; não comprova titularidade, domínio ou limites fundiários.",
                  "Cobertura veterinária municipal; não representa vínculo ou proximidade de técnico com este cadastro."]}

    @staticmethod
    def agro_imovel_360_detail(id: str):
        rows = _run_db("wins_agro", r"""
            SELECT i.id::text detail_id, i.codigo_car, i.municipio, i.uf, i.codigo_ibge_mun codigo_ibge,
                   i.area_total_ha::float area_ha, i.area_pasto_ha::float, i.area_lavoura_ha::float,
                   i.area_vegetacao_nativa_ha::float, NULLIF(btrim(i.nome_proprietario),'') titular_nome,
                   (NULLIF(btrim(i.nome_proprietario),'') IS NOT NULL) tem_titular,
                   (regexp_replace(COALESCE(i.cpf_cnpj,''),'\D','','g') ~ '^[0-9]{14}$') tem_cnpj,
                   CASE WHEN regexp_replace(COALESCE(i.cpf_cnpj,''),'\D','','g') ~ '^[0-9]{14}$'
                        THEN regexp_replace(i.cpf_cnpj,'\D','','g') END cnpj_vinculado,
                   CASE i.uf WHEN 'AC' THEN 'Amazônia' WHEN 'AP' THEN 'Amazônia' WHEN 'AM' THEN 'Amazônia'
                     WHEN 'PA' THEN 'Amazônia' WHEN 'RO' THEN 'Amazônia' WHEN 'RR' THEN 'Amazônia'
                     WHEN 'AL' THEN 'Mata Atlântica' WHEN 'ES' THEN 'Mata Atlântica' WHEN 'PR' THEN 'Mata Atlântica'
                     WHEN 'RJ' THEN 'Mata Atlântica' WHEN 'SC' THEN 'Mata Atlântica' WHEN 'SP' THEN 'Mata Atlântica'
                     WHEN 'BA' THEN 'Caatinga' WHEN 'CE' THEN 'Caatinga' WHEN 'PB' THEN 'Caatinga'
                     WHEN 'PE' THEN 'Caatinga' WHEN 'PI' THEN 'Caatinga' WHEN 'RN' THEN 'Caatinga' WHEN 'SE' THEN 'Caatinga'
                     WHEN 'DF' THEN 'Cerrado' WHEN 'GO' THEN 'Cerrado' WHEN 'MA' THEN 'Cerrado'
                     WHEN 'MT' THEN 'Cerrado' WHEN 'MS' THEN 'Cerrado' WHEN 'MG' THEN 'Cerrado' WHEN 'TO' THEN 'Cerrado'
                     WHEN 'RS' THEN 'Pampa' END bioma,
                   (i.area_pasto_ha IS NOT NULL OR i.area_lavoura_ha IS NOT NULL OR i.area_vegetacao_nativa_ha IS NOT NULL) tem_uso_solo,
                   COALESCE(replace(w.classificacao_vet,' ','_'),'INDISPONIVEL') cobertura_veterinaria,
                   w.bovinos::bigint bovinos_municipio, w.tecnicos_75km::int,
                   i.fonte_principal, i.coletado_em::text data_atualizacao
            FROM prospeccao.imovel_rural i
            LEFT JOIN prospeccao.v_white_space_pecuaria w ON w.codigo_ibge::text=i.codigo_ibge_mun::text
            WHERE i.id::text = %s
            LIMIT 1
        """, [str(id)], domain="agro")
        if not rows:
            return None
        row = rows[0]
        row["completude_score"] = (20 if row.get("codigo_car") else 0)+(15 if row.get("municipio") and row.get("uf") else 0)+(15 if row.get("area_ha") and row["area_ha"]>0 else 0)+(15 if row.get("tem_titular") else 0)+(15 if row.get("tem_cnpj") else 0)+(10 if row.get("bioma") else 0)+(10 if row.get("tem_uso_solo") else 0)
        prop = Wave1Repository._agro_catalog_item(row)
        return {"status":"partial","property":prop,"company":None,"owner":None,
                "technical_coverage":{"classification":prop["cobertura_veterinaria"],
                  "bovinos_municipio":prop["bovinos_municipio"],"tecnicos_75km":prop["tecnicos_75km"],
                  "scope":"MUNICIPAL","specific_technician":None},
                "limitations":prop["limitations"]}

    @staticmethod
    def agro_decisores(page=1, page_size=25, search=None, uf=None):
        offset = (page - 1) * page_size
        rows = _run_db("wins_agro", """
            SELECT d.cnpj14, d.razao, d.nome_fantasia, d.uf, d.municipio,
                   d.n_socios_agro, d.nome_socio_comum, d.email, d.whatsapp, d.score
            FROM prospeccao.holding_lead_ui d
            WHERE (%s IS NULL OR d.razao ILIKE %s OR d.nome_socio_comum ILIKE %s OR d.municipio ILIKE %s)
              AND (%s IS NULL OR d.uf = %s)
            ORDER BY d.score DESC NULLS LAST, d.n_socios_agro DESC
            LIMIT %s OFFSET %s
        """, [search, f"%{search}%" if search else None, f"%{search}%" if search else None, f"%{search}%" if search else None, uf, uf.upper() if uf else None, page_size, offset], domain="agro")

        count_rows = _run_db("wins_agro", """
            SELECT count(*)::int total FROM prospeccao.holding_lead_ui d
            WHERE (%s IS NULL OR d.razao ILIKE %s OR d.nome_socio_comum ILIKE %s OR d.municipio ILIKE %s)
              AND (%s IS NULL OR d.uf = %s)
        """, [search, f"%{search}%" if search else None, f"%{search}%" if search else None, f"%{search}%" if search else None, uf, uf.upper() if uf else None], domain="agro")
        total = count_rows[0]["total"] if count_rows else 0

        decisores_list = []
        for r in rows:
            decisores_list.append({
                "source_id": r["cnpj14"],
                "nome": r.get("nome_socio_comum") or r["razao"],
                "cargo": "Sócio (QSA RFB)" if r.get("n_socios_agro") else "Sem cargo comprovado",
                "empresa_vinculada": r["razao"],
                "cnpj": r["cnpj14"],
                "municipio": r["municipio"],
                "uf": r["uf"],
                "confianca": "VÍNCULO_QSA" if r.get("nome_socio_comum") else "VÍNCULO_EMPRESARIAL",
                "email": r.get("email"),
                "whatsapp": r.get("whatsapp"),
                "score": r.get("score") or 90,
                "fonte": "RFB/QSA"
            })
        return {
            "items": decisores_list,
            "meta": {"page": page, "page_size": page_size, "total": total},
            "fonte": "prospeccao.holding_lead_ui (QSA RFB)"
        }

    @staticmethod
    def agro_holdings(page=1, page_size=25, search=None, uf=None):
        offset = (page - 1) * page_size
        rows = _run_db("wins_agro", """
            SELECT h.cnpj14, h.razao, h.nome_fantasia, h.uf, h.municipio,
                   h.cnae_principal, h.capital_social, h.email, h.whatsapp,
                   h.n_socios_agro, h.nome_socio_comum, h.score
            FROM prospeccao.holding_lead_ui h
            WHERE (%s IS NULL OR h.razao ILIKE %s OR h.cnpj14 ILIKE %s OR h.municipio ILIKE %s)
              AND (%s IS NULL OR h.uf = %s)
            ORDER BY h.score DESC NULLS LAST
            LIMIT %s OFFSET %s
        """, [search, f"%{search}%" if search else None, f"%{search}%" if search else None, f"%{search}%" if search else None, uf, uf.upper() if uf else None, page_size, offset], domain="agro")
        count_rows = _run_db("wins_agro", """
            SELECT count(*)::int total FROM prospeccao.holding_lead_ui h
            WHERE (%s IS NULL OR h.razao ILIKE %s OR h.cnpj14 ILIKE %s OR h.municipio ILIKE %s)
              AND (%s IS NULL OR h.uf = %s)
        """, [search, f"%{search}%" if search else None, f"%{search}%" if search else None, f"%{search}%" if search else None, uf, uf.upper() if uf else None], domain="agro")
        total = count_rows[0]["total"] if count_rows else 0
        return {
            "items": rows,
            "meta": {"page": page, "page_size": page_size, "total": total},
            "fonte": "prospeccao.holding_lead_ui"
        }

    @staticmethod
    def agro_oportunidades_calculadas(categoria=None, min_score=70, uf=None):
        # Motor de oportunidades em validação. O conjunto anterior (opp_agro_001..005)
        # era ilustrativo, não persistido em banco, e foi desativado. Nenhuma
        # oportunidade é gerada até que haja evidência real persistida (contrato
        # REQUIRED_REAL_OPPORTUNITY_FIELDS no frontend é fail-closed).
        return {
            "oportunidades": [],
            "total": 0,
            "categorias_disponiveis": [],
            "fonte": "Motor de Inferência Comercial WiNS Agro",
            "status": "validation",
            "message": "Motor de oportunidades em validação. Nenhuma oportunidade é exibida até haver evidência real persistida.",
            "limitacoes": "O conjunto anterior continha dados ilustrativos não persistidos e foi desativado."
        }

    @staticmethod
    def agro_logistica_correlacao(uf=None, municipio=None):
        return Wave1Repository.agro_logistica_resumo(uf=uf, municipio=municipio)

    @staticmethod
    def agro_logistica_resumo(uf=None, municipio=None):
        filters, params = [], []
        if uf:
            filters.append("t.uf = %s")
            params.append(uf.upper())
        if municipio:
            filters.append("t.municipio ILIKE %s")
            params.append(f"%{municipio}%")
        clause = " AND ".join(filters) or "TRUE"
        try:
            row = _run_agro_logistics(f"""
                SELECT count(*)::int AS total,
                       count(DISTINCT t.uf)::int AS represented_ufs,
                       count(DISTINCT (t.uf, upper(trim(t.municipio))))::int AS represented_municipalities,
                       count(*) FILTER (WHERE nullif(trim(t.numero_rntrc), '') IS NOT NULL)::int AS with_rntrc,
                       count(*) FILTER (WHERE t.latitude IS NOT NULL AND t.longitude IS NOT NULL)::int AS geocoded,
                       count(*) FILTER (WHERE nullif(trim(t.fonte_contato), '') IS NOT NULL)::int AS with_institutional_contact,
                       max(t.atualizado_em) AS updated_at
                FROM log.transportadora t WHERE {clause}
            """, params)[0]
            operational = _run_agro_logistics("""
                SELECT count(*)::int AS total,
                       count(*) FILTER (WHERE distancia_km IS NOT NULL)::int AS with_distance,
                       max(updated_at) AS updated_at
                FROM log.match
            """)[0]
            latest = max(filter(None, (row["updated_at"], operational["updated_at"])), default=None)
            return {
                "status": "PARTIAL",
                "coverage_scope": {
                    "status": "PARTIAL",
                    "description": f"Camada enriquecida com cobertura parcial de {row['represented_ufs']} UFs.",
                    "represented_ufs": row["represented_ufs"],
                    "represented_municipalities": row["represented_municipalities"],
                },
                "transporters": {
                    "available": True, "total": row["total"], "with_rntrc": row["with_rntrc"],
                    "geocoded": row["geocoded"], "with_institutional_contact": row["with_institutional_contact"],
                },
                "operational_records": {
                    "available": True, "total": operational["total"],
                    "with_distance": operational["with_distance"],
                    "semantic_label": "registros logísticos previamente calculados",
                },
                "national_rntrc": {
                    "available_in_canonical_contract": False,
                    "status": "PENDING_CANONICAL_PROMOTION",
                    "known_source_total": None,
                },
                "storage": {"available": False, "status": "UNAVAILABLE", "reason": "CONAB_SOURCE_NOT_INTEGRATED"},
                "updated_at": latest,
                "sources": ["log.transportadora", "log.match", "SICAR/CAR", "IBGE", "IBGE PPM"],
                "limitations": [
                    "Cobertura conhecida na camada disponível; ausência de registro não comprova ausência de operador.",
                    "Os registros logísticos são cálculos históricos e não representam cargas, contratos, viagens, veículos ou capacidade disponível.",
                    "O total nacional RNTRC não é exposto até ser promovido a um contrato canônico consultável.",
                    "CONAB, armazéns, capacidade estática, terminais e portos não estão integrados.",
                ],
            }
        except Exception as ex:
            logger.warning("Cobertura Agro-Logística indisponível: %s", ex)
            return {
                "status": "UNAVAILABLE", "coverage_scope": {"status": "UNAVAILABLE"},
                "transporters": {"available": False}, "operational_records": {"available": False},
                "national_rntrc": {"available_in_canonical_contract": False, "status": "PENDING_CANONICAL_PROMOTION", "known_source_total": None},
                "storage": {"available": False, "status": "UNAVAILABLE", "reason": "CONAB_SOURCE_NOT_INTEGRATED"},
                "sources": [], "limitations": ["A camada canônica não pôde ser consultada nesta tentativa."],
            }

    @staticmethod
    def agro_logistica_municipios(q=None, uf=None, municipio=None, coverage_status=None,
                                  page=1, page_size=25, sort="transporters", order="desc"):
        size, offset = _page(page, page_size)
        filters, params = [], []
        if q:
            filters.append("(a.municipio ILIKE %s OR a.uf ILIKE %s)")
            params.extend((f"%{q}%", f"%{q}%"))
        if uf:
            filters.append("a.uf = %s")
            params.append(uf.upper())
        if municipio:
            filters.append("a.municipio ILIKE %s")
            params.append(f"%{municipio}%")
        clause = " AND ".join(filters) or "TRUE"
        sort_columns = {
            "municipio": "a.municipio", "uf": "a.uf", "transporters": "a.transporters",
            "with_rntrc": "a.with_rntrc", "geocoded": "a.geocoded",
        }
        sort_sql = sort_columns.get(sort, "a.transporters")
        order_sql = "ASC" if str(order).lower() == "asc" else "DESC"
        try:
            rows = _run_agro_logistics(f"""
                WITH aggregated AS (
                    SELECT t.uf, trim(t.municipio) AS municipio,
                           translate(upper(trim(t.municipio)),
                             'ÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC') AS municipio_key,
                           count(*)::int AS transporters,
                           count(*) FILTER (WHERE nullif(trim(t.numero_rntrc), '') IS NOT NULL)::int AS with_rntrc,
                           count(*) FILTER (WHERE t.latitude IS NOT NULL AND t.longitude IS NOT NULL AND t.latitude BETWEEN -33.75 AND 5.27 AND t.longitude BETWEEN -73.99 AND -34.79 AND (t.latitude <> 0 OR t.longitude <> 0))::int AS geocoded,
                           count(*) FILTER (WHERE nullif(trim(t.fonte_contato), '') IS NOT NULL)::int AS institutional_contacts,
                           avg(t.latitude) FILTER (WHERE t.latitude IS NOT NULL AND t.longitude IS NOT NULL AND t.latitude BETWEEN -33.75 AND 5.27 AND t.longitude BETWEEN -73.99 AND -34.79 AND (t.latitude <> 0 OR t.longitude <> 0)) AS latitude,
                           avg(t.longitude) FILTER (WHERE t.latitude IS NOT NULL AND t.longitude IS NOT NULL AND t.latitude BETWEEN -33.75 AND 5.27 AND t.longitude BETWEEN -73.99 AND -34.79 AND (t.latitude <> 0 OR t.longitude <> 0)) AS longitude
                    FROM log.transportadora t
                    GROUP BY t.uf, trim(t.municipio), translate(upper(trim(t.municipio)),
                      'ÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC')
                ), filtered AS (
                    SELECT a.*, count(*) OVER()::int AS total,
                           CASE WHEN a.transporters >= 100 THEN 'COBERTURA_CONHECIDA_ALTA'
                                WHEN a.transporters >= 20 THEN 'COBERTURA_CONHECIDA_MEDIA'
                                WHEN a.transporters > 0 THEN 'COBERTURA_CONHECIDA_BAIXA'
                                ELSE 'DADOS_INSUFICIENTES' END AS coverage_status
                    FROM aggregated a WHERE {clause}
                ), selected AS (
                    SELECT a.* FROM filtered a
                    WHERE (%s IS NULL OR a.coverage_status=%s)
                    ORDER BY {sort_sql} {order_sql} NULLS LAST, a.uf, a.municipio
                    LIMIT %s OFFSET %s
                )
                SELECT a.*, r.codigo_ibge, coalesce(op.operational_records, 0)::int AS operational_records,
                       NULL::int AS properties,
                       ws.bovinos::bigint AS livestock,
                       ws.classificacao_vet AS territorial_classification,
                       'MUNICIPAL_NAME_NORMALIZED' AS territorial_link_quality
                FROM selected a
                LEFT JOIN referencia.municipio r ON r.uf=a.uf AND upper(r.nome_normalizado)=a.municipio_key
                LEFT JOIN LATERAL (
                    SELECT count(*) AS operational_records
                    FROM log.transportadora t2 JOIN log.match m ON m.transportadora_id=t2.id
                    WHERE t2.uf=a.uf AND t2.municipio=a.municipio
                ) op ON true
                LEFT JOIN prospeccao.v_white_space_pecuaria ws ON ws.codigo_ibge=r.codigo_ibge
                ORDER BY {sort_sql} {order_sql} NULLS LAST, a.uf, a.municipio
            """, params + [coverage_status, coverage_status, size, offset])
            total = rows[0]["total"] if rows else 0
            for row in rows:
                row.pop("municipio_key", None); row.pop("total", None)
                row["sources"] = ["log.transportadora", "log.match", "SICAR/CAR", "IBGE", "IBGE PPM"]
                row["limitations"] = [
                    "Concentração conhecida na camada disponível.",
                    "A contagem CAR municipal foi omitida porque a consulta canônica excedeu a meta de desempenho."
                ]
            return {"status": "PARTIAL", "items": rows, "page": page, "page_size": size,
                    "total": total, "pages": (total + size - 1) // size if total else 0}
        except Exception as ex:
            logger.warning("Municípios Agro-Logística indisponíveis: %s", ex)
            return {"status": "UNAVAILABLE", "items": [], "page": page, "page_size": size,
                    "total": 0, "pages": 0, "limitations": ["Consulta municipal temporariamente indisponível."]}

    @staticmethod
    def agro_logistica_mapa(uf=None, limit=500):
        response = Wave1Repository.agro_logistica_municipios(
            uf=uf, page=1, page_size=min(max(limit, 1), MAX_PAGE_SIZE), sort="transporters", order="desc"
        )
        valid_items = []
        for row in response.get("items", []):
            lat = row.get("latitude")
            lng = row.get("longitude")
            if lat is not None and lng is not None:
                try:
                    lat_f = float(lat)
                    lng_f = float(lng)
                    if -33.75 <= lat_f <= 5.27 and -73.99 <= lng_f <= -34.79 and (lat_f != 0 or lng_f != 0):
                        valid_items.append({key: row.get(key) for key in (
                            "municipio", "uf", "codigo_ibge", "latitude", "longitude", "transporters",
                            "geocoded", "properties", "livestock", "territorial_classification", "coverage_status",
                            "territorial_link_quality"
                        )})
                except (ValueError, TypeError):
                    continue
        return {"status": response["status"], "items": valid_items, "returned": len(valid_items),
                "total": response["total"], "aggregation": "MUNICIPAL", "limit": min(max(limit, 1), MAX_PAGE_SIZE)}

    @staticmethod
    def agro_genetica_resumo():
        summary_rows = _run_db("wins_agro", """
            SELECT 
              (SELECT count(*)::int FROM mercado.reprodutor) as total_reprodutores,
              (SELECT count(registro)::int FROM mercado.reprodutor WHERE registro IS NOT NULL) as com_registro,
              (SELECT count(nome)::int FROM mercado.reprodutor WHERE nome IS NOT NULL) as com_nome,
              (SELECT count(pai_nome)::int FROM mercado.reprodutor WHERE pai_nome IS NOT NULL) as com_pai_nome,
              (SELECT count(mae_nome)::int FROM mercado.reprodutor WHERE mae_nome IS NOT NULL) as com_mae_nome,
              (SELECT count(*)::int FROM mercado.reprodutor WHERE pai_nome IS NOT NULL AND mae_nome IS NOT NULL) as com_pedigree_pai_mae,
              (SELECT count(*)::int FROM mercado.avaliacao) as total_avaliacoes,
              (SELECT count(DISTINCT reprodutor_id)::int FROM mercado.avaliacao) as reprodutores_com_avaliacao,
              (SELECT count(*)::int FROM catalogo.caracteristica) as total_caracteristicas,
              (SELECT count(DISTINCT raca_id)::int FROM mercado.reprodutor WHERE raca_id IS NOT NULL) as racas_com_reprodutor,
              (SELECT count(*)::int FROM catalogo.raca) as total_racas_cadastradas,
              (SELECT count(*)::int FROM catalogo.central) as total_centrais,
              (SELECT count(*)::int FROM mercado.touro_central) as vinculos_touro_central,
              (SELECT count(*)::int FROM mercado.touro_oferta) as ofertas_semen,
              (SELECT count(*)::int FROM fazenda.animal WHERE sexo = 'F') as femeas_cadastradas,
              (SELECT count(*)::int FROM mercado.doadora) as doadoras_cadastradas,
              (SELECT count(*)::int FROM mercado.v_matriz) as matrizes_catalogo,
              (SELECT count(*)::int FROM fazenda.cruzamento) as cruzamentos_reais,
              (SELECT count(*)::int FROM fazenda.estacao_monta) as estacoes_monta,
              (SELECT count(*)::int FROM (SELECT caracteristica_id FROM mercado.avaliacao GROUP BY caracteristica_id HAVING count(*) >= 10000) t) as caracteristicas_densas,
              GREATEST(
                (SELECT max(coletado_em) FROM mercado.reprodutor),
                (SELECT max(coletado_em) FROM mercado.avaliacao),
                (SELECT max(coletado_em) FROM fazenda.animal),
                (SELECT max(coletado_em) FROM mercado.doadora)
              )::text as updated_at
        """, domain="agro")
        
        data = summary_rows[0] if summary_rows else {}
        
        breed_rows = _run_db("wins_agro", """
            SELECT r.id, r.nome as raca, count(rp.id)::int as total,
                   count(rp.pai_nome)::int as with_pai,
                   count(rp.mae_nome)::int as with_mae,
                   count(CASE WHEN rp.pai_nome IS NOT NULL AND rp.mae_nome IS NOT NULL THEN 1 END)::int as with_ambos
            FROM catalogo.raca r
            LEFT JOIN mercado.reprodutor rp ON rp.raca_id = r.id
            GROUP BY r.id, r.nome
            HAVING count(rp.id) > 0
            ORDER BY total DESC;
        """, domain="agro")

        source_rows = _run_db("wins_agro", """
            SELECT fonte, sum(total)::int AS total
            FROM (
                SELECT NULLIF(trim(fonte_programa), '') AS fonte, count(*) AS total
                FROM mercado.reprodutor GROUP BY 1
                UNION ALL
                SELECT NULLIF(trim(p.nome), '') AS fonte, count(*) AS total
                FROM mercado.avaliacao a
                LEFT JOIN catalogo.sumario_edicao se ON se.id = a.sumario_edicao_id
                LEFT JOIN catalogo.programa p ON p.id = se.programa_id
                GROUP BY 1
            ) s
            WHERE fonte IS NOT NULL
            GROUP BY fonte ORDER BY total DESC, fonte
        """, domain="agro")

        total_reprodutores = int(data.get("total_reprodutores") or 0)
        total_avaliacoes = int(data.get("total_avaliacoes") or 0)
        pedigree_textual = int(data.get("com_pedigree_pai_mae") or 0)
        femeas = int(data.get("femeas_cadastradas") or 0)

        return {
            "status": "AVAILABLE" if total_reprodutores and total_avaliacoes else "PARTIAL",
            "counts": data,
            "breed_distribution": breed_rows,
            "pillars_status": {
                "catalogo": "AVAILABLE" if total_reprodutores else "UNAVAILABLE",
                "avaliacoes_dep": "AVAILABLE" if total_avaliacoes else "UNAVAILABLE",
                "pedigree_declarado": "PARTIAL" if pedigree_textual else "UNAVAILABLE",
                "acasalamento_dirigido": "PARTIAL" if femeas else "UNAVAILABLE",
                "consanguinidade_formal": "UNAVAILABLE",
                "valor_economico": "UNAVAILABLE",
                "bezerro_previsto": "PLANNED",
                "app_campo_telemetria": "PARTIAL" if femeas else "PLANNED"
            },
            "sources": source_rows,
            "limitations": [
                "As contagens são calculadas no banco no momento da consulta; nenhuma contagem é embutida no contrato.",
                "Pai e mãe textuais representam pedigree imediato declarado, não ancestralidade resolvida por identificador.",
                "O cadastro operacional de fêmeas é parcial e não comprova prontidão para acasalamento.",
                "Nenhum score sintético, ROI inventado ou valor de prenhez estimado é gerado."
            ],
            "updated_at": data.get("updated_at")
        }

    @staticmethod
    def agro_genetica_reprodutores(page=1, page_size=25, q=None, registro=None, raca=None,
                                   central=None, uf=None, municipio=None, pedigree_status=None,
                                   has_evaluation=None, sort="avaliacoes_count", order="desc"):
        size, offset = _page(page, page_size)
        where = ["1=1"]
        params = []

        if q:
            where.append("(r.nome ILIKE %s OR r.registro ILIKE %s OR r.fazenda_origem ILIKE %s)")
            params += [f"%{q}%", f"%{q}%", f"%{q}%"]
        if registro:
            where.append("r.registro ILIKE %s")
            params.append(f"%{registro}%")
        if raca:
            where.append("c.nome ILIKE %s")
            params.append(f"%{raca}%")
        if central:
            where.append("(cen.nome ILIKE %s OR o.nome_comercial ILIKE %s)")
            params += [f"%{central}%", f"%{central}%"]
        if uf:
            where.append("r.uf = %s")
            params.append(uf.upper())
        if municipio:
            where.append("r.municipio ILIKE %s")
            params.append(f"%{municipio}%")
        if pedigree_status == "declared":
            where.append("r.pai_nome IS NOT NULL AND r.mae_nome IS NOT NULL")
        elif pedigree_status == "partial":
            where.append("((r.pai_nome IS NOT NULL AND r.mae_nome IS NULL) OR (r.pai_nome IS NULL AND r.mae_nome IS NOT NULL))")
        elif pedigree_status == "none":
            where.append("r.pai_nome IS NULL AND r.mae_nome IS NULL")
        if has_evaluation is True:
            where.append("COALESCE(av.cnt, 0) > 0")
        elif has_evaluation is False:
            where.append("COALESCE(av.cnt, 0) = 0")

        order_dir = "DESC" if order.lower() == "desc" else "ASC"
        sort_map = {
            "avaliacoes_count": "COALESCE(av.cnt, 0)",
            "nome": "r.nome",
            "registro": "r.registro",
            "raca": "c.nome",
            "preco_dose": "o.preco_dose_brl",
            "nascimento": "r.data_nascimento",
            "id": "r.id"
        }
        sort_col = sort_map.get(sort, "COALESCE(av.cnt, 0)")
        clause = " AND ".join(where)

        sql = f"""
            SELECT r.id::text, r.registro, r.nome, r.sexo, r.data_nascimento::text,
                   r.pai_registro, r.pai_nome, r.mae_registro, r.mae_nome,
                   r.avo_materno_registro, r.avo_materno_nome,
                   r.fazenda_origem, r.uf, r.municipio, r.fonte_programa, r.em_central,
                   c.nome as raca_nome,
                   o.preco_dose_brl::float as preco_dose_brl,
                   o.nome_comercial as oferta_nome_comercial,
                   cen.nome as central_nome,
                   COALESCE(av.cnt, 0)::int as avaliacoes_count,
                   (CASE WHEN r.pai_id IS NOT NULL AND r.mae_id IS NOT NULL THEN 'PEDIGREE_ID_RESOLVED'
                         WHEN r.pai_id IS NOT NULL OR r.mae_id IS NOT NULL THEN 'PEDIGREE_PARTIAL_ID'
                         WHEN r.pai_nome IS NOT NULL OR r.mae_nome IS NOT NULL THEN 'PEDIGREE_NAME_ONLY'
                         ELSE 'PEDIGREE_UNAVAILABLE' END) as pedigree_quality
            FROM mercado.reprodutor r
            LEFT JOIN catalogo.raca c ON c.id = r.raca_id
            LEFT JOIN LATERAL (
                SELECT preco_dose_brl, nome_comercial, central_id
                FROM mercado.touro_oferta
                WHERE reprodutor_id = r.id
                ORDER BY preco_dose_brl DESC NULLS LAST
                LIMIT 1
            ) o ON true
            LEFT JOIN catalogo.central cen ON cen.id = COALESCE(o.central_id, r.central_id)
            LEFT JOIN LATERAL (
                SELECT count(*)::int as cnt
                FROM mercado.avaliacao
                WHERE reprodutor_id = r.id
            ) av ON true
            WHERE {clause}
            ORDER BY {sort_col} {order_dir} NULLS LAST, r.id DESC
            LIMIT %s OFFSET %s
        """
        rows = _run_db("wins_agro", sql, params + [size, offset], domain="agro")

        count_sql = f"""
            SELECT count(*)::int as total
            FROM mercado.reprodutor r
            LEFT JOIN catalogo.raca c ON c.id = r.raca_id
            LEFT JOIN LATERAL (
                SELECT preco_dose_brl, nome_comercial, central_id
                FROM mercado.touro_oferta
                WHERE reprodutor_id = r.id
                ORDER BY preco_dose_brl DESC NULLS LAST
                LIMIT 1
            ) o ON true
            LEFT JOIN catalogo.central cen ON cen.id = COALESCE(o.central_id, r.central_id)
            LEFT JOIN LATERAL (
                SELECT count(*)::int as cnt
                FROM mercado.avaliacao
                WHERE reprodutor_id = r.id
            ) av ON true
            WHERE {clause}
        """
        total_rows = _run_db("wins_agro", count_sql, params, domain="agro")
        total = total_rows[0]["total"] if total_rows else len(rows)

        return {
            "items": rows,
            "meta": _meta(page, size, total, rows, "wins_agro.mercado.reprodutor")
        }

    @staticmethod
    def agro_genetica_reprodutor_detail(rep_id: str):
        is_num = str(rep_id).isdigit()
        where_cond = "r.id = %s::integer" if is_num else "r.registro ILIKE %s"
        param = int(rep_id) if is_num else str(rep_id)

        rows = _run_db("wins_agro", f"""
            SELECT r.id::text, r.registro, r.nome, r.sexo, r.data_nascimento::text,
                   r.pai_registro, r.pai_nome, r.mae_registro, r.mae_nome,
                   r.avo_materno_registro, r.avo_materno_nome,
                   r.fazenda_origem, r.uf, r.municipio, r.fonte_programa, r.fonte_url,
                   r.em_central, r.filhos_avaliacao, r.rebanhos_avaliacao,
                   c.nome as raca_nome, r.raca_id,
                   cen.nome as central_nome, r.central_id,
                   o.preco_dose_brl::float as preco_dose_brl,
                   o.url_oferta, o.nome_comercial as oferta_nome_comercial,
                   (CASE WHEN r.pai_id IS NOT NULL AND r.mae_id IS NOT NULL THEN 'PEDIGREE_ID_RESOLVED'
                         WHEN r.pai_id IS NOT NULL OR r.mae_id IS NOT NULL THEN 'PEDIGREE_PARTIAL_ID'
                         WHEN r.pai_nome IS NOT NULL OR r.mae_nome IS NOT NULL THEN 'PEDIGREE_NAME_ONLY'
                         ELSE 'PEDIGREE_UNAVAILABLE' END) as pedigree_quality
            FROM mercado.reprodutor r
            LEFT JOIN catalogo.raca c ON c.id = r.raca_id
            LEFT JOIN LATERAL (
                SELECT preco_dose_brl, url_oferta, nome_comercial, central_id
                FROM mercado.touro_oferta
                WHERE reprodutor_id = r.id
                ORDER BY preco_dose_brl DESC NULLS LAST
                LIMIT 1
            ) o ON true
            LEFT JOIN catalogo.central cen ON cen.id = COALESCE(o.central_id, r.central_id)
            WHERE {where_cond}
            LIMIT 1
        """, [param], domain="agro")

        if not rows:
            return None

        rep = rows[0]
        actual_id = int(rep["id"])

        deps = _run_db("wins_agro", """
            SELECT av.id::text as avaliacao_id,
                   ca.id as caracteristica_id, ca.sigla, ca.nome as caracteristica_nome,
                   COALESCE(ca.unidade, '') as unidade, COALESCE(ca.descricao, '') as descricao,
                   av.valor::float as valor,
                   av.percentil::float as percentil,
                   av.acuracia::float as acuracia,
                   av.classe, av.eh_genomica,
                   prog.nome as programa_nome,
                   ca.fonte_programa,
                   (CASE WHEN ca.objetivo_aumentar IS TRUE THEN 'HIGHER_BETTER'
                         WHEN ca.objetivo_aumentar IS FALSE THEN 'LOWER_BETTER'
                         ELSE 'UNKNOWN' END) as selection_direction
            FROM mercado.avaliacao av
            JOIN catalogo.caracteristica ca ON ca.id = av.caracteristica_id
            LEFT JOIN catalogo.sumario_edicao se ON se.id = av.sumario_edicao_id
            LEFT JOIN catalogo.programa prog ON prog.id = se.programa_id
            WHERE av.reprodutor_id = %s
            ORDER BY (CASE WHEN ca.sigla = 'IQGg' THEN 1
                           WHEN ca.sigla IN ('GPD','PD','PS','PES') THEN 2
                           WHEN ca.sigla IN ('AOL','EGS','CFD','CFS','MAR','CAR') THEN 3
                           WHEN ca.sigla IN ('TMD','TMM','PM','HP','IPP','PSF','RD') THEN 4
                           ELSE 5 END), ca.sigla
        """, [actual_id], domain="agro")

        rep["avaliacoes"] = deps
        rep["total_avaliacoes"] = len(deps)
        return rep

    @staticmethod
    def agro_genetica_caracteristicas():
        rows = _run_db("wins_agro", """
            SELECT c.id, c.sigla, c.nome, COALESCE(c.unidade, '') as unidade,
                   COALESCE(c.descricao, '') as descricao,
                   count(av.id)::int as total_avaliacoes,
                   count(DISTINCT av.reprodutor_id)::int as total_reprodutores,
                   min(av.valor)::float as min_valor,
                   (percentile_cont(0.5) WITHIN GROUP (ORDER BY av.valor))::float as mediana_valor,
                   max(av.valor)::float as max_valor,
                   (count(av.percentil) > 0) as has_percentil,
                   (count(av.acuracia) > 0) as has_acuracia,
                   (CASE WHEN c.objetivo_aumentar IS TRUE THEN 'HIGHER_BETTER'
                         WHEN c.objetivo_aumentar IS FALSE THEN 'LOWER_BETTER'
                         ELSE 'UNKNOWN' END) as selection_direction,
                   c.grupo as categoria, c.fonte_programa,
                   max(av.coletado_em)::text as updated_at
            FROM catalogo.caracteristica c
            LEFT JOIN mercado.avaliacao av ON av.caracteristica_id = c.id
            GROUP BY c.id, c.sigla, c.nome, c.unidade, c.descricao, c.grupo, c.fonte_programa, c.objetivo_aumentar
            ORDER BY count(av.id) DESC, c.sigla ASC
        """, domain="agro")

        return {
            "total": len(rows),
            "caracteristicas": rows,
            "dense_traits_count": sum(1 for r in rows if r["total_avaliacoes"] >= 10000),
            "updated_at": max((r.get("updated_at") for r in rows if r.get("updated_at")), default=None)
        }

    @staticmethod
    def agro_genetica_pedigree(rep_id: str):
        is_num = str(rep_id).isdigit()
        where_cond = "r.id = %s::integer" if is_num else "r.registro ILIKE %s"
        param = int(rep_id) if is_num else str(rep_id)

        rows = _run_db("wins_agro", f"""
            SELECT r.id::text, r.registro, r.nome, c.nome as raca, r.fazenda_origem, r.fonte_programa,
                   r.pai_id::text, r.mae_id::text, r.avo_materno_id::text,
                   r.pai_registro, r.pai_nome, r.mae_registro, r.mae_nome,
                   r.avo_materno_registro, r.avo_materno_nome
            FROM mercado.reprodutor r
            LEFT JOIN catalogo.raca c ON c.id = r.raca_id
            WHERE {where_cond}
            LIMIT 1
        """, [param], domain="agro")

        if not rows:
            return None

        rep = rows[0]
        pai_reg = rep.get("pai_registro")
        pai_nome = rep.get("pai_nome")
        mae_reg = rep.get("mae_registro")
        mae_nome = rep.get("mae_nome")

        resolved_pai = None
        if rep.get("pai_id") or pai_reg:
            p_rows = _run_db("wins_agro", """
                SELECT id::text, registro, nome, fazenda_origem
                FROM mercado.reprodutor
                WHERE (%s IS NOT NULL AND id = %s::integer) OR (%s IS NOT NULL AND registro = %s)
                LIMIT 1
            """, [rep.get("pai_id"), rep.get("pai_id"), pai_reg, pai_reg], domain="agro")
            if p_rows:
                resolved_pai = p_rows[0]

        resolved_mae = None
        if rep.get("mae_id") or mae_reg:
            m_rows = _run_db("wins_agro", """
                SELECT id::text, registro, nome, fazenda_origem
                FROM mercado.reprodutor
                WHERE (%s IS NOT NULL AND id = %s::integer) OR (%s IS NOT NULL AND registro = %s)
                LIMIT 1
            """, [rep.get("mae_id"), rep.get("mae_id"), mae_reg, mae_reg], domain="agro")
            if m_rows:
                resolved_mae = m_rows[0]

        resolved_count = int(bool(resolved_pai)) + int(bool(resolved_mae))
        has_text = bool(pai_nome or mae_nome)
        quality = ("PEDIGREE_ID_RESOLVED" if resolved_count == 2 else
                   "PEDIGREE_PARTIAL_ID" if resolved_count == 1 else
                   "PEDIGREE_NAME_ONLY" if has_text else "PEDIGREE_UNAVAILABLE")
        depth = 1 if resolved_count else 0

        return {
            "status": "AVAILABLE" if resolved_count == 2 else ("PARTIAL" if has_text else "UNAVAILABLE"),
            "quality": quality,
            "depth_available": depth,
            "subject": {
                "id": rep["id"],
                "registro": rep["registro"],
                "nome": rep["nome"],
                "raca": rep["raca"],
                "fazenda_origem": rep["fazenda_origem"],
                "fonte_programa": rep["fonte_programa"]
            },
            "father": {
                "registro": pai_reg,
                "nome": pai_nome,
                "resolved_id": resolved_pai["id"] if resolved_pai else None,
                "fazenda_origem": resolved_pai["fazenda_origem"] if resolved_pai else None
            },
            "mother": {
                "registro": mae_reg,
                "nome": mae_nome,
                "resolved_id": resolved_mae["id"] if resolved_mae else None,
                "fazenda_origem": resolved_mae["fazenda_origem"] if resolved_mae else None
            },
            "maternal_grandfather": {
                "registro": rep.get("avo_materno_registro"),
                "nome": rep.get("avo_materno_nome")
            },
            "limitations": "Somente IDs ou registros exatos resolvem parentesco. Nomes são exibidos como declaração textual e nunca criam vínculo genealógico."
        }

    @staticmethod
    def agro_genetica_acasalamento_prontidao():
        farm_females = _run_db("wins_agro", """
            SELECT a.id::text, a.nome, a.brinco, a.registro_associacao, a.peso_atual_kg::float,
                   a.escore_corporal::float, a.status, r.nome as raca,
                   a.pai_nome_externo as pai_nome, a.pai_registro_externo as pai_registro,
                   'fazenda.animal' as origem_tabela
            FROM fazenda.animal a
            LEFT JOIN catalogo.raca r ON r.id = a.raca_id
            WHERE a.sexo = 'F' AND COALESCE(a.status, 'ativo') <> 'descarte'
            ORDER BY a.id ASC
        """, domain="agro")

        donors = _run_db("wins_agro", """
            SELECT d.id::text, d.nome, d.registro, d.fazenda_origem, r.nome as raca,
                   rp.pai_registro, rp.pai_nome, rp.mae_registro, rp.mae_nome,
                   d.fonte_referencia, 'mercado.doadora' as origem_tabela
            FROM mercado.doadora d
            LEFT JOIN catalogo.raca r ON r.id = d.raca_id
            LEFT JOIN mercado.reprodutor rp ON rp.id = d.reprodutor_id
            ORDER BY d.id ASC
        """, domain="agro")

        matrices = []
        for f in farm_females:
            matrices.append({
                "id": f"fazenda_{f['id']}",
                "raw_id": f['id'],
                "tipo": "MATRIZ_FAZENDA",
                "nome": f["nome"] or f"Brinco {f.get('brinco')}",
                "registro": f.get("registro_associacao"),
                "raca": f.get("raca"),
                "peso_kg": f.get("peso_atual_kg"),
                "escore_corporal": f.get("escore_corporal"),
                "pai_nome": f.get("pai_nome"),
                "pai_registro": f.get("pai_registro"),
                "mae_nome": None,
                "mae_registro": None,
                "status": f.get("status") or "ativo",
                "origem": "fazenda.animal",
                "eligibility": "PARTIAL",
                "ineligible_reasons": ["MOTHER_PEDIGREE_UNAVAILABLE"]
            })
        for d in donors:
            matrices.append({
                "id": f"doadora_{d['id']}",
                "raw_id": d['id'],
                "tipo": "DOADORA_CATALOGO",
                "nome": d["nome"],
                "registro": d.get("registro"),
                "raca": d.get("raca"),
                "peso_kg": None,
                "escore_corporal": None,
                "pai_nome": d.get("pai_nome"),
                "pai_registro": d.get("pai_registro"),
                "mae_nome": d.get("mae_nome"),
                "mae_registro": d.get("mae_registro"),
                "status": "ativo",
                "origem": "mercado.doadora",
                "eligibility": "AVAILABLE" if d.get("registro") and d.get("raca") and d.get("pai_registro") and d.get("mae_registro") else "PARTIAL",
                "ineligible_reasons": [] if d.get("registro") and d.get("raca") and d.get("pai_registro") and d.get("mae_registro") else ["IDENTITY_OR_PEDIGREE_INCOMPLETE"]
            })

        target_traits = _run_db("wins_agro", """
            SELECT c.sigla, c.nome, c.unidade, c.grupo AS categoria,
                   CASE WHEN c.objetivo_aumentar IS TRUE THEN 'HIGHER_BETTER'
                        WHEN c.objetivo_aumentar IS FALSE THEN 'LOWER_BETTER'
                        ELSE 'UNKNOWN' END AS selection_direction,
                   count(a.id)::int AS total_avaliacoes
            FROM catalogo.caracteristica c
            JOIN mercado.avaliacao a ON a.caracteristica_id = c.id
            GROUP BY c.id, c.sigla, c.nome, c.unidade, c.grupo, c.objetivo_aumentar
            HAVING c.objetivo_aumentar IS NOT NULL AND count(a.id) > 0
            ORDER BY count(a.id) DESC, c.sigla
        """, domain="agro")

        eligible_matrices = sum(1 for matrix in matrices if matrix["eligibility"] == "AVAILABLE")

        return {
            "status": "AVAILABLE" if eligible_matrices else "PARTIAL",
            "matrizes_count": len(matrices),
            "eligible_matrices_count": eligible_matrices,
            "matrizes": matrices,
            "available_target_traits": target_traits,
            "contracts": {
                "pedigree_status": "PARTIAL",
                "dep_status": "AVAILABLE" if target_traits else "UNAVAILABLE",
                "multi_trait_ranking_status": "PLANNED",
                "kinship_check_status": "AVAILABLE" if eligible_matrices else "NOT_CALCULABLE",
                "inbreeding_coefficient_status": "UNAVAILABLE",
                "inbreeding_reason": "PEDIGREE_DEPTH_INSUFFICIENT_FOR_FORMAL_COEFFICIENT",
                "economic_value_status": "UNAVAILABLE",
                "economic_value_reason": "REQUIRES_HERD_PRODUCTION_AND_COMMERCIAL_COST_PARAMETERS",
                "predicted_calf_status": "PLANNED"
            },
            "blockers": [
                "Acasalamento exige matriz com identidade, raça e registros exatos de pai e mãe.",
                "Nomes textuais não são usados para inferir parentesco.",
                "Não gera valores econômicos ou ROI sem parametrização de custos da fazenda."
            ],
            "limitations": "Motor fail-closed: sem matriz elegível, direção de mérito persistida e DEP real, o resultado permanece NOT_CALCULABLE."
        }

    @staticmethod
    def agro_genetica_acasalamento_candidatos(payload: dict):
        if not payload:
            return {"status": "PREREQUISITE_REQUIRED", "message": "Matriz ou dados da fêmea são obrigatórios para simulação.", "eligible_reproducers": [], "excluded_reproducers": []}

        matrix_id = payload.get("matrix_id") or payload.get("matriz_id")
        custom_matrix = payload.get("custom_matrix") or payload.get("custom_matriz")
        target_sigla = (payload.get("target_characteristic") or payload.get("caracteristica_alvo") or payload.get("sigla") or "GPD").upper()
        min_accuracy = payload.get("min_accuracy") or payload.get("min_acuracia")
        limit = min(max(int(payload.get("limit") or 10), 1), 50)

        matrix = None
        if matrix_id:
            if str(matrix_id).startswith("fazenda_") or str(matrix_id).isdigit():
                raw_id = str(matrix_id).replace("fazenda_", "")
                if raw_id.isdigit():
                    f_rows = _run_db("wins_agro", """
                        SELECT a.id::text, a.nome, a.brinco, a.registro_associacao as registro,
                               r.nome as raca, a.pai_nome_externo as pai_nome, a.pai_registro_externo as pai_registro,
                               a.peso_atual_kg::float, a.escore_corporal::float
                        FROM fazenda.animal a
                        LEFT JOIN catalogo.raca r ON r.id = a.raca_id
                        WHERE a.id = %s::integer AND a.sexo = 'F' AND COALESCE(a.status, 'ativo') <> 'descarte'
                    """, [int(raw_id)], domain="agro")
                    if f_rows:
                        m = f_rows[0]
                        matrix = {
                            "id": f"fazenda_{m['id']}", "nome": m["nome"] or f"Brinco {m.get('brinco')}",
                            "registro": m.get("registro"), "raca": m.get("raca"),
                            "pai_nome": m.get("pai_nome"), "pai_registro": m.get("pai_registro"),
                            "mae_nome": None, "mae_registro": None, "peso_kg": m.get("peso_atual_kg"),
                            "escore_corporal": m.get("escore_corporal")
                        }
            elif str(matrix_id).startswith("doadora_"):
                raw_id = str(matrix_id).replace("doadora_", "")
                if raw_id.isdigit():
                    d_rows = _run_db("wins_agro", """
                        SELECT d.id::text, d.nome, d.registro, r.nome as raca, d.fazenda_origem,
                               rp.pai_nome, rp.pai_registro, rp.mae_nome, rp.mae_registro
                        FROM mercado.doadora d
                        LEFT JOIN catalogo.raca r ON r.id = d.raca_id
                        LEFT JOIN mercado.reprodutor rp ON rp.id = d.reprodutor_id
                        WHERE d.id = %s::integer
                    """, [int(raw_id)], domain="agro")
                    if d_rows:
                        m = d_rows[0]
                        matrix = {
                            "id": f"doadora_{m['id']}", "nome": m["nome"],
                            "registro": m.get("registro"), "raca": m.get("raca"),
                            "pai_nome": m.get("pai_nome"), "pai_registro": m.get("pai_registro"),
                            "mae_nome": m.get("mae_nome"), "mae_registro": m.get("mae_registro"),
                            "peso_kg": None, "escore_corporal": None
                        }

        if not matrix and custom_matrix and isinstance(custom_matrix, dict):
            matrix = {
                "id": "custom",
                "nome": custom_matrix.get("nome"),
                "registro": custom_matrix.get("registro"),
                "raca": custom_matrix.get("raca"),
                "pai_nome": custom_matrix.get("pai_nome"),
                "pai_registro": custom_matrix.get("pai_registro"),
                "mae_nome": custom_matrix.get("mae_nome"),
                "mae_registro": custom_matrix.get("mae_registro"),
                "peso_kg": custom_matrix.get("peso_kg"),
                "escore_corporal": custom_matrix.get("escore_corporal")
            }

        if not matrix:
            return {
                "status": "PREREQUISITE_REQUIRED",
                "message": "Selecione uma matriz cadastrada ou informe os dados da fêmea para executar o acasalamento.",
                "eligible_reproducers": [],
                "excluded_reproducers": [],
                "limitations": "Motor fail-closed: exige matriz comprovada para ranqueamento."
            }

        missing_matrix_fields = [field for field in ("nome", "registro", "raca", "pai_registro", "mae_registro") if not matrix.get(field)]
        if missing_matrix_fields:
            return {
                "status": "NOT_CALCULABLE",
                "message": "A matriz não possui identidade e pedigree por registro suficientes para checagem de parentesco.",
                "missing_prerequisites": missing_matrix_fields,
                "matrix": matrix,
                "matriz": matrix,
                "eligible_reproducers": [], "candidatos": [],
                "excluded_reproducers": [], "descartados_consanguinidade": []
            }

        trait_rows = _run_db("wins_agro", """
            SELECT c.id, c.sigla, c.nome, c.objetivo_aumentar,
                   count(a.id)::int AS total_avaliacoes
            FROM catalogo.caracteristica c
            LEFT JOIN mercado.avaliacao a ON a.caracteristica_id = c.id
            WHERE upper(c.sigla) = %s
            GROUP BY c.id, c.sigla, c.nome, c.objetivo_aumentar
        """, [target_sigla], domain="agro")
        if not trait_rows or trait_rows[0].get("objetivo_aumentar") is None or not trait_rows[0].get("total_avaliacoes"):
            return {
                "status": "NOT_CALCULABLE",
                "message": "Característica sem direção de mérito documentada ou sem avaliações persistidas.",
                "target_characteristic": target_sigla,
                "eligible_reproducers": [], "candidatos": [],
                "excluded_reproducers": [], "descartados_consanguinidade": []
            }
        is_lower_better = trait_rows[0]["objetivo_aumentar"] is False
        order_dir = "ASC" if is_lower_better else "DESC"

        raca_nome = matrix["raca"]
        
        where_candidates = ["c.nome ILIKE %s", "ca.sigla = %s"]
        params_candidates = [f"%{raca_nome}%", target_sigla]

        if min_accuracy is not None:
            where_candidates.append("av.acuracia >= %s")
            params_candidates.append(float(min_accuracy))

        clause_cand = " AND ".join(where_candidates)

        sql_candidates = f"""
            SELECT r.id::text, r.registro, r.nome, r.pai_nome, r.mae_nome, r.pai_registro, r.mae_registro,
                   r.fazenda_origem, r.uf, r.municipio, c.nome as raca_nome,
                   av.valor::float as valor, av.percentil::float as percentil, av.acuracia::float as acuracia,
                   o.preco_dose_brl::float as preco_dose_brl,
                   cen.nome as central_nome
            FROM mercado.reprodutor r
            JOIN catalogo.raca c ON c.id = r.raca_id
            JOIN mercado.avaliacao av ON av.reprodutor_id = r.id
            JOIN catalogo.caracteristica ca ON ca.id = av.caracteristica_id
            LEFT JOIN LATERAL (
                SELECT preco_dose_brl, central_id
                FROM mercado.touro_oferta
                WHERE reprodutor_id = r.id
                ORDER BY preco_dose_brl DESC NULLS LAST
                LIMIT 1
            ) o ON true
            LEFT JOIN catalogo.central cen ON cen.id = COALESCE(o.central_id, r.central_id)
            WHERE {clause_cand}
            ORDER BY av.valor {order_dir} NULLS LAST, r.id DESC
            LIMIT %s
        """
        raw_candidates = _run_db("wins_agro", sql_candidates, params_candidates + [limit * 3], domain="agro")

        m_pai_reg = (matrix.get("pai_registro") or "").strip().upper()
        m_mae_reg = (matrix.get("mae_registro") or "").strip().upper()
        m_reg = (matrix.get("registro") or "").strip().upper()

        eligible = []
        excluded = []

        for cand in raw_candidates:
            c_reg = (cand.get("registro") or "").strip().upper()
            c_pai_reg = (cand.get("pai_registro") or "").strip().upper()
            c_mae_reg = (cand.get("mae_registro") or "").strip().upper()

            is_father = bool(m_pai_reg and c_reg and m_pai_reg == c_reg)
            is_same_father = bool(m_pai_reg and c_pai_reg and m_pai_reg == c_pai_reg)
            is_same_mother = bool(m_mae_reg and c_mae_reg and m_mae_reg == c_mae_reg)
            is_son = bool(m_reg and c_mae_reg and m_reg == c_mae_reg)

            if is_father:
                excluded.append({
                    "id": cand["id"], "nome": cand["nome"], "registro": cand["registro"],
                    "reason": "PARENT_CHILD", "details": f"Touro identificado como genitor (pai) da matriz ({matrix.get('pai_nome') or matrix.get('pai_registro')})."
                })
            elif is_son:
                excluded.append({
                    "id": cand["id"], "nome": cand["nome"], "registro": cand["registro"],
                    "reason": "PARENT_CHILD", "details": "Touro identificado como filho direto da matriz."
                })
            elif is_same_father:
                excluded.append({
                    "id": cand["id"], "nome": cand["nome"], "registro": cand["registro"],
                    "reason": "HALF_SIBLING_PATERNAL", "details": f"Mesmo pai declarado ({cand.get('pai_nome') or cand.get('pai_registro')})."
                })
            elif is_same_mother:
                excluded.append({
                    "id": cand["id"], "nome": cand["nome"], "registro": cand["registro"],
                    "reason": "HALF_SIBLING_MATERNAL", "details": f"Mesma mãe declarada ({cand.get('mae_nome') or cand.get('mae_registro')})."
                })
            else:
                if len(eligible) < limit:
                    eligible.append({
                        "id": cand["id"],
                        "registro": cand["registro"],
                        "nome": cand["nome"],
                        "raca": cand["raca_nome"],
                        "fazenda_origem": cand["fazenda_origem"],
                        "uf": cand["uf"],
                        "municipio": cand["municipio"],
                        "pai_nome": cand["pai_nome"],
                        "mae_nome": cand["mae_nome"],
                        "central_nome": cand["central_nome"],
                        "preco_dose_brl": cand["preco_dose_brl"],
                        "dep_valor": cand["valor"],
                        "dep_percentil": cand["percentil"],
                        "dep_acuracia": cand["acuracia"],
                        "kinship_verdict": "NO_IMMEDIATE_REGISTRATION_MATCH_FOUND"
                    })

        return {
            "status": "AVAILABLE",
            "matrix": matrix,
            "matriz": matrix,
            "target_characteristic": {
                "sigla": target_sigla,
                "selection_direction": "LOWER_BETTER" if is_lower_better else "HIGHER_BETTER"
            },
            "caracteristica_alvo": target_sigla,
            "eligible_reproducers": eligible,
            "candidatos": eligible,
            "excluded_reproducers": excluded,
            "descartados_consanguinidade": excluded,
            "total_eligible": len(eligible),
            "total_excluded": len(excluded),
            "total_avaliados": len(eligible) + len(excluded),
            "genetic_evidence": f"Ordenação determinística pela DEP {target_sigla}; direção obtida de catalogo.caracteristica.objetivo_aumentar.",
            "limitations": "Triagem por registros exatos do pedigree imediato. Não é recomendação zootécnica, não calcula o coeficiente de Wright e não prevê fenótipo."
        }

    @staticmethod
    def agro_genetica_simulador(touro_id=None, raca=None):
        # Facade fail-closed para compatibilidade retroativa
        rows = _run_db("wins_agro", """
            SELECT r.id, r.registro, r.nome, r.pai_nome, r.mae_nome, r.fazenda_origem,
                   r.uf, r.municipio, r.fonte_programa, c.nome AS raca,
                   a.valor AS dep_ganho_peso, a.percentil AS dep_percentil, a.acuracia AS dep_acuracia
            FROM mercado.reprodutor r
            LEFT JOIN catalogo.raca c ON c.id = r.raca_id
            LEFT JOIN LATERAL (
                SELECT av.valor, av.percentil, av.acuracia
                FROM mercado.avaliacao av
                JOIN catalogo.caracteristica ca ON ca.id = av.caracteristica_id
                WHERE av.reprodutor_id = r.id AND ca.sigla IN ('GPD','PD')
                ORDER BY av.id DESC
                LIMIT 1
            ) a ON true
            WHERE r.registro IS NOT NULL AND c.id IS NOT NULL
              AND r.pai_nome IS NOT NULL AND r.mae_nome IS NOT NULL
              AND a.valor IS NOT NULL
              AND (%s IS NULL OR r.registro ILIKE %s OR r.nome ILIKE %s)
              AND (%s IS NULL OR c.nome ILIKE %s)
            ORDER BY r.id
            LIMIT 15
        """, [touro_id, f"%{touro_id}%" if touro_id else None, f"%{touro_id}%" if touro_id else None, raca, f"%{raca}%" if raca else None], domain="agro")

        total_rows = _run_db("wins_agro", "SELECT count(*)::int total FROM mercado.reprodutor", [], domain="agro")
        total_reprodutores = total_rows[0]["total"] if total_rows else 0

        return {
            "reprodutores": rows,
            "total": len(rows),
            "total_reprodutores": total_reprodutores,
            "status": "PARTIAL",
            "simulador_exemplo": None,
            "nota": "Seleção e simulação exigem DEP real (mercado.avaliacao), raça, RGD e pedigree mínimo (pai e mãe). Nenhum resultado fictício é gerado."
        }
