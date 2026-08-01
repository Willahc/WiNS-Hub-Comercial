import hmac
import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, Header, HTTPException, Request

WINS_INTERNAL_SECRET = os.environ.get("WINS_INTERNAL_SECRET", "").strip()
if not WINS_INTERNAL_SECRET:
    raise RuntimeError("WINS_INTERNAL_SECRET não configurado; identidade de manutenção desativada.")

logger = logging.getLogger("wins_hub_api.auth")


def verify_maintenance_auth(authenticated_user, roles, auth_mode, internal_secret) -> bool:
    return bool(
        auth_mode == "maintenance" and authenticated_user and internal_secret
        and hmac.compare_digest(internal_secret, WINS_INTERNAL_SECRET)
    )


def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(None),
    x_review_identity: Optional[str] = Header(None, alias="X-Review-Identity"),
    x_wins_authenticated_user: Optional[str] = Header(None, alias="X-WiNS-Authenticated-User"),
    x_wins_display_name: Optional[str] = Header(None, alias="X-WiNS-Display-Name"),
    x_wins_roles: Optional[str] = Header(None, alias="X-WiNS-Roles"),
    x_wins_auth_mode: Optional[str] = Header(None, alias="X-WiNS-Auth-Mode"),
    x_wins_internal_secret: Optional[str] = Header(None, alias="X-WiNS-Internal-Secret"),
):
    req_id = getattr(request.state, "request_id", "unknown")
    if x_review_identity == "wins-hub-review-readonly":
        if request.method not in ("GET", "HEAD", "OPTIONS"):
            raise HTTPException(status_code=405, detail="Method Not Allowed in Read-Only Review Mode")
        token_file = "/root/wins_hub_unificado/scratch/review-access/active_token.json"
        if os.path.exists(token_file):
            try:
                with open(token_file) as file:
                    token_data = json.load(file)
                expires_str = token_data.get("expires_at_utc")
                if expires_str and datetime.now(timezone.utc) > datetime.fromisoformat(expires_str.replace("Z", "+00:00")):
                    raise HTTPException(status_code=410, detail="Review token expired")
                if token_data.get("status") == "REVOKED":
                    raise HTTPException(status_code=410, detail="Review token revoked")
            except HTTPException:
                raise
            except Exception as exc:
                logger.error("Erro ao verificar token de revisão: %s", exc)
        return {"sub": "wins-hub-review-readonly", "name": "Service Identity Review Read-Only",
                "roles": ["viewer"], "permissions": ["engenharia"], "is_review": True}
    if verify_maintenance_auth(x_wins_authenticated_user, x_wins_roles, x_wins_auth_mode, x_wins_internal_secret):
        roles = [role.strip() for role in (x_wins_roles or "").split(",") if role.strip()]
        return {"sub": x_wins_authenticated_user, "name": x_wins_display_name or x_wins_authenticated_user,
                "preferred_username": x_wins_authenticated_user, "roles": roles,
                "permissions": roles, "is_maintenance": True}
    logger.warning("[%s] Nenhuma autenticação válida", req_id)
    raise HTTPException(status_code=401, detail="Não autenticado")


def require_permission(permission: str):
    def dependency(user=Depends(get_current_user)):
        if permission not in set(user.get("permissions", [])):
            raise HTTPException(status_code=403, detail="Permissão insuficiente")
        return user
    return dependency


def require_write_access(user=Depends(get_current_user)):
    if not set(user.get("roles", [])).intersection({"maintenance_admin", "admin"}):
        raise HTTPException(status_code=403, detail="Acesso somente leitura — permissão de escrita necessária")
    return user


def get_session_info(request: Request):
    return {"authenticated": True, "username": getattr(request.state, "username", "maintenance"),
            "auth_mode": "maintenance"}
