import logging
from datetime import date
from typing import Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from auth import get_current_user, require_permission
from repositories import (
    HealthRepository, DashboardRepository, EventosRepository,
    IndicadoresRepository
)
from wave1_repository import Wave1Repository
from agro_canal_repository import AgroCanalRepository
from agro_properties_repository import AgroPropertiesRepository
from agro_people_repository import AgroPeopleRepository
from agro_holdings_repository import AgroHoldingsRepository
from agro_radar_repository import AgroRadarRepository


class ReviewRequest(BaseModel):
    classificacao_nova: str
    justificativa: str

logger = logging.getLogger("wins_hub_api.routes")

router = APIRouter(prefix="/api/v1")

# Standardized Error response helper
def standard_error(code: str, message: str, req_id: str, status_code: int = 400, retryable: bool = None):
    content = {
        "code": code,
        "message": message,
        "requestId": req_id,
        "details": None
    }
    if retryable is not None:
        content["retryable"] = retryable
    return JSONResponse(
        status_code=status_code,
        content=content
    )

@router.get("/health")
def health_check(request: Request):
    req_id = getattr(request.state, "request_id", "unknown")
    db_ok = HealthRepository.check_db_health()
    if not db_ok:
        logger.error(f"Healthcheck falhou para a conexão ao banco. RequestID: {req_id}")
        return JSONResponse(
            status_code=503,
            content={"status": "error"}
        )
    return {"status": "ok"}

@router.get("/dashboard/kpis")
def get_kpis(request: Request, user = Depends(get_current_user)):
    req_id = getattr(request.state, "request_id", "unknown")
    try:
        kpis = DashboardRepository.get_kpis()
        return kpis
    except Exception as e:
        logger.error(f"Erro ao buscar KPIs: {e}")
        return standard_error("INTERNAL_SERVER_ERROR", "Error fetching dashboard KPIs", req_id, 500)

@router.get("/eventos")
def get_events(request: Request, limit: int = 50, user = Depends(get_current_user)):
    req_id = getattr(request.state, "request_id", "unknown")
    try:
        events = EventosRepository.get_all(limit=limit)
        return events
    except Exception as e:
        logger.error(f"Erro ao listar eventos: {e}")
        return standard_error("INTERNAL_SERVER_ERROR", "Error fetching events", req_id, 500)

@router.get("/eventos/{id}")
def get_event_by_id(id: str, request: Request, user = Depends(get_current_user)):
    req_id = getattr(request.state, "request_id", "unknown")
    try:
        event = EventosRepository.get_by_id(id)
        if not event:
            return standard_error("EVENT_NOT_FOUND", "Evento não encontrado", req_id, 404)
        return event
    except Exception as e:
        logger.error(f"Erro ao buscar detalhes do evento {id}: {e}")
        return standard_error("INTERNAL_SERVER_ERROR", "Error fetching event details", req_id, 500)

@router.get("/indicadores")
def get_indicators(request: Request, user = Depends(get_current_user)):
    req_id = getattr(request.state, "request_id", "unknown")
    try:
        indicators = IndicadoresRepository.get_all()
        return indicators
    except Exception as e:
        logger.error(f"Erro ao buscar indicadores: {e}")
        return standard_error("INTERNAL_SERVER_ERROR", "Error fetching indicators", req_id, 500)

@router.get("/empresas")
def get_companies(request: Request, page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100),
                  cnpj: Optional[str] = None, search: Optional[str] = Query(None, max_length=120),
                  uf: Optional[str] = Query(None, min_length=2, max_length=2), active: Optional[bool] = None,
                  sort: str = "updated_desc", user = Depends(require_permission("empresa360"))):
    req_id = getattr(request.state, "request_id", "unknown")
    try:
        companies = Wave1Repository.companies(page=page, page_size=page_size, search=search, cnpj=cnpj, uf=uf, active=active, sort=sort)
        return companies
    except Exception as e:
        logger.error(f"Erro ao listar empresas: {e}")
        return standard_error("INTERNAL_SERVER_ERROR", "Error fetching companies", req_id, 500)

@router.get("/empresas/{id}")
def get_company_by_id(id: str, request: Request, user = Depends(require_permission("empresa360"))):
    req_id = getattr(request.state, "request_id", "unknown")
    try:
        company = Wave1Repository.company(id)
        if not company:
            return standard_error("COMPANY_NOT_FOUND", "Empresa não encontrada", req_id, 404)
        return company
    except Exception as e:
        logger.error(f"Erro ao obter detalhes da empresa {id}: {e}")
        return standard_error("INTERNAL_SERVER_ERROR", "Error fetching company details", req_id, 500)

@router.get("/oportunidades")
def get_opportunities(request: Request, page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100),
                      work_id: Optional[str] = None, cnpj: Optional[str] = None, min_score: Optional[float] = None,
                      user = Depends(require_permission("engenharia"))):
    req_id = getattr(request.state, "request_id", "unknown")
    try:
        opps = Wave1Repository.opportunities(page=page, page_size=page_size, work_id=work_id, cnpj=cnpj, min_score=min_score)
        return opps
    except Exception as e:
        logger.error(f"Erro ao listar oportunidades: {e}")
        return standard_error("INTERNAL_SERVER_ERROR", "Error fetching opportunities", req_id, 500)

@router.get("/engenharia/obras")
def wave1_works(request: Request, page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100),
                search: Optional[str] = Query(None, max_length=120), municipality: Optional[str] = Query(None, max_length=100),
                uf: Optional[str] = Query(None, min_length=2, max_length=2), status: Optional[str] = Query(None, max_length=80),
                phase: Optional[str] = Query(None, max_length=80), sector: Optional[str] = Query(None, max_length=120),
                priority: Optional[str] = Query(None, max_length=50), capex_class: Optional[str] = Query(None, max_length=50),
                source: Optional[str] = Query(None, max_length=120),
                company: Optional[str] = Query(None, max_length=160), investment_min: Optional[float] = Query(None, ge=0),
                investment_max: Optional[float] = Query(None, ge=0), period_start: Optional[date] = None,
                period_end: Optional[date] = None, has_supplier: Optional[bool] = None,
                has_decision_maker: Optional[bool] = None, has_opportunity: Optional[bool] = None,
                has_inputs: Optional[bool] = None, has_supply_chain: Optional[bool] = None,
                capex_homologado: Optional[bool] = None,
                sort: Literal["updated_desc", "updated_asc", "name_asc", "name_desc", "investment_desc", "investment_asc", "start_desc", "start_asc", "priority_desc", "municipality_asc", "phase_asc", "sector_asc"] = "updated_desc",
                user=Depends(require_permission("engenharia"))):
    if investment_min is not None and investment_max is not None and investment_min > investment_max:
        raise HTTPException(422, "investment_min não pode ser maior que investment_max")
    if period_start and period_end and period_start > period_end:
        raise HTTPException(422, "period_start não pode ser posterior a period_end")
    return Wave1Repository.works(page=page, page_size=page_size, search=search, municipality=municipality,
        uf=uf, status=status, phase=phase, sector=sector, priority=priority, capex_class=capex_class,
        source=source, company=company, investment_min=investment_min, investment_max=investment_max,
        period_start=period_start, period_end=period_end, has_supplier=has_supplier,
        has_decision_maker=has_decision_maker, has_opportunity=has_opportunity,
        has_inputs=has_inputs, has_supply_chain=has_supply_chain,
        capex_homologado=capex_homologado, sort=sort)

@router.get("/engenharia/obras/{id}")
def wave1_work(id: str, request: Request, user=Depends(require_permission("engenharia"))):
    record = Wave1Repository.work(id)
    if not record:
        return standard_error("WORK_NOT_FOUND", "Obra não encontrada", request.state.request_id, 404)
    return record

@router.get("/engenharia/mapa")
def engineering_map(request: Request, min_lat: float = Query(-35.5, ge=-90, le=90), max_lat: float = Query(6.5, ge=-90, le=90),
                    min_lng: float = Query(-75.5, ge=-180, le=180), max_lng: float = Query(-32, ge=-180, le=180),
                    zoom: int = Query(4, ge=3, le=18), layers: str = Query("works,companies,suppliers,opportunities"),
                    search: Optional[str] = None, municipality: Optional[str] = None, uf: Optional[str] = Query(None, min_length=2, max_length=2),
                    status: Optional[str] = None, phase: Optional[str] = None, sector: Optional[str] = None, company: Optional[str] = None,
                    has_opportunity: Optional[bool] = None, capex_homologado: Optional[bool] = None,
                    user=Depends(require_permission("engenharia"))):
    if min_lat >= max_lat or min_lng >= max_lng: raise HTTPException(422, "bounding box inválido")
    allowed={"works","companies","suppliers","opportunities"}; selected=[x for x in layers.split(",") if x in allowed]
    if not selected:
        return {
            "clusters": [], "totals": {}, "total": 0, "zoom": zoom,
            "gridDegrees": None,
            "bbox": {"min_lat": min_lat, "max_lat": max_lat, "min_lng": min_lng, "max_lng": max_lng},
            "layers": [], "strategy": "empty_layers", "sampled": False,
            "truncated": False, "filters": {},
        }
    return Wave1Repository.engineering_map(min_lat=min_lat,max_lat=max_lat,min_lng=min_lng,max_lng=max_lng,zoom=zoom,layers=selected,
      search=search,municipality=municipality,uf=uf,status=status,phase=phase,sector=sector,company=company,
      has_opportunity=has_opportunity,capex_homologado=capex_homologado)

@router.get("/engenharia/conexoes")
def engineering_connections(request: Request, search: Optional[str] = None, municipality: Optional[str] = None,
                            uf: Optional[str] = Query(None, min_length=2, max_length=2), status: Optional[str] = None,
                            phase: Optional[str] = None, sector: Optional[str] = None, company: Optional[str] = None,
                            has_opportunity: Optional[bool] = None, capex_homologado: Optional[bool] = None,
                            user=Depends(require_permission("engenharia"))):
    return Wave1Repository.engineering_connections(search=search,municipality=municipality,uf=uf,status=status,phase=phase,
      sector=sector,company=company,has_opportunity=has_opportunity,capex_homologado=capex_homologado)

@router.get("/engenharia/projetos")
def wave1_projects(request: Request, page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100),
                   search: Optional[str] = Query(None, max_length=120), municipality: Optional[str] = None,
                   uf: Optional[str] = Query(None, min_length=2, max_length=2), status: Optional[str] = None,
                   sort: str = "updated_desc", user=Depends(require_permission("engenharia"))):
    return Wave1Repository.projects(page=page, page_size=page_size, search=search, municipality=municipality, uf=uf, status=status, sort=sort)

@router.get("/fornecedores")
def wave1_suppliers(request: Request, page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100),
                    search: Optional[str] = Query(None, max_length=120), cnpj: Optional[str] = None,
                    municipality: Optional[str] = Query(None, max_length=100), uf: Optional[str] = Query(None, min_length=2, max_length=2),
                    active: bool = True, sort: str = "matches_desc", user=Depends(require_permission("empresa360"))):
    return Wave1Repository.suppliers(page, page_size, search, cnpj, municipality, uf, active, sort)

@router.get("/fornecedores/{id}")
def wave1_supplier(id: str, request: Request, user=Depends(require_permission("empresa360"))):
    record=Wave1Repository.supplier(id)
    if not record:return standard_error("SUPPLIER_NOT_FOUND", "Fornecedor não encontrado", request.state.request_id, 404)
    return record

@router.get("/engenharia/fornecedores")
def engineering_executors(request: Request, page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100),
                          search: Optional[str] = Query(None, max_length=120), uf: Optional[str] = Query(None, min_length=2, max_length=2),
                          municipality: Optional[str] = Query(None, max_length=100),
                          especialidade: Optional[str] = Query(None, max_length=100),
                          cnae: Optional[str] = Query(None, max_length=100),
                          sector: Optional[str] = Query(None, max_length=100),
                          classification: Optional[str] = Query(None, max_length=30),
                          situacao_cadastral: Optional[str] = Query(None, max_length=20),
                          porte: Optional[str] = Query(None, max_length=50),
                          has_relationships: Optional[bool] = None,
                          has_confirmed: Optional[bool] = None,
                          has_probable: Optional[bool] = None,
                          has_potential: Optional[bool] = None,
                          has_contact: Optional[bool] = None,
                          has_site: Optional[bool] = None,
                          min_works: Optional[int] = Query(None, ge=0),
                          sort: str = "rel_confirmed_desc", user=Depends(require_permission("engenharia"))):
    req_id = getattr(request.state, "request_id", "unknown")
    try:
        logger.info("Listando prestadores de servico page=%s uf=%s search=%s requestId=%s", page, uf, search, req_id)
        return Wave1Repository.executors(page=page, page_size=page_size, search=search, uf=uf,
          municipality=municipality, especialidade=especialidade, cnae=cnae, sector=sector,
          classification=classification, situacao_cadastral=situacao_cadastral, porte=porte,
          has_relationships=has_relationships, has_confirmed=has_confirmed,
          has_probable=has_probable, has_potential=has_potential,
          has_contact=has_contact, has_site=has_site, min_works=min_works, sort=sort)
    except Exception as e:
        logger.error(f"Erro ao listar executores: {e} requestId={req_id}")
        return standard_error("INTERNAL_SERVER_ERROR", "Error fetching executors", req_id, 500)

@router.get("/engenharia/fornecedores/{id}")
def engineering_executor(id: str, request: Request, user=Depends(require_permission("engenharia"))):
    req_id = getattr(request.state, "request_id", "unknown")
    try:
        record = Wave1Repository.executor(id)
        if not record:
            return standard_error("EXECUTOR_NOT_FOUND", "Executor não encontrado", req_id, 404)
        return record
    except Exception as e:
        logger.error(f"Erro ao buscar executor {id}: {e} requestId={req_id}")
        return standard_error("INTERNAL_SERVER_ERROR", "Error fetching executor", req_id, 500)

@router.get("/engenharia/insumos")
def engineering_input_suppliers(request: Request, page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100),
                                search: Optional[str] = Query(None, max_length=120), uf: Optional[str] = Query(None, min_length=2, max_length=2),
                                categoria: Optional[str] = Query(None, max_length=100), tipo: Optional[str] = Query(None, max_length=30),
                                sort: str = "name_asc", user=Depends(require_permission("engenharia"))):
    req_id = getattr(request.state, "request_id", "unknown")
    try:
        return Wave1Repository.input_suppliers(page=page, page_size=page_size, search=search, uf=uf,
          categoria=categoria, tipo=tipo, sort=sort)
    except Exception as e:
        logger.error(f"Erro ao listar fornecedores de insumos: {e} requestId={req_id}")
        return standard_error("INTERNAL_SERVER_ERROR", "Error fetching input suppliers", req_id, 500)

@router.get("/engenharia/insumos/summary")
def engineering_input_suppliers_summary(request: Request, user=Depends(require_permission("engenharia"))):
    return Wave1Repository.input_suppliers_summary()

@router.get("/engenharia/insumos/facets")
def engineering_input_suppliers_facets(request: Request, user=Depends(require_permission("engenharia"))):
    return Wave1Repository.input_suppliers_facets()

@router.get("/engenharia/insumos/{id}")
def engineering_input_supplier(id: str, request: Request, user=Depends(require_permission("engenharia"))):
    req_id = getattr(request.state, "request_id", "unknown")
    try:
        record = Wave1Repository.input_supplier(id)
        if not record:
            return standard_error("INPUT_SUPPLIER_NOT_FOUND", "Fornecedor de insumo não encontrado", req_id, 404)
        return record
    except Exception as e:
        logger.error(f"Erro ao buscar fornecedor de insumo {id}: {e} requestId={req_id}")
        return standard_error("INTERNAL_SERVER_ERROR", "Error fetching input supplier", req_id, 500)

@router.get("/decisores")
@router.get("/engenharia/decisores")
def wave1_decision_makers(request: Request, page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100),
                          search: Optional[str] = Query(None, max_length=120), title: Optional[str] = Query(None, max_length=100),
                          work_id: Optional[str] = None, user=Depends(require_permission("engenharia"))):
    permissions=set(user.get("permissions", [])) if isinstance(user, dict) else set()
    include_sensitive="decisores:sensitive" in permissions
    logger.info("Acesso a decisores; sensitive=%s subject=%s", include_sensitive, user.get("sub", user.get("name", "unknown")) if isinstance(user,dict) else "unknown")
    return Wave1Repository.decision_makers(page, page_size, search, title, work_id, include_sensitive)

@router.get("/decisores/{id}")
@router.get("/engenharia/decisores/{id}")
def wave1_decision_maker(id: str, request: Request, user=Depends(require_permission("engenharia"))):
    permissions=set(user.get("permissions", [])) if isinstance(user, dict) else set()
    record=Wave1Repository.decision_maker(id,"decisores:sensitive" in permissions)
    if not record:return standard_error("DECISION_MAKER_NOT_FOUND", "Decisor não encontrado", request.state.request_id, 404)
    return record

@router.get("/engenharia/oportunidades")
def engineering_opportunities(request: Request, page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100),
                              work_id: Optional[str] = None, cnpj: Optional[str] = None,
                              min_score: Optional[float] = None, user=Depends(require_permission("engenharia"))):
    return Wave1Repository.opportunities(page=page, page_size=page_size, work_id=work_id, cnpj=cnpj, min_score=min_score)

@router.get("/engenharia/oportunidades/{id}")
def engineering_opportunity(id: str, request: Request, user=Depends(require_permission("engenharia"))):
    record=Wave1Repository.opportunity(id)
    if not record:return standard_error("OPPORTUNITY_NOT_FOUND", "Oportunidade não encontrada", request.state.request_id, 404)
    return record

# === Engineering Work Sub-resources (Supply Chain) ===
@router.get("/engenharia/obras/{id}/executores")
def work_executors(id: str, request: Request, user=Depends(require_permission("engenharia"))):
    req_id = getattr(request.state, "request_id", "unknown")
    try:
        logger.info("Listando executores da obra %s requestId=%s", id, req_id)
        return Wave1Repository.work_executors(id)
    except Exception as e:
        logger.error(f"Erro executores obra {id}: {e} requestId={req_id}")
        return standard_error("INTERNAL_SERVER_ERROR", "Error fetching work executors", req_id, 500)

@router.get("/engenharia/obras/{id}/disciplinas")
def work_disciplinas(id: str, request: Request, user=Depends(require_permission("engenharia"))):
    req_id = getattr(request.state, "request_id", "unknown")
    try:
        return Wave1Repository.work_disciplinas(id)
    except Exception as e:
        logger.error(f"Erro disciplinas obra {id}: {e} requestId={req_id}")
        return standard_error("INTERNAL_SERVER_ERROR", "Error fetching work disciplinas", req_id, 500)

@router.get("/engenharia/obras/{id}/insumos")
def work_insumos(id: str, request: Request, user=Depends(require_permission("engenharia"))):
    req_id = getattr(request.state, "request_id", "unknown")
    try:
        return Wave1Repository.work_insumos(id)
    except Exception as e:
        logger.error(f"Erro insumos obra {id}: {e} requestId={req_id}")
        return standard_error("INTERNAL_SERVER_ERROR", "Error fetching work insumos", req_id, 500)

@router.get("/engenharia/obras/{id}/oportunidades")
def work_opportunities(id: str, request: Request, user=Depends(require_permission("engenharia"))):
    req_id = getattr(request.state, "request_id", "unknown")
    try:
        return Wave1Repository.work_opportunities(id)
    except Exception as e:
        logger.error(f"Erro oportunidades obra {id}: {e} requestId={req_id}")
        return standard_error("INTERNAL_SERVER_ERROR", "Error fetching work opportunities", req_id, 500)

@router.get("/engenharia/obras/{id}/supply-chain")
def work_supply_chain(id: str, request: Request, user=Depends(require_permission("engenharia"))):
    req_id = getattr(request.state, "request_id", "unknown")
    try:
        return Wave1Repository.work_supply_chain(id)
    except Exception as e:
        logger.error(f"Erro supply-chain obra {id}: {e} requestId={req_id}")
        return standard_error("INTERNAL_SERVER_ERROR", "Error fetching work supply chain", req_id, 500)

@router.get("/mapa")
def wave1_map(request: Request, page: int = Query(1, ge=1), page_size: int = Query(100, ge=1, le=100),
              municipality: Optional[str] = None, uf: Optional[str] = Query(None, min_length=2, max_length=2),
              status: Optional[str] = None, user=Depends(require_permission("engenharia"))):
    return Wave1Repository.map_features(page, page_size, municipality, uf, status)

@router.get("/visao-geral/mapa")
def overview_real_map(request: Request, user=Depends(get_current_user)):
    return Wave1Repository.overview_map()

@router.get("/relacionamentos")
def get_relationships(request: Request, cnpj: Optional[str] = None, municipality: Optional[str] = None,
                      uf: Optional[str] = None, work_id: Optional[str] = None, user=Depends(get_current_user)):
    return Wave1Repository.relacionamentos(cnpj=cnpj, municipality=municipality, uf=uf, work_id=work_id)


@router.post("/relacionamentos/{relationship_id}/review", status_code=200)
def review_relationship(relationship_id: str, body: ReviewRequest,
                        request: Request, user=Depends(get_current_user)):
    req_id = getattr(request.state, "request_id", "unknown")

    # Explicit ALLOWLIST check: user must explicitly possess a review role ('admin' or 'relationship_reviewer')
    user_roles = set(user.get("roles", [])) if isinstance(user, dict) else set()
    user_perms = set(user.get("permissions", [])) if isinstance(user, dict) else set()
    user_all_roles = user_roles | user_perms

    REVIEW_ALLOWED_ROLES = {"admin", "relationship_reviewer"}
    if not bool(user_all_roles.intersection(REVIEW_ALLOWED_ROLES)):
        logger.warning(f"[{req_id}] Usuário sem papel de revisão (Allowlist) tentou reclassificar relação: {user.get('sub')}")
        raise HTTPException(status_code=403, detail="Apenas usuários autorizados (admin, relationship_reviewer) podem reclassificar relações")

    # Validate body
    nova = body.classificacao_nova.upper().strip()
    if nova not in ("CONFIRMADO", "PROVÁVEL", "POTENCIAL"):
        raise HTTPException(status_code=422, detail="classificacao_nova deve ser CONFIRMADO, PROVÁVEL ou POTENCIAL")
    justificativa = body.justificativa.strip()
    if not justificativa:
        raise HTTPException(status_code=422, detail="Justificativa é obrigatória")

    # Get previous classification from reviews table (if any)
    prev = Wave1Repository.get_review_status(relationship_id)
    classificacao_anterior = prev["classificacao_nova"] if prev else "POTENCIAL"

    # Identity extracted from Keycloak JWT — not from request body
    user_id = user.get("sub", "unknown")
    username = user.get("preferred_username", user.get("name", "unknown"))
    roles_str = ",".join(sorted(user_roles))

    # Ensure tables exist (safe to call on every review)
    try:
        Wave1Repository.ensure_review_tables()
    except Exception as e:
        logger.error(f"[{req_id}] Erro ao criar tabelas de revisão: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao preparar banco de auditoria")

    # Persist review + audit
    try:
        review = Wave1Repository.save_review(
            relationship_id=relationship_id,
            classificacao_anterior=classificacao_anterior,
            classificacao_nova=nova,
            justificativa=justificativa,
            user_id=user_id,
            username=username,
            roles=roles_str,
        )
        logger.info(f"[{req_id}] Revisão registrada: rel={relationship_id} {classificacao_anterior}→{nova} user={username}")
        return {
            "status": "ok",
            "review": {
                "id": review["id"],
                "relationship_id": review["relationship_id"],
                "classificacao_anterior": review["classificacao_anterior"],
                "classificacao_nova": review["classificacao_nova"],
                "username": review["username"],
                "created_at": review["created_at"].isoformat() if hasattr(review["created_at"], "isoformat") else str(review["created_at"]),
            }
        }
    except Exception as e:
        logger.error(f"[{req_id}] Erro ao persistir revisão: {e}")
        raise HTTPException(status_code=500, detail="Erro ao persistir revisão")

@router.get("/diretorios/catalogo")
def get_directory_catalog(request: Request, user=Depends(get_current_user)):
    return {"items": Wave1Repository.directory_catalog()}

try:
    from apps.api.search_engine import execute_server_side_search, execute_server_side_suggest, MASTER_SERVER_INDEX
except ModuleNotFoundError:
    from search_engine import execute_server_side_search, execute_server_side_suggest, MASTER_SERVER_INDEX

@router.get("/busca-global")
@router.get("/search")
def global_real_search(request: Request,
                        q: str = Query(..., min_length=1, max_length=120),
                        types: Optional[str] = Query(None),
                        verticals: Optional[str] = Query(None),
                        uf: Optional[str] = Query(None),
                        municipality_id: Optional[str] = Query(None),
                        page: int = Query(1, ge=1),
                        page_size: int = Query(20, ge=1, le=100),
                        sort: str = Query("relevancia"),
                        user=Depends(get_current_user)):
    type_list = [t.strip() for t in types.split(",")] if types else None
    vert_list = [v.strip() for v in verticals.split(",")] if verticals else None
    is_admin = user and getattr(user, "roles", None) and "admin" in user.roles
    return execute_server_side_search(
        q=q, types=type_list, verticals=vert_list, uf=uf,
        municipality_id=municipality_id, page=page, page_size=page_size,
        sort=sort, is_admin=is_admin
    )

@router.get("/search/suggest")
def global_suggest(request: Request, q: str = Query(..., min_length=1, max_length=120), user=Depends(get_current_user)):
    return execute_server_side_suggest(q=q)

@router.get("/search/detail")
def global_detail(request: Request, id: str = Query(...), user=Depends(get_current_user)):
    item = next((i for i in MASTER_SERVER_INDEX if i["entity_id"] == id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Entidade não encontrada")
    return item

@router.get("/territorios/municipio")
def real_municipality(request: Request, municipality: str = Query(..., min_length=2, max_length=100),
                      uf: Optional[str] = Query(None, min_length=2, max_length=2),
                      user=Depends(get_current_user)):
    return Wave1Repository.territory(municipality, uf.upper() if uf else None)

@router.get("/diretorios/{vertical}/{entity}")
def get_real_directory(vertical: str, entity: str, request: Request,
                       page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100),
                       search: Optional[str] = Query(None, max_length=120),
                       uf: Optional[str] = Query(None, min_length=2, max_length=2),
                       municipality: Optional[str] = Query(None, max_length=100),
                       sort: Literal["updated_desc", "updated_asc", "name_asc", "name_desc"] = "updated_desc",
                       user=Depends(get_current_user)):
    permissions = set(user.get("permissions", [])) if isinstance(user, dict) else set()
    if vertical not in permissions:
        raise HTTPException(403, "Acesso à vertical não autorizado")
    result = Wave1Repository.directory(vertical, entity, page, page_size, search, uf, municipality, sort)
    if result is None:
        raise HTTPException(404, "Diretório real não encontrado")
    return result

@router.get("/diretorios/{vertical}/{entity}/{source_id}")
def get_real_directory_detail(vertical: str, entity: str, source_id: str, request: Request,
                              user=Depends(get_current_user)):
    permissions = set(user.get("permissions", [])) if isinstance(user, dict) else set()
    if vertical not in permissions:
        raise HTTPException(403, "Acesso à vertical não autorizado")
    result = Wave1Repository.directory_detail(vertical, entity, source_id)
    if result is None:
        raise HTTPException(404, "Entidade real não encontrada")
    return result

@router.get("/agro/imoveis")
def get_agro_imoveis(request: Request, page: int = Query(1, ge=1, le=1000),
                     page_size: int = Query(25, ge=1, le=100), q: Optional[str] = Query(None, max_length=120),
                     uf: Optional[str] = Query(None, min_length=2, max_length=2), municipio: Optional[str] = None,
                     area_min: Optional[float] = Query(None, ge=0), area_max: Optional[float] = Query(None, ge=0),
                     com_titular: Optional[bool] = None, com_cnpj: Optional[bool] = None,
                     com_bioma: Optional[bool] = None, com_uso_solo: Optional[bool] = None,
                     cobertura_veterinaria: Optional[Literal["DESERTO_VET","BAIXA_COBERTURA","NORMAL","INDISPONIVEL"]] = None,
                     geographic_quality: Optional[Literal["PROPERTY_COORDINATE","MISSING","INVALID"]] = None,
                     completude_min: Optional[int] = Query(None, ge=0, le=100),
                     sort: Literal["identifier","area","municipio","uf","updated_at","relevancia","completude","codigo_car"] = "identifier",
                     order: Literal["asc","desc"] = "asc", user=Depends(require_permission("agro"))):
    if page_size not in (25, 50, 100): raise HTTPException(422, "page_size deve ser 25, 50 ou 100")
    return AgroPropertiesRepository.list(page=page,page_size=page_size,q=q,uf=uf,municipio=municipio,
        area_min=area_min,area_max=area_max,cobertura_veterinaria=cobertura_veterinaria,
        geographic_quality=geographic_quality,sort=sort,order=order)

@router.get("/agro/imoveis/resumo")
def get_agro_imoveis_resumo(request: Request,user=Depends(require_permission("agro"))):
    return AgroPropertiesRepository.summary()

@router.get("/agro/imoveis/contexto-territorial")
def get_agro_imoveis_contexto(request:Request,uf:Optional[str]=Query(None,min_length=2,max_length=2),
    municipio:Optional[str]=None,limit:int=Query(100,ge=1,le=500),user=Depends(require_permission("agro"))):
    return AgroPropertiesRepository.municipal_context(uf=uf,municipio=municipio,limit=limit)

@router.get("/agro/imoveis/mapa")
def get_agro_imoveis_mapa(request:Request,uf:Optional[str]=Query(None,min_length=2,max_length=2),
    municipio:Optional[str]=None,bbox:Optional[str]=None,limit:int=Query(1000,ge=1,le=2000),
    user=Depends(require_permission("agro"))):
    parsed=None
    if bbox:
        try:
            values=tuple(float(x) for x in bbox.split(","))
            if len(values)!=4: raise ValueError
            min_lon,min_lat,max_lon,max_lat=values
            if not(-73.99<=min_lon<max_lon<=-34.79 and -33.75<=min_lat<max_lat<=5.27): raise ValueError
            parsed=values
        except ValueError: raise HTTPException(422,"bbox deve estar no formato minLon,minLat,maxLon,maxLat dentro do Brasil")
    return AgroPropertiesRepository.map(uf=uf,municipio=municipio,bbox=parsed,limit=limit)

@router.get("/agro/imoveis/{id}")
def get_agro_imovel_detail(id: str, request: Request, user=Depends(require_permission("agro"))):
    item = AgroPropertiesRepository.detail(id)
    if not item: raise HTTPException(404, "Cadastro CAR não encontrado")
    return item

@router.get("/agro/tecnicos")
def get_agro_tecnicos(request: Request, page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100),
                      q: Optional[str] = None, uf: Optional[str] = None, municipio: Optional[str] = None,
                      profissao: Optional[str] = None, origem: Optional[str] = None, confianca: Optional[str] = None,
                      com_crmv: Optional[bool] = None, com_telefone: Optional[bool] = None,
                      com_email: Optional[bool] = None, atividade: Optional[str] = None,
                      entidade_tipo: Optional[str] = None, grupo: Optional[str] = None,
                      evidencia: Optional[str] = None,
                      contact_status: Literal["ANY","PHONE","EMAIL","BOTH","NONE"] = "ANY",
                      sort: str = "nome", order: str = "asc", user=Depends(require_permission("agro"))):
    return AgroCanalRepository.tecnicos(page=page,page_size=page_size,q=q,uf=uf,municipio=municipio,
        profissao=profissao,origem=origem,confianca=confianca,com_crmv=com_crmv,
        com_telefone=com_telefone,com_email=com_email,atividade=atividade,entidade_tipo=entidade_tipo,
        grupo=grupo,evidencia=evidencia,contact_status=contact_status,sort=sort,order=order)

@router.get("/agro/tecnicos/stats")
def get_agro_tecnicos_stats(request: Request, user=Depends(require_permission("agro"))):
    return AgroCanalRepository.tecnicos_stats()

@router.get("/agro/tecnicos/mapa")
def get_agro_tecnicos_mapa(request: Request, uf: Optional[str] = Query(None,min_length=2,max_length=2),
                           limit: int = Query(5570,ge=1,le=5570), user=Depends(require_permission("agro"))):
    return AgroCanalRepository.tecnicos_mapa(uf=uf,limit=limit)

@router.get("/agro/tecnicos/{id}")
def get_agro_tecnico(id: str, request: Request, user=Depends(require_permission("agro"))):
    item=AgroCanalRepository.tecnico(id)
    if not item: raise HTTPException(404,"Cadastro técnico não encontrado")
    return item

@router.get("/agro/deserto-veterinario")
def get_agro_deserto(request: Request, page:int=Query(1,ge=1),page_size:int=Query(25,ge=1,le=5000),
    q:Optional[str]=None,uf:Optional[str]=None,classificacao:Optional[str]=None,min_bovinos:Optional[int]=None,
    min_carga:Optional[int]=None,sort:str="municipio",order:str="asc",formato:Literal["lista","mapa"]="lista",
    user=Depends(require_permission("agro"))):
    return AgroCanalRepository.deserto(page,page_size,q,uf,classificacao,min_bovinos,min_carga,sort,order,formato)

@router.get("/agro/deserto-veterinario/stats")
def get_agro_deserto_stats(request: Request,user=Depends(require_permission("agro"))):
    return AgroCanalRepository.deserto_stats()

@router.get("/agro/veterinaria/classificacao")
def get_agro_veterinaria_classificacao(request: Request, user=Depends(require_permission("agro"))):
    return Wave1Repository.agro_veterinaria_classificacao()

@router.get("/logistica/transportadores")
def get_logistica_transportadores(request: Request, page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100),
                                  search: Optional[str] = None, municipality: Optional[str] = None, uf: Optional[str] = None,
                                  user=Depends(require_permission("logistica"))):
    return Wave1Repository.logistica_transportadores(page=page, page_size=page_size, search=search, municipality=municipality, uf=uf)

@router.get("/saude/estabelecimentos")
def get_saude_estabelecimentos(request: Request, page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100),
                                search: Optional[str] = None, municipality: Optional[str] = None, uf: Optional[str] = None,
                                user=Depends(require_permission("saude"))):
    return Wave1Repository.saude_estabelecimentos(page=page, page_size=page_size, search=search, municipality=municipality, uf=uf)

# Agro Detail & Special Routes
@router.get("/agro/kpis")
def get_agro_kpis(request: Request, uf: Optional[str] = Query(None, min_length=2, max_length=2),
                  bioma: Optional[str] = None, municipio: Optional[str] = None,
                  user=Depends(require_permission("agro"))):
    req_id = getattr(request.state, "request_id", "unknown")
    try:
        return Wave1Repository.agro_kpis(uf=uf, bioma=bioma, municipio=municipio)
    except Exception as e:
        logger.error(f"Erro ao buscar KPIs do Agro: {e} reqId={req_id}")
        return standard_error("INTERNAL_SERVER_ERROR", "Error fetching agro KPIs", req_id, 500)

@router.post("/agro/cache/refresh")
def refresh_agro_cache(request: Request, user=Depends(require_permission("agro"))):
    req_id = getattr(request.state, "request_id", "unknown")
    try:
        res = Wave1Repository.refresh_agro_cache(force=True)
        return res
    except Exception as e:
        logger.error(f"Erro ao atualizar cache do Agro: {e} reqId={req_id}")
        return standard_error("INTERNAL_SERVER_ERROR", "Error refreshing agro cache", req_id, 500)

@router.get("/agro/distribuicao")
def get_agro_distribuicao(request: Request, tipo: str = Query("bioma", regex="^(bioma|uso_solo)$"),
                          uf: Optional[str] = Query(None, min_length=2, max_length=2),
                          municipio: Optional[str] = None,
                          user=Depends(require_permission("agro"))):
    req_id = getattr(request.state, "request_id", "unknown")
    try:
        return Wave1Repository.agro_distribuicao(tipo=tipo, uf=uf, municipio=municipio)
    except Exception as e:
        logger.error(f"Erro ao buscar distribuição {tipo}: {e} reqId={req_id}")
        return standard_error("INTERNAL_SERVER_ERROR", f"Error fetching {tipo} distribution", req_id, 500)

@router.get("/agro/mapa")
def get_agro_mapa(request: Request, min_lat: float = Query(-35.5, ge=-90, le=90),
                  max_lat: float = Query(6.5, ge=-90, le=90),
                  min_lng: float = Query(-75.5, ge=-180, le=180),
                  max_lng: float = Query(-32, ge=-180, le=180),
                  zoom: int = Query(4, ge=3, le=18),
                  uf: Optional[str] = Query(None, min_length=2, max_length=2),
                  bioma: Optional[str] = None, uso_solo: Optional[str] = None,
                  user=Depends(require_permission("agro"))):
    req_id = getattr(request.state, "request_id", "unknown")
    if min_lat >= max_lat or min_lng >= max_lng:
        raise HTTPException(422, "bounding box inválido")
    try:
        return Wave1Repository.agro_mapa(min_lat=min_lat, max_lat=max_lat, min_lng=min_lng, max_lng=max_lng,
                                         zoom=zoom, uf=uf, bioma=bioma, uso_solo=uso_solo)
    except Exception as e:
        logger.error(f"Erro no mapa agro: {e} reqId={req_id}")
        return standard_error("INTERNAL_SERVER_ERROR", "Error fetching agro map", req_id, 500)

@router.get("/agro/oportunidades/status")
def get_agro_oportunidades_status(request: Request, user=Depends(require_permission("agro"))):
    req_id = getattr(request.state, "request_id", "unknown")
    try:
        return AgroRadarRepository.status()
    except Exception as exc:
        logger.error("Erro no status do Radar de Sinais Agro: %s reqId=%s", exc, req_id)
        return standard_error("AGRO_RADAR_STATUS_UNAVAILABLE", "Não foi possível carregar o status do motor de sinais.", req_id, 500, True)


@router.get("/agro/oportunidades/funil")
def get_agro_oportunidades_funil(request: Request, user=Depends(require_permission("agro"))):
    req_id = getattr(request.state, "request_id", "unknown")
    try:
        return AgroRadarRepository.funnel()
    except Exception as exc:
        logger.error("Erro no funil do Radar de Sinais Agro: %s reqId=%s", exc, req_id)
        return standard_error("AGRO_RADAR_FUNNEL_UNAVAILABLE", "Não foi possível carregar o funil de sinais.", req_id, 500, True)


@router.get("/agro/oportunidades/regras")
def get_agro_oportunidades_regras(request: Request, user=Depends(require_permission("agro"))):
    req_id = getattr(request.state, "request_id", "unknown")
    try:
        return AgroRadarRepository.rules()
    except Exception as exc:
        logger.error("Erro nas regras do Radar de Sinais Agro: %s reqId=%s", exc, req_id)
        return standard_error("AGRO_RADAR_RULES_UNAVAILABLE", "Não foi possível carregar as regras do motor.", req_id, 500, True)


@router.get("/agro/oportunidades/estagios")
def get_agro_oportunidades_estagios(request: Request, user=Depends(require_permission("agro"))):
    req_id = getattr(request.state, "request_id", "unknown")
    try:
        return AgroRadarRepository.stages()
    except Exception as exc:
        logger.error("Erro nos estágios do Radar de Sinais Agro: %s reqId=%s", exc, req_id)
        return standard_error("AGRO_RADAR_STAGES_UNAVAILABLE", "Não foi possível carregar os estágios do motor.", req_id, 500, True)


@router.get("/agro/oportunidades")
def get_agro_oportunidades_radar(
        request: Request,
        stage: Literal["SIGNAL", "CANDIDATE", "VALIDATION", "VALIDATED"] = "SIGNAL",
        page: int = Query(1, ge=1), page_size: int = Query(25),
        q: Optional[str] = None, uf: Optional[str] = None, municipio: Optional[str] = None,
        signal_type: Optional[str] = None, classification: Optional[str] = None,
        priority: Optional[str] = None, rule_id: Optional[str] = None,
        sort: Literal["priority", "municipio", "uf", "rebanho_bovino", "bovinos_por_tecnico", "calculated_at"] = "priority",
        order: Literal["asc", "desc"] = "desc",
        user=Depends(require_permission("agro"))):
    req_id = getattr(request.state, "request_id", "unknown")
    if page_size not in (25, 50, 100):
        raise HTTPException(422, "page_size deve ser 25, 50 ou 100")
    try:
        if stage == "CANDIDATE":
            return AgroRadarRepository.candidates(page=page, page_size=page_size, q=q, uf=uf, municipio=municipio)
        return AgroRadarRepository.signals(
            page=page, page_size=page_size, stage=stage, q=q, uf=uf, municipio=municipio,
            signal_type=signal_type, classification=classification, priority=priority,
            rule_id=rule_id, sort=sort, order=order)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Erro no Radar de Sinais Agro: %s reqId=%s", exc, req_id)
        return standard_error("AGRO_RADAR_UNAVAILABLE", "Não foi possível carregar o Radar de Sinais Agro.", req_id, 500, True)

@router.get("/agro/relacoes")
def get_agro_relacoes(request: Request, imovel_id: Optional[str] = None,
                      cnpj: Optional[str] = None,
                      user=Depends(require_permission("agro"))):
    req_id = getattr(request.state, "request_id", "unknown")
    try:
        return Wave1Repository.agro_relacoes(imovel_id=imovel_id, cnpj=cnpj)
    except Exception as e:
        logger.error(f"Erro ao buscar relações cross-domain agro: {e} reqId={req_id}")
        return standard_error("AGRO_RELATIONSHIPS_UNAVAILABLE", "Não foi possível carregar as relações neste momento.", req_id, 500, retryable=True)

def _people_list(page, page_size, q, uf, municipio, tipo_vinculo, motivo_inclusao,
                 evidencia_agro, evidencia_decisao, tipo_contato, com_contato,
                 com_varias_empresas, com_car, cnae, com_grupo, sort, order):
    if page_size not in (25, 50, 100):
        raise HTTPException(422, "page_size deve ser 25, 50 ou 100")
    return AgroPeopleRepository.list_people(
        page=page, page_size=page_size, q=q, uf=uf, municipio=municipio,
        tipo_vinculo=tipo_vinculo, motivo_inclusao=motivo_inclusao,
        evidencia_agro=evidencia_agro, evidencia_decisao=evidencia_decisao,
        tipo_contato=tipo_contato, com_contato=com_contato,
        com_varias_empresas=com_varias_empresas, com_car=com_car, cnae=cnae,
        com_grupo=com_grupo, sort=sort, order=order)


@router.get("/agro/pessoas-vinculos")
def get_agro_people(request: Request, page: int = Query(1, ge=1), page_size: int = Query(25),
                    q: Optional[str] = None, uf: Optional[str] = None, municipio: Optional[str] = None,
                    tipo_vinculo: Optional[str] = None, motivo_inclusao: Optional[str] = None,
                    evidencia_agro: Optional[str] = None, evidencia_decisao: Optional[str] = None,
                    tipo_contato: Optional[str] = None, com_contato: Optional[bool] = None,
                    com_varias_empresas: Optional[bool] = None, com_car: Optional[bool] = None,
                    cnae: Optional[str] = None, com_grupo: Optional[bool] = None,
                    sort: Literal["nome","total_empresas","total_ufs","evidencia_agro","evidencia_decisao","atualizacao"] = "total_empresas",
                    order: Literal["asc","desc"] = "desc", user=Depends(require_permission("agro"))):
    try:
        return _people_list(page,page_size,q,uf,municipio,tipo_vinculo,motivo_inclusao,
                            evidencia_agro,evidencia_decisao,tipo_contato,com_contato,
                            com_varias_empresas,com_car,cnae,com_grupo,sort,order)
    except HTTPException:
        raise
    except Exception as exc:
        req_id = getattr(request.state, "request_id", "unknown")
        logger.error("Erro no catálogo de pessoas Agro: %s reqId=%s", exc, req_id)
        return standard_error("AGRO_PEOPLE_UNAVAILABLE", "Não foi possível carregar pessoas e vínculos societários.", req_id, 500, True)


@router.get("/agro/pessoas-vinculos/stats")
def get_agro_people_stats(request: Request, user=Depends(require_permission("agro"))):
    try:
        return AgroPeopleRepository.stats()
    except Exception as exc:
        req_id = getattr(request.state, "request_id", "unknown")
        logger.error("Erro nas estatísticas de pessoas Agro: %s reqId=%s", exc, req_id)
        return standard_error("AGRO_PEOPLE_STATS_UNAVAILABLE", "Não foi possível carregar as estatísticas.", req_id, 500, True)


@router.get("/agro/pessoas-vinculos/{person_id}")
def get_agro_person(person_id: str, request: Request, user=Depends(require_permission("agro"))):
    try:
        item = AgroPeopleRepository.detail(person_id)
    except Exception as exc:
        req_id = getattr(request.state, "request_id", "unknown")
        logger.error("Erro no detalhe de pessoa Agro: %s reqId=%s", exc, req_id)
        return standard_error("AGRO_PERSON_UNAVAILABLE", "Não foi possível carregar a ficha da pessoa.", req_id, 500, True)
    if not item:
        raise HTTPException(404, "Pessoa não encontrada")
    return item


@router.get("/agro/decisores")
def get_agro_decisores(request: Request, page: int = Query(1, ge=1), page_size: int = Query(25),
                       search: Optional[str] = None, q: Optional[str] = None, uf: Optional[str] = None,
                       user=Depends(require_permission("agro"))):
    response = _people_list(page,page_size,q or search,uf,None,None,None,None,None,None,None,None,None,None,None,"total_empresas","desc")
    response["deprecated"] = True
    response["canonical_endpoint"] = "/api/v1/agro/pessoas-vinculos"
    return response

@router.get("/agro/holdings/stats")
def get_agro_holdings_stats(request: Request, user=Depends(require_permission("agro"))):
    try:
        return AgroHoldingsRepository.stats()
    except Exception as exc:
        req_id=getattr(request.state,"request_id","unknown")
        logger.error("Erro nas estatísticas de holdings Agro: %s reqId=%s",exc,req_id)
        return standard_error("AGRO_HOLDINGS_STATS_UNAVAILABLE","Não foi possível carregar as estatísticas.",req_id,500,True)


@router.get("/agro/holdings/entities/{entity_id}")
def get_agro_holding_entity(entity_id: str, request: Request, user=Depends(require_permission("agro"))):
    try:
        item=AgroHoldingsRepository.entity_detail(entity_id)
    except Exception as exc:
        req_id=getattr(request.state,"request_id","unknown")
        logger.error("Erro no detalhe de empresa Holdings: %s reqId=%s",exc,req_id)
        return standard_error("AGRO_HOLDING_ENTITY_UNAVAILABLE","Não foi possível carregar a empresa.",req_id,500,True)
    if not item: raise HTTPException(404,"Empresa não encontrada")
    return item


@router.get("/agro/holdings/groups/{group_id}")
def get_agro_holding_group(group_id: str, request: Request, user=Depends(require_permission("agro"))):
    try:
        item=AgroHoldingsRepository.group_detail(group_id)
    except Exception as exc:
        req_id=getattr(request.state,"request_id","unknown")
        logger.error("Erro no detalhe de grupo Holdings: %s reqId=%s",exc,req_id)
        return standard_error("AGRO_HOLDING_GROUP_UNAVAILABLE","Não foi possível carregar o grupo.",req_id,500,True)
    if not item: raise HTTPException(404,"Grupo documental não encontrado")
    return item


@router.get("/agro/holdings")
def get_agro_holdings(request: Request, page: int = Query(1, ge=1), page_size: int = Query(25),
                      q: Optional[str] = None, search: Optional[str] = None, uf: Optional[str] = None,
                      municipio: Optional[str] = None, tipo_entidade: Optional[str] = None,
                      motivo_inclusao: Optional[str] = None, evidencia_grupo: Optional[str] = None,
                      com_multiplas_empresas: Optional[bool] = None, com_propriedade: Optional[bool] = None,
                      com_empresa_360: Optional[bool] = None, pessoa_id: Optional[str] = None,
                      cnae: Optional[str] = None, tab: Literal["empresas","candidatos","grupos"] = "empresas",
                      sort: Literal["razao_social","municipio","uf","total_empresas","evidencia_grupo","atualizacao"] = "razao_social",
                      order: Literal["asc","desc"] = "asc", user=Depends(require_permission("agro"))):
    if page_size not in (25,50,100): raise HTTPException(422,"page_size deve ser 25, 50 ou 100")
    try:
        return AgroHoldingsRepository.list(tab=tab,page=page,page_size=page_size,q=q or search,uf=uf,
          municipio=municipio,tipo_entidade=tipo_entidade,motivo_inclusao=motivo_inclusao,
          evidencia_grupo=evidencia_grupo,com_multiplas_empresas=com_multiplas_empresas,
          com_propriedade=com_propriedade,com_empresa_360=com_empresa_360,pessoa_id=pessoa_id,
          cnae=cnae,sort=sort,order=order)
    except HTTPException: raise
    except Exception as exc:
        req_id=getattr(request.state,"request_id","unknown")
        logger.error("Erro no catálogo Holdings Agro: %s reqId=%s",exc,req_id)
        return standard_error("AGRO_HOLDINGS_UNAVAILABLE","Não foi possível carregar empresas e agrupamentos.",req_id,500,True)

@router.get("/agro/oportunidades/calculadas")
def get_agro_oportunidades_calculadas(request: Request, categoria: Optional[str] = None, min_score: int = Query(70, ge=0, le=100),
                                      uf: Optional[str] = None, user=Depends(require_permission("agro"))):
    response = Wave1Repository.agro_oportunidades_calculadas(categoria=categoria, min_score=min_score, uf=uf)
    response["deprecated"] = True
    response["canonical_endpoint"] = "/api/v1/agro/oportunidades"
    return response

@router.get("/agro/logistica/correlacao")
def get_agro_logistica_correlacao(request: Request, uf: Optional[str] = None, municipio: Optional[str] = None,
                                  user=Depends(require_permission("agro"))):
    return Wave1Repository.agro_logistica_correlacao(uf=uf, municipio=municipio)

@router.get("/agro/logistica/resumo")
def get_agro_logistica_resumo(request: Request, uf: Optional[str] = None, municipio: Optional[str] = None,
                              user=Depends(require_permission("agro"))):
    return Wave1Repository.agro_logistica_resumo(uf=uf, municipio=municipio)

@router.get("/agro/logistica/municipios")
def get_agro_logistica_municipios(request: Request, q: Optional[str] = None, uf: Optional[str] = None,
                                  municipio: Optional[str] = None, coverage_status: Optional[str] = None,
                                  page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100),
                                  sort: Literal["municipio","uf","transporters","with_rntrc","geocoded"] = "transporters",
                                  order: Literal["asc","desc"] = "desc", user=Depends(require_permission("agro"))):
    return Wave1Repository.agro_logistica_municipios(q=q, uf=uf, municipio=municipio,
        coverage_status=coverage_status, page=page, page_size=page_size, sort=sort, order=order)

@router.get("/agro/logistica/mapa")
def get_agro_logistica_mapa(request: Request, uf: Optional[str] = None,
                            limit: int = Query(100, ge=1, le=100), user=Depends(require_permission("agro"))):
    return Wave1Repository.agro_logistica_mapa(uf=uf, limit=limit)

@router.get("/agro/genetica/resumo")
def get_agro_genetica_resumo(request: Request, user=Depends(require_permission("agro"))):
    return Wave1Repository.agro_genetica_resumo()

@router.get("/agro/genetica/reprodutores")
def get_agro_genetica_reprodutores(request: Request,
                                  page: int = Query(1, ge=1),
                                  page_size: int = Query(25, ge=1, le=100),
                                  q: Optional[str] = None,
                                  registro: Optional[str] = None,
                                  raca: Optional[str] = None,
                                  central: Optional[str] = None,
                                  uf: Optional[str] = None,
                                  municipio: Optional[str] = None,
                                  pedigree_status: Optional[Literal["declared", "partial", "none"]] = None,
                                  has_evaluation: Optional[bool] = None,
                                  sort: Literal["avaliacoes_count", "nome", "registro", "raca", "preco_dose", "nascimento", "id"] = "avaliacoes_count",
                                  order: Literal["asc", "desc"] = "desc",
                                  user=Depends(require_permission("agro"))):
    return Wave1Repository.agro_genetica_reprodutores(
        page=page, page_size=page_size, q=q, registro=registro, raca=raca,
        central=central, uf=uf, municipio=municipio, pedigree_status=pedigree_status,
        has_evaluation=has_evaluation, sort=sort, order=order
    )

@router.get("/agro/genetica/reprodutores/{id}")
def get_agro_genetica_reprodutor_detail(id: str, request: Request, user=Depends(require_permission("agro"))):
    item = Wave1Repository.agro_genetica_reprodutor_detail(id)
    if not item:
        raise HTTPException(404, "Reprodutor não encontrado")
    return item

@router.get("/agro/genetica/caracteristicas")
def get_agro_genetica_caracteristicas(request: Request, user=Depends(require_permission("agro"))):
    return Wave1Repository.agro_genetica_caracteristicas()

@router.get("/agro/genetica/reprodutores/{id}/pedigree")
def get_agro_genetica_pedigree(id: str, request: Request, user=Depends(require_permission("agro"))):
    item = Wave1Repository.agro_genetica_pedigree(id)
    if not item:
        raise HTTPException(404, "Reprodutor não encontrado")
    return item

@router.get("/agro/genetica/acasalamento/prontidao")
def get_agro_genetica_acasalamento_prontidao(request: Request, user=Depends(require_permission("agro"))):
    return Wave1Repository.agro_genetica_acasalamento_prontidao()

@router.post("/agro/genetica/acasalamento/candidatos")
async def post_agro_genetica_acasalamento_candidatos(request: Request, user=Depends(require_permission("agro"))):
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    return Wave1Repository.agro_genetica_acasalamento_candidatos(payload)

@router.get("/agro/genetica/simulador")
def get_agro_genetica_simulador(request: Request, touro_id: Optional[str] = None, raca: Optional[str] = None,
                                user=Depends(require_permission("agro"))):
    return Wave1Repository.agro_genetica_simulador(touro_id=touro_id, raca=raca)

@router.get("/agro/produtores/{id}")
def get_agro_produtor_detail(id: str, request: Request, user=Depends(require_permission("agro"))):
    item = Wave1Repository.agro_produtor(id)
    if not item:
        raise HTTPException(404, "Produtor não encontrado")
    return item

@router.get("/agro/reprodutores")
def get_agro_reprodutores(request: Request, page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100),
                          search: Optional[str] = None, breed: Optional[str] = None, uf: Optional[str] = None,
                          user=Depends(require_permission("agro"))):
    return Wave1Repository.agro_reprodutores(page=page, page_size=page_size, search=search, breed=breed, uf=uf)

@router.get("/agro/reprodutores/{id}")
def get_agro_reprodutor_detail(id: str, request: Request, user=Depends(require_permission("agro"))):
    item = Wave1Repository.agro_reprodutor(id)
    if not item:
        raise HTTPException(404, "Reprodutor não encontrado")
    return item

@router.get("/agro/doadoras")
def get_agro_doadoras(request: Request, user=Depends(require_permission("agro"))):
    return Wave1Repository.agro_doadoras()

@router.get("/agro/embrioes")
def get_agro_embrioes(request: Request, user=Depends(require_permission("agro"))):
    return Wave1Repository.agro_embrioes()

@router.get("/agro/genealogia/{id}")
def get_agro_genealogia(id: str, request: Request, user=Depends(require_permission("agro"))):
    item = Wave1Repository.agro_genealogia(id)
    if not item:
        raise HTTPException(404, "Genealogia não encontrada")
    return item

# Saúde Detail & Sub-resource Routes
@router.get("/saude/estabelecimentos/{cnes}")
def get_saude_estabelecimento_detail(cnes: str, request: Request, user=Depends(require_permission("saude"))):
    item = Wave1Repository.saude_estabelecimento(cnes)
    if not item:
        raise HTTPException(404, "Estabelecimento CNES não encontrado")
    return item

@router.get("/saude/estabelecimentos/{cnes}/capacidade")
def get_saude_estabelecimento_capacidade(cnes: str, request: Request, user=Depends(require_permission("saude"))):
    return Wave1Repository.saude_capacidade(cnes)

@router.get("/saude/estabelecimentos/{cnes}/profissionais")
def get_saude_estabelecimento_profissionais(cnes: str, request: Request, user=Depends(require_permission("saude"))):
    return Wave1Repository.saude_profissionais(cnes)

@router.get("/saude/estabelecimentos/{cnes}/equipamentos")
def get_saude_estabelecimento_equipamentos(cnes: str, request: Request, user=Depends(require_permission("saude"))):
    return Wave1Repository.saude_equipamentos(cnes)

@router.get("/saude/estabelecimentos/{cnes}/oportunidades")
def get_saude_estabelecimento_oportunidades(cnes: str, request: Request, user=Depends(require_permission("saude"))):
    return Wave1Repository.saude_oportunidades(cnes)
