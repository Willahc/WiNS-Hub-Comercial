from fastapi import APIRouter, Request, Query
from fastapi.responses import JSONResponse
from db import QueryTimeoutError
from repositories.empresa_360 import Empresa360Repository
from services.empresa_360 import Empresa360Service
from main import get_current_user, audit

router = APIRouter(tags=["empresa-360"])


def handle_query_timeout(request: Request, exc: QueryTimeoutError):
    return JSONResponse(
        status_code=504,
        content={"detail": {"code": "QUERY_TIMEOUT", "message": str(exc)}},
    )

_repo = Empresa360Repository()
_svc = Empresa360Service(_repo)


@router.get("/api/empresa/{cnpj}")
def api_empresa_por_cnpj(request: Request, cnpj: str):
    user = get_current_user(request)
    if not user:
        return JSONResponse({"error": "Não autenticado"}, status_code=401)
    empresa = _svc.buscar_por_cnpj(cnpj)
    if not empresa:
        return JSONResponse({"error": "Empresa não encontrada"}, status_code=404)
    audit(request, "empresa_360:consulta_cnpj", f"cnpj={cnpj[:8]}******")
    return empresa


@router.get("/api/empresa/id/{entidade_id}")
def api_empresa_por_id(request: Request, entidade_id: str):
    user = get_current_user(request)
    if not user:
        return JSONResponse({"error": "Não autenticado"}, status_code=401)
    empresa = _svc.buscar_por_id(entidade_id)
    if not empresa:
        return JSONResponse({"error": "Empresa não encontrada"}, status_code=404)
    audit(request, "empresa_360:consulta_id", f"id={entidade_id[:12]}...")
    return empresa


@router.get("/api/empresa/{entidade_id}/fontes")
def api_empresa_fontes(request: Request, entidade_id: str):
    user = get_current_user(request)
    if not user:
        return JSONResponse({"error": "Não autenticado"}, status_code=401)
    fontes = _svc.listar_fontes(entidade_id)
    audit(request, "empresa_360:fontes", f"id={entidade_id[:12]}... fontes={len(fontes)}")
    return {"items": fontes}


@router.get("/api/empresa/{entidade_id}/papeis")
def api_empresa_papeis(request: Request, entidade_id: str):
    user = get_current_user(request)
    if not user:
        return JSONResponse({"error": "Não autenticado"}, status_code=401)
    papeis = _svc.listar_papeis(entidade_id)
    audit(request, "empresa_360:papeis", f"id={entidade_id[:12]}... papeis={len(papeis)}")
    return {"items": papeis}


@router.get("/api/empresa/{entidade_id}/conflitos")
def api_empresa_conflitos(request: Request, entidade_id: str):
    user = get_current_user(request)
    if not user:
        return JSONResponse({"error": "Não autenticado"}, status_code=401)
    conflitos = _svc.listar_conflitos_geograficos(entidade_id)
    audit(request, "empresa_360:conflitos", f"id={entidade_id[:12]}... conflitos={len(conflitos)}")
    return {"items": conflitos}


@router.get("/api/empresa/{entidade_id}/geografias")
def api_empresa_geografias(request: Request, entidade_id: str):
    user = get_current_user(request)
    if not user:
        return JSONResponse({"error": "Não autenticado"}, status_code=401)
    geos = _svc.listar_todas_geografias(entidade_id)
    audit(request, "empresa_360:geografias", f"id={entidade_id[:12]}... geos={len(geos)}")
    return {"items": geos}


@router.get("/api/empresas")
def api_listar_empresas(
    request: Request,
    vertical: str | None = Query(None, description="Filtrar por vertical (AGRO, ENGENHARIA, LOG, SAUDE)"),
    uf: str | None = Query(None, description="Filtrar por UF"),
    multi_vertical: bool | None = Query(None, description="Apenas empresas multi-vertical"),
    situacao: str | None = Query(None, description="Situação cadastral"),
    q: str | None = Query(None, description="Busca textual (razão social, fantasia, CNPJ)"),
    page: int = Query(1, ge=1, description="Página"),
    per_page: int = Query(50, ge=1, le=200, description="Resultados por página"),
):
    user = get_current_user(request)
    if not user:
        return JSONResponse({"error": "Não autenticado"}, status_code=401)
    result = _svc.listar(
        vertical=vertical, uf=uf, multi_vertical=multi_vertical,
        situacao=situacao, q=q, page=page, per_page=per_page,
    )
    audit(request, "empresa_360:listar", f"filtros=vertical:{vertical or '-'} uf:{uf or '-'} q:{'sim' if q else 'nao'} page:{page}")
    return result


@router.get("/api/empresas/estatisticas")
def api_empresas_estatisticas(request: Request):
    user = get_current_user(request)
    if not user:
        return JSONResponse({"error": "Não autenticado"}, status_code=401)
    stats = _svc.estatisticas()
    audit(request, "empresa_360:estatisticas", None)
    return stats
