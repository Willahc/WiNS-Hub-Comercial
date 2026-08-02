"""Radar de Sinais e Oportunidades Agro — motor territorial em validação.

Leitura somente. Nenhuma oportunidade comercial é fabricada: o motor expõe
explicitamente seu estado (VALIDATION), sinais territoriais reais calculados a
partir da classificação de cobertura técnica veterinária municipal já publicada
no módulo Deserto Veterinário (prospeccao.v_white_space_pecuaria), o funil real
de promoção e o catálogo de regras. Não gera candidatas, não inventa decisores
nem contatos e não autoriza abordagem comercial automática.
"""

import hashlib
from datetime import datetime, timezone

from database import get_connection, release_connection
from psycopg2.extras import RealDictCursor

ENGINE_STATUS = "VALIDATION"
ENGINE_NAME = "Radar de Sinais Agro"
ENGINE_VERSION = "territorial-v1"
ACTIVE_RULES = 1
AVAILABLE_STAGES = ["SIGNAL"]

RULE_ID = "TECHNICAL_COVERAGE_GAP_MUNICIPAL_V1"
RULE_VERSION = "1.0"
RULE_NAME = "Lacuna de cobertura técnica veterinária municipal"
RULE_DESCRIPTION = (
    "Identifica municípios com deficiência de cobertura técnica veterinária a partir da "
    "classificação territorial já publicada no módulo Deserto Veterinário."
)
RULE_CRITERIA = [
    "classificação existente = DESERTO_VET",
    "ou classificação existente = BAIXA_COBERTURA",
    "municípios classificados como NORMAL não geram sinal",
    "prioridade ALTA para DESERTO_VET e MÉDIA para BAIXA_COBERTURA",
    "sem score numérico e sem pesos secretos",
]
RULE_SOURCES = ["prospeccao.v_white_space_pecuaria", "IBGE PPM 2023"]

SOURCE_VIEW = "prospeccao.v_white_space_pecuaria"
SOURCES = ["prospeccao.v_white_space_pecuaria", "IBGE PPM 2023"]
COMPETENCIA = "IBGE PPM 2023"
RAIO_KM = 75

SIGNAL_LIMITATIONS = [
    "A classificação é territorial.",
    "Não prova demanda individual de uma fazenda.",
    "Não identifica automaticamente comprador.",
    "Não identifica automaticamente decisor.",
    "Não comprova ausência absoluta de profissionais.",
    "Depende das fontes disponíveis.",
    "Não autoriza abordagem comercial automática.",
]

PLANNED_RULES = [
    {
        "rule_id": "AGRO_COMPANY_IN_PRIORITY_TERRITORY_V1",
        "name": "Empresa agro em território prioritário",
        "version": "1.0",
        "status": "PLANNED",
        "produces_stage": "CANDIDATE",
        "entity_type": "EMPRESA",
        "description": "Identificar empresas com atividade agropecuária localizadas em municípios com sinal territorial ativo.",
        "criteria": [],
        "sources": [],
        "limitations": ["Regra planejada; não gera registros nesta versão."],
        "unavailable_reason": None,
    },
    {
        "rule_id": "TECHNICAL_CHANNEL_GAP_V1",
        "name": "Lacuna de canal técnico",
        "version": "1.0",
        "status": "PLANNED",
        "produces_stage": "CANDIDATE",
        "entity_type": "CANAL_TECNICO",
        "description": "Comparar a oferta de profissionais e estabelecimentos veterinários com a demanda bovina municipal.",
        "criteria": [],
        "sources": [],
        "limitations": ["Regra planejada; não gera registros nesta versão."],
        "unavailable_reason": None,
    },
    {
        "rule_id": "GENETIC_DEMAND_MATCH_V1",
        "name": "Correspondência de demanda genética",
        "version": "1.0",
        "status": "PLANNED",
        "produces_stage": "CANDIDATE",
        "entity_type": "PECUARIA",
        "description": "Cruzar perfis de rebanho com oferta de material genético a partir das bases aprovadas de genética.",
        "criteria": [],
        "sources": [],
        "limitations": ["Regra planejada; não gera registros nesta versão."],
        "unavailable_reason": None,
    },
    {
        "rule_id": "AGRO_LOGISTICS_GAP_V1",
        "name": "Lacuna agro-logística",
        "version": "1.0",
        "status": "PLANNED",
        "produces_stage": "CANDIDATE",
        "entity_type": "MUNICIPIO",
        "description": "Identificar municípios com escoamento deficiente a partir das bases aprovadas de agro-logística.",
        "criteria": [],
        "sources": [],
        "limitations": ["Regra planejada; não gera registros nesta versão."],
        "unavailable_reason": None,
    },
]

PROPERTY_RULE_UNAVAILABLE_REASON = (
    "Consulta auditada sobre o catálogo de propriedades rurais (prospeccao.imovel_rural, "
    "8.291.331 cadastros) em municípios classificados excedeu a meta de desempenho de 5s "
    "(13,47s para a primeira página). Sem índice dedicado para o join nacional, a geração "
    "de candidatas não atende ao critério documental de desempenho. "
    "Fail-closed: nenhuma candidata é gerada."
)

PROPERTY_SOURCES = [
    "prospeccao.fazenda_deserto",
    "prospeccao.fazenda_ibge",
    "prospeccao.imovel_rural",
    "prospeccao.v_white_space_pecuaria",
    "/api/v1/agro/imoveis",
]

PROPERTY_BLOCKERS = [
    {
        "code": "PROPERTY_QUERY_NOT_PERFORMANT",
        "description": "A consulta nacional paginada excedeu cinco segundos; nenhuma candidata será produzida sob demanda.",
    }
]

VALIDATION_CHECKLIST = [
    {"item": "Persistência da fila", "status": "UNAVAILABLE"},
    {"item": "Identidade do validador", "status": "UNAVAILABLE"},
    {"item": "Aceite ou rejeição", "status": "PLANNED"},
    {"item": "Motivo da decisão", "status": "PLANNED"},
    {"item": "Data e hora", "status": "PLANNED"},
    {"item": "Histórico", "status": "UNAVAILABLE"},
    {"item": "Auditoria", "status": "UNAVAILABLE"},
    {"item": "Controle de concorrência", "status": "UNAVAILABLE"},
]


def _query(sql: str, params: list | None = None) -> list[dict]:
    # A view territorial pertence ao contrato read-only canônico servido por
    # wins_hub_api_ro. O papel de domínio Agro é legado e não possui SELECT
    # nesta view; usar o pool canônico evita grants ou mutações de banco.
    conn = get_connection()
    try:
        conn.set_session(readonly=True, autocommit=False)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SET LOCAL statement_timeout = %s", (120000,))
            cur.execute(sql, params or [])
            rows = [dict(row) for row in cur.fetchall()]
        conn.rollback()
        return rows
    finally:
        release_connection(conn)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _signal_id(codigo_ibge) -> str:
    raw = f"{RULE_ID}|{codigo_ibge}|2023"
    return "SIG-" + hashlib.sha256(raw.encode("utf-8")).hexdigest()[:20]


def _evidence(classification: str) -> str:
    if classification == "DESERTO_VET":
        return (
            "Município classificado como Deserto Veterinário pela relação entre rebanho "
            "bovino e cobertura técnica regional disponível."
        )
    return (
        "Município classificado com baixa cobertura técnica veterinária segundo os dados "
        "territoriais disponíveis."
    )


class AgroRadarRepository:
    @staticmethod
    def status() -> dict:
        return {
            "engine_status": ENGINE_STATUS,
            "engine_name": ENGINE_NAME,
            "engine_version": ENGINE_VERSION,
            "last_evaluated_at": _now_iso(),
            "commercial_queue_available": False,
            "human_validation_available": False,
            "active_rules": ACTIVE_RULES,
            "available_stages": AVAILABLE_STAGES,
            "sources": SOURCES,
            "source_status": [
                {"source": SOURCE_VIEW, "status": "ok", "competencia": COMPETENCIA}
            ],
            "limitations": [
                "O motor avalia as fontes sob demanda; não há agendamento persistido de execução.",
                "Não há fila comercial persistida nem validação humana nesta versão.",
            ],
        }

    @staticmethod
    def universe() -> int:
        rows = _query("SELECT count(*)::int AS total FROM prospeccao.v_white_space_pecuaria")
        return int(rows[0]["total"]) if rows else 0

    @staticmethod
    def stages() -> dict:
        funnel = AgroRadarRepository.funnel()
        signal_count = funnel.get("signals_total")
        stages = [
            {
                "stage": "SIGNAL", "label": "Sinais", "status": "ACTIVE", "available": True,
                "record_count": signal_count,
                "description": "Sinais territoriais reais de lacuna de cobertura técnica veterinária.",
                "entry_criteria": ["Município presente na fonte territorial aprovada."],
                "exit_criteria": ["Regra de promoção comprovada e executável."],
                "required_fields": ["codigo_ibge", "municipio", "uf", "classificacao_vet"],
                "blockers": [], "next_action": None,
            },
            {
                "stage": "CANDIDATE", "label": "Candidatas", "status": "UNAVAILABLE", "available": False,
                "record_count": 0,
                "description": "Propriedades reais elegíveis somente após vínculo territorial exato e consulta performática.",
                "entry_criteria": ["Propriedade persistida", "CAR real", "código IBGE exato", "detalhe disponível", "fonte SICAR/CAR"],
                "exit_criteria": ["Necessidade produtiva confirmada por validação humana."],
                "required_fields": ["property_id", "detail_id", "codigo_car", "codigo_ibge", "municipio", "uf", "fonte_principal"],
                "blockers": PROPERTY_BLOCKERS,
                "next_action": "Disponibilizar consulta paginada indexada abaixo de cinco segundos e repetir a auditoria.",
            },
            {
                "stage": "VALIDATION", "label": "Em validação", "status": "UNAVAILABLE", "available": False,
                "record_count": 0,
                "description": "Prontidão do futuro fluxo humano; nenhuma fila persistida existe nesta versão.",
                "entry_criteria": ["Candidata persistida", "entidade identificável", "evidência territorial", "fonte e data", "responsável humano"],
                "exit_criteria": ["Decisão humana registrada com motivo, data e auditoria."],
                "required_fields": ["candidate_id", "validator_id", "decision", "reason", "decided_at"],
                "blockers": [{"code": "HUMAN_WORKFLOW_NOT_PERSISTED", "description": "Fila, identidade e histórico de decisão ainda não estão persistidos."}],
                "next_action": "Projetar persistência e auditoria em entrega futura, sem ativar controles agora.",
                "readiness": VALIDATION_CHECKLIST,
            },
            {
                "stage": "VALIDATED", "label": "Validadas", "status": "UNAVAILABLE", "available": False,
                "record_count": 0,
                "description": "Oportunidades comerciais somente após evidência e validação humana comprovadas.",
                "entry_criteria": ["Oportunidade persistida", "entidade acionável", "necessidade confirmada", "contato classificado", "validação humana"],
                "exit_criteria": ["Próximo passo, responsável e limitações registrados."],
                "required_fields": ["opportunity_id", "entity_id", "confirmed_need", "responsible", "validated_at", "rule_version"],
                "blockers": [
                    {"code": "CANDIDATES_UNAVAILABLE", "description": "Candidatas estão indisponíveis ou em total zero."},
                    {"code": "HUMAN_WORKFLOW_UNAVAILABLE", "description": "Workflow humano indisponível."},
                    {"code": "NO_VALIDATED_CONTACTS", "description": "Contatos pessoais validados: zero."},
                    {"code": "COMMERCIAL_DECISION_NOT_PROVEN", "description": "Decisão comercial não comprovada."},
                ],
                "next_action": "Manter a política fail-closed até existir validação humana auditável.",
            },
        ]
        return {
            "engine_status": ENGINE_STATUS,
            "stages": stages,
            "sources": SOURCES + PROPERTY_SOURCES,
            "limitations": ["Nenhum estágio promove registros automaticamente.", "Nenhuma fila comercial está disponível."],
        }

    @staticmethod
    def signals(page=1, page_size=25, stage="SIGNAL", q=None, uf=None, municipio=None,
                signal_type=None, classification=None, priority=None, rule_id=None,
                sort="priority", order="desc") -> dict:
        if stage != "SIGNAL":
            return {
                "engine_status": ENGINE_STATUS,
                "stage": stage,
                "items": [],
                "filtered_total": 0,
                "page": page,
                "page_size": page_size,
                "total_pages": 0,
                "has_previous": False,
                "has_next": False,
                "source_object": None,
                "universe": {"description": "Municípios avaliados pela regra territorial de cobertura técnica veterinária", "total_evaluated": 0},
                "status": "ok",
                "sources": SOURCES,
                "limitations": ["Nenhum registro neste estágio nesta versão do motor."],
            }

        where = ["replace(w.classificacao_vet,' ','_') IN ('DESERTO_VET','BAIXA_COBERTURA')"]
        params: list = []

        if rule_id is not None and rule_id != RULE_ID:
            return {
                "engine_status": ENGINE_STATUS, "stage": stage, "items": [],
                "filtered_total": 0, "page": page, "page_size": page_size,
                "total_pages": 0, "has_previous": False, "has_next": False,
                "source_object": SOURCE_VIEW,
                "universe": {"description": "Municípios avaliados pela regra territorial de cobertura técnica veterinária", "total_evaluated": 0},
                "status": "ok", "sources": SOURCES,
                "limitations": ["Regra desconhecida; nenhum sinal é apresentado."],
            }
        if signal_type is not None and signal_type != "TECHNICAL_COVERAGE_GAP_MUNICIPAL":
            return {
                "engine_status": ENGINE_STATUS, "stage": stage, "items": [],
                "filtered_total": 0, "page": page, "page_size": page_size,
                "total_pages": 0, "has_previous": False, "has_next": False,
                "source_object": SOURCE_VIEW,
                "universe": {"description": "Municípios avaliados pela regra territorial de cobertura técnica veterinária", "total_evaluated": 0},
                "status": "ok", "sources": SOURCES,
                "limitations": ["Tipo de sinal desconhecido; nenhum sinal é apresentado."],
            }
        if q:
            where.append("w.nome ILIKE %s")
            params.append(f"%{q}%")
        if uf:
            where.append("w.uf = %s")
            params.append(uf.upper())
        if municipio:
            where.append("w.nome ILIKE %s")
            params.append(f"%{municipio}%")
        if classification:
            if classification not in ("DESERTO_VET", "BAIXA_COBERTURA"):
                classification = "NORMAL"
            where.append("replace(w.classificacao_vet,' ','_') = %s")
            params.append(classification)
        if priority:
            mapped = {"ALTA": "DESERTO_VET", "MEDIA": "BAIXA_COBERTURA"}.get(priority.upper())
            if mapped:
                where.append("replace(w.classificacao_vet,' ','_') = %s")
                params.append(mapped)
            else:
                where.append("FALSE")

        size = page_size if page_size in (25, 50, 100) else 25
        safe_page = max(1, page)
        offset = (safe_page - 1) * size
        clause = " AND ".join(where)

        sort_columns = {
            "priority": "CASE WHEN replace(w.classificacao_vet,' ','_')='DESERTO_VET' THEN 1 ELSE 2 END",
            "municipio": "w.nome",
            "uf": "w.uf",
            "rebanho_bovino": "w.bovinos",
            "bovinos_por_tecnico": "w.carga_regional",
            "calculated_at": "w.codigo_ibge",
        }
        if sort == "priority" and str(order).lower() == "desc":
            ordering = (
                "CASE WHEN replace(w.classificacao_vet,' ','_')='DESERTO_VET' THEN 1 ELSE 2 END DESC, "
                "w.carga_regional DESC NULLS LAST, w.nome ASC, w.codigo_ibge ASC"
            )
        else:
            col = sort_columns.get(sort, "w.codigo_ibge")
            direction = "DESC" if str(order).lower() == "desc" else "ASC"
            ordering = f"{col} {direction} NULLS LAST, w.nome ASC, w.codigo_ibge ASC"

        try:
            count_rows = _query(
                f"""SELECT count(*)::int AS total,
                           (SELECT count(*)::int FROM prospeccao.v_white_space_pecuaria) AS universe_total
                    FROM prospeccao.v_white_space_pecuaria w WHERE {clause}""",
                params,
            )
            filtered_total = int(count_rows[0]["total"]) if count_rows else 0
            universe_total = int(count_rows[0]["universe_total"]) if count_rows else 0
            rows = _query(
                f"""SELECT w.codigo_ibge, w.nome, w.uf, w.bovinos, w.tecnicos_75km,
                           w.bovinos_75km, w.carga_regional,
                           replace(w.classificacao_vet,' ','_') AS classification
                    FROM prospeccao.v_white_space_pecuaria w
                    WHERE {clause}
                    ORDER BY {ordering}
                    LIMIT %s OFFSET %s""",
                params + [size, offset],
            )
            items = []
            for r in rows:
                cls = r["classification"]
                items.append({
                    "signal_id": _signal_id(r["codigo_ibge"]),
                    "stage": "SIGNAL",
                    "signal_type": "TECHNICAL_COVERAGE_GAP_MUNICIPAL",
                    "entity_type": "MUNICIPIO",
                    "entity_id": str(r["codigo_ibge"]),
                    "municipio": r["nome"],
                    "uf": r["uf"],
                    "priority": "ALTA" if cls == "DESERTO_VET" else "MEDIA",
                    "classification": cls,
                    "evidence_summary": _evidence(cls),
                    "metrics": {
                        "rebanho_bovino": r["bovinos"],
                        "tecnicos_regionais": r["tecnicos_75km"],
                        "bovinos_por_tecnico": r["carga_regional"],
                        "raio_km": RAIO_KM,
                    },
                    "rule": {
                        "rule_id": RULE_ID,
                        "version": RULE_VERSION,
                        "description": RULE_DESCRIPTION,
                    },
                    "sources": SOURCES,
                    "reference_date": None,
                    "calculated_at": _now_iso(),
                    "actionability": "REQUIRES_ENRICHMENT",
                    "missing_fields": [],
                    "limitations": SIGNAL_LIMITATIONS,
                    "next_step": "Identificar propriedades, empresas e canais técnicos do município antes de qualquer abordagem comercial.",
                })
            total_pages = (filtered_total + size - 1) // size if filtered_total else 0
            return {
                "engine_status": ENGINE_STATUS,
                "stage": stage,
                "items": items,
                "filtered_total": filtered_total,
                "page": safe_page,
                "page_size": size,
                "total_pages": total_pages,
                "has_previous": safe_page > 1,
                "has_next": safe_page < total_pages,
                "source_object": SOURCE_VIEW,
                "universe": {
                    "description": "Municípios avaliados pela regra territorial de cobertura técnica veterinária",
                    "total_evaluated": universe_total,
                },
                "status": "ok",
                "sources": SOURCES,
                "limitations": SIGNAL_LIMITATIONS,
            }
        except Exception as exc:
            import logging
            logging.getLogger("wins_hub_api.agro_radar").warning("Falha ao listar sinais: %s", exc)
            return {
                "engine_status": ENGINE_STATUS,
                "stage": stage,
                "items": [],
                "filtered_total": 0,
                "page": safe_page,
                "page_size": size,
                "total_pages": 0,
                "has_previous": False,
                "has_next": False,
                "source_object": SOURCE_VIEW,
                "universe": {"description": "Municípios avaliados pela regra territorial de cobertura técnica veterinária", "total_evaluated": 0},
                "status": "partial",
                "sources": SOURCES,
                "limitations": ["Não foi possível carregar os sinais territoriais neste momento."],
            }

    @staticmethod
    def funnel() -> dict:
        try:
            rows = _query(
                """SELECT replace(classificacao_vet,' ','_') AS classification,
                          count(*)::int AS total
                   FROM prospeccao.v_white_space_pecuaria
                   GROUP BY 1"""
            )
            by = {r["classification"]: int(r["total"]) for r in rows}
            municipalities = sum(by.values())
            deserto = by.get("DESERTO_VET", 0)
            baixa = by.get("BAIXA_COBERTURA", 0)
            normal = by.get("NORMAL", 0)
            signals = deserto + baixa
            return {
                "engine_status": ENGINE_STATUS,
                "municipalities_evaluated": municipalities,
                "signals_total": signals,
                "deserto_vet_signals": deserto,
                "low_coverage_signals": baixa,
                "candidates_total": 0,
                "validation_total": 0,
                "validated_total": 0,
                "discarded_or_not_promoted": {
                    "normal_coverage": normal,
                    "missing_entity": None,
                    "missing_contact": None,
                    "missing_decision_evidence": None,
                    "promotion_unavailable": signals,
                },
                "sources": SOURCES,
                "limitations": [
                    "As razões missing_entity, missing_contact e missing_decision_evidence não podem ser calculadas sem execução de resolução de entidades e contatos.",
                    "A regra de candidatas (PROPERTY_IN_TECHNICAL_GAP_V1) está UNAVAILABLE; os sinais permanecem sem regra de promoção nesta versão.",
                ],
            }
        except Exception as exc:
            import logging
            logging.getLogger("wins_hub_api.agro_radar").warning("Falha no funil: %s", exc)
            return {
                "engine_status": ENGINE_STATUS,
                "municipalities_evaluated": None,
                "signals_total": None,
                "deserto_vet_signals": None,
                "low_coverage_signals": None,
                "candidates_total": 0,
                "validation_total": 0,
                "validated_total": 0,
                "discarded_or_not_promoted": {
                    "normal_coverage": None,
                    "missing_entity": None,
                    "missing_contact": None,
                    "missing_decision_evidence": None,
                    "promotion_unavailable": None,
                },
                "sources": SOURCES,
                "limitations": ["Não foi possível calcular o funil de sinais neste momento."],
            }

    @staticmethod
    def rules() -> dict:
        funnel = AgroRadarRepository.funnel()
        evaluated_at = _now_iso()
        active_rule = {
            "rule_id": RULE_ID,
            "name": RULE_NAME,
            "version": RULE_VERSION,
            "status": "ACTIVE",
            "produces_stage": "SIGNAL",
            "entity_type": "MUNICIPIO",
            "description": RULE_DESCRIPTION,
            "criteria": RULE_CRITERIA,
            "sources": RULE_SOURCES,
            "limitations": SIGNAL_LIMITATIONS,
            "unavailable_reason": None,
            "blockers": [],
            "produced_count": funnel.get("signals_total"),
            "last_evaluated_at": evaluated_at,
            "last_duration_ms": None,
            "required_fields": ["codigo_ibge", "municipio", "uf", "classificacao_vet"],
            "exclusion_criteria": ["classificação NORMAL"],
            "output_contract": "TerritorialSignal",
            "metrics": ["bovinos", "tecnicos_75km", "carga_regional"],
        }
        property_rule = {
            "rule_id": "PROPERTY_IN_TECHNICAL_GAP_V1",
            "name": "Propriedade em lacuna técnica",
            "version": "1.0",
            "status": "UNAVAILABLE",
            "produces_stage": "CANDIDATE",
            "entity_type": "PROPRIEDADE",
            "description": "Gerar candidatas de propriedades rurais com CAR real localizadas em municípios classificados.",
            "criteria": [
                "município DESERTO_VET ou BAIXA_COBERTURA",
                "propriedade com identificador persistido",
                "código CAR real",
                "município e UF",
                "ligação territorial confiável com município classificado",
                "detalhe disponível",
                "fonte SICAR/CAR identificada",
                "completude mínima calculada",
                "query abaixo da meta de desempenho",
                "nenhuma propriedade inferida por aproximação",
                "nenhuma pessoa ou contato atribuído sem evidência",
            ],
            "sources": PROPERTY_SOURCES,
            "limitations": ["Nenhuma candidata gerada enquanto a regra estiver indisponível."],
            "unavailable_reason": PROPERTY_RULE_UNAVAILABLE_REASON,
            "blockers": PROPERTY_BLOCKERS,
            "produced_count": 0,
            "last_evaluated_at": evaluated_at,
            "last_duration_ms": 13470,
            "required_fields": ["property_id", "detail_id", "codigo_car", "codigo_ibge", "municipio", "uf", "fonte_principal"],
            "exclusion_criteria": ["join municipal não exato", "detalhe ausente", "consulta acima de cinco segundos"],
            "output_contract": "PropertyCandidate",
            "metrics": [],
        }
        planned_rules = [
            {
                **rule,
                "blockers": [], "produced_count": 0, "last_evaluated_at": None,
                "last_duration_ms": None, "required_fields": [], "exclusion_criteria": [],
                "output_contract": None, "metrics": [],
            }
            for rule in PLANNED_RULES
        ]
        return {
            "engine_status": ENGINE_STATUS,
            "rules": [active_rule, property_rule] + planned_rules,
            "summary": {
                "total": 6, "active": 1, "unavailable": 1, "planned": 4,
                "signals_generated": funnel.get("signals_total"), "candidates_generated": 0,
            },
            "sources": SOURCES,
            "limitations": [
                "Regras PLANNED ou UNAVAILABLE não geram registros nesta versão.",
                "Nenhuma promoção automática para VALIDATED.",
            ],
        }

    @staticmethod
    def candidates(page=1, page_size=25, q=None, uf=None, municipio=None,
                   candidate_type=None, priority=None, com_cnpj=None,
                   com_titular=None, completude_min=None) -> dict:
        return {
            "engine_status": ENGINE_STATUS,
            "stage": "CANDIDATE",
            "items": [],
            "filtered_total": 0,
            "page": page,
            "page_size": page_size,
            "total_pages": 0,
            "has_previous": False,
            "has_next": False,
            "source_object": None,
            "universe": {"description": "Nenhum universo de candidatas calculado nesta versão.", "total_evaluated": 0},
            "status": "ok",
            "rule_status": "UNAVAILABLE",
            "blockers": PROPERTY_BLOCKERS,
            "criteria": AgroRadarRepository.stages()["stages"][1]["entry_criteria"],
            "available_evidence": [
                "8.291.331 propriedades possuem CAR e código IBGE persistidos.",
                "CAR é único no catálogo auditado.",
                "O detalhe canônico usa o identificador persistido da propriedade.",
            ],
            "missing_requirements": ["Consulta paginada indexada abaixo de cinco segundos."],
            "sources": PROPERTY_SOURCES,
            "limitations": [
                "A regra PROPERTY_IN_TECHNICAL_GAP_V1 está UNAVAILABLE; nenhuma candidata é gerada.",
                PROPERTY_RULE_UNAVAILABLE_REASON,
            ],
        }
