import logging
import uuid
from datetime import date
from typing import Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import JSONResponse
from auth import get_current_user, require_permission
from repositories import (
    HealthRepository, DashboardRepository, EventosRepository,
    IndicadoresRepository, EmpresasRepository, OportunidadesRepository
)
from wave1_repository import Wave1Repository

logger = logging.getLogger("wins_hub_api.routes")

router = APIRouter(prefix="/api/v1")

# Standardized Error response helper
def standard_error(code: str, message: str, req_id: str, status_code: int = 400):
    return JSONResponse(
        status_code=status_code,
        content={
            "code": code,
            "message": message,
            "requestId": req_id,
            "details": None
        }
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
                company: Optional[str] = Query(None, max_length=160), investment_min: Optional[float] = Query(None, ge=0),
                investment_max: Optional[float] = Query(None, ge=0), period_start: Optional[date] = None,
                period_end: Optional[date] = None, has_supplier: Optional[bool] = None,
                has_decision_maker: Optional[bool] = None, has_opportunity: Optional[bool] = None,
                capex_homologado: Optional[bool] = None,
                sort: Literal["updated_desc", "updated_asc", "name_asc", "name_desc", "investment_desc", "investment_asc", "start_desc", "start_asc"] = "updated_desc",
                user=Depends(require_permission("engenharia"))):
    if investment_min is not None and investment_max is not None and investment_min > investment_max:
        raise HTTPException(422, "investment_min não pode ser maior que investment_max")
    if period_start and period_end and period_start > period_end:
        raise HTTPException(422, "period_start não pode ser posterior a period_end")
    return Wave1Repository.works(page=page, page_size=page_size, search=search, municipality=municipality,
        uf=uf, status=status, phase=phase, sector=sector, company=company,
        investment_min=investment_min, investment_max=investment_max, period_start=period_start,
        period_end=period_end, has_supplier=has_supplier, has_decision_maker=has_decision_maker,
        has_opportunity=has_opportunity, capex_homologado=capex_homologado, sort=sort)

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
@router.get("/engenharia/fornecedores")
def wave1_suppliers(request: Request, page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100),
                    search: Optional[str] = Query(None, max_length=120), cnpj: Optional[str] = None,
                    municipality: Optional[str] = Query(None, max_length=100), uf: Optional[str] = Query(None, min_length=2, max_length=2),
                    active: bool = True, sort: str = "matches_desc", user=Depends(require_permission("empresa360"))):
    return Wave1Repository.suppliers(page, page_size, search, cnpj, municipality, uf, active, sort)

@router.get("/fornecedores/{id}")
@router.get("/engenharia/fornecedores/{id}")
def wave1_supplier(id: str, request: Request, user=Depends(require_permission("empresa360"))):
    record=Wave1Repository.supplier(id)
    if not record:return standard_error("SUPPLIER_NOT_FOUND", "Fornecedor não encontrado", request.state.request_id, 404)
    return record

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

@router.get("/diretorios/catalogo")
def get_directory_catalog(request: Request, user=Depends(get_current_user)):
    return {"items": Wave1Repository.directory_catalog()}

@router.get("/busca-global")
def global_real_search(request: Request, q: str = Query(..., min_length=2, max_length=120),
                       user=Depends(get_current_user)):
    return Wave1Repository.global_search(q)

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
def get_agro_imoveis(request: Request, page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100),
                     search: Optional[str] = None, municipality: Optional[str] = None, uf: Optional[str] = None,
                     user=Depends(require_permission("agro"))):
    return Wave1Repository.agro_imoveis(page=page, page_size=page_size, search=search, municipality=municipality, uf=uf)

@router.get("/agro/tecnicos")
def get_agro_tecnicos(request: Request, page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100),
                      search: Optional[str] = None, municipality: Optional[str] = None, uf: Optional[str] = None,
                      user=Depends(require_permission("agro"))):
    return Wave1Repository.agro_tecnicos(page=page, page_size=page_size, search=search, municipality=municipality, uf=uf)

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
@router.get("/agro/imoveis/{id}")
def get_agro_imovel_detail(id: str, request: Request, user=Depends(require_permission("agro"))):
    item = Wave1Repository.agro_imovel(id)
    if not item:
        raise HTTPException(404, "Imóvel rural não encontrado")
    return item

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
