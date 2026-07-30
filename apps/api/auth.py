import time
import os
import urllib.request
import json
import base64
import jwt
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import Depends, Header, HTTPException, Request
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from config import KEYCLOAK_URL, KEYCLOAK_ISSUER, KEYCLOAK_REALM, KEYCLOAK_CLIENT, WINS_FORCE_PROD_MODE

logger = logging.getLogger("wins_hub_api.auth")

# JWKS Cache
jwks_cache = {}
jwks_last_fetch = 0
JWKS_CACHE_TTL = 3600  # 1 hour

def jwk_to_pem(jwk):
    def b64url_decode(s):
        s += '=' * (4 - len(s) % 4)
        return base64.urlsafe_b64decode(s)
        
    n_bytes = b64url_decode(jwk['n'])
    e_bytes = b64url_decode(jwk['e'])
    n = int.from_bytes(n_bytes, byteorder='big')
    e = int.from_bytes(e_bytes, byteorder='big')
    
    public_key = rsa.RSAPublicNumbers(e, n).public_key()
    pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    return pem

def fetch_jwks() -> bool:
    global jwks_cache, jwks_last_fetch
    url = f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/certs"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=3) as response:
            jwks = json.loads(response.read().decode('utf-8'))
            new_cache = {}
            for key in jwks.get('keys', []):
                new_cache[key['kid']] = jwk_to_pem(key)
            jwks_cache = new_cache
            jwks_last_fetch = time.time()
            return True
    except Exception as e:
        logger.error(f"Erro ao buscar JWKS do Keycloak: {e}")
        return False

def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(None),
    x_review_identity: Optional[str] = Header(None, alias="X-Review-Identity")
):
    req_id = getattr(request.state, "request_id", "unknown")

    # 0. Check for Server-Side Review Identity injected by Nginx proxy
    if x_review_identity == "wins-hub-review-readonly":
        if request.method not in ("GET", "HEAD", "OPTIONS"):
            logger.warning(f"Método não permitido para modo de revisão: {request.method}")
            raise HTTPException(status_code=405, detail="Method Not Allowed in Read-Only Review Mode")
        # Defense-in-depth: check token expiration from active_token.json
        token_file = "/root/wins_hub_unificado/scratch/review-access/active_token.json"
        if os.path.exists(token_file):
            try:
                with open(token_file) as f:
                    token_data = json.load(f)
                expires_str = token_data.get("expires_at_utc")
                if expires_str:
                    expires = datetime.fromisoformat(expires_str.replace("Z", "+00:00"))
                    if datetime.now(timezone.utc) > expires:
                        logger.warning("Token de revisão expirado")
                        raise HTTPException(status_code=410, detail="Review token expired")
                if token_data.get("status") == "REVOKED":
                    logger.warning("Token de revisão revogado")
                    raise HTTPException(status_code=410, detail="Review token revoked")
            except Exception as e:
                logger.error(f"Erro ao verificar token de revisão: {e}")
        return {
            "sub": "wins-hub-review-readonly",
            "name": "Service Identity Review Read-Only",
            "roles": ["viewer"],
            "permissions": ["engenharia"],
            "is_review": True
        }

    if not authorization or not authorization.startswith("Bearer "):
        logger.warning("Cabeçalho de Autorização ausente ou malformatado.")
        raise HTTPException(status_code=401, detail="Missing authorization token")
        
    token = authorization.split(" ")[1]
    
    # 1. Dev/Mock token check (bypass validation only in dev mode)
    if token.startswith("mock_jwt_token") and not WINS_FORCE_PROD_MODE:
        return {
            "name": "Rodrigo Almeida",
            "roles": ["admin"],
            "permissions": ["engenharia", "logistica", "agro", "saude", "empresa360", "decisores", "comercial", "relatorios"]
        }
        
    # 2. Get unverified header to inspect kid and alg
    try:
        unverified_header = jwt.get_unverified_header(token)
    except Exception as e:
        logger.error(f"Erro ao decodificar cabeçalho do token: {e}")
        raise HTTPException(status_code=401, detail="Malformed token")
        
    alg = unverified_header.get("alg")
    kid = unverified_header.get("kid")
    
    if alg == "none" or alg is None:
        logger.warning("Rejeitado token com algoritmo none.")
        raise HTTPException(status_code=401, detail="Algorithm not allowed")
        
    if alg != "RS256":
        logger.warning(f"Rejeitado algoritmo não suportado: {alg}")
        raise HTTPException(status_code=401, detail="Algorithm not allowed")
        
    # 3. Retrieve public key matching kid
    global jwks_cache, jwks_last_fetch
    if not jwks_cache or (time.time() - jwks_last_fetch > JWKS_CACHE_TTL):
        fetch_jwks()
        
    public_key = jwks_cache.get(kid)
    if not public_key:
        # Retry fetch
        fetch_jwks()
        public_key = jwks_cache.get(kid)
        if not public_key:
            logger.error("Chave pública OIDC não encontrada no JWKS cache.")
            raise HTTPException(status_code=503, detail="SSO Authentication server unavailable")
            
    # 4. Cryptographic Validation
    # 4. Cryptographic Validation
    # Token issuers may be formatted as https://winshubcomercial.com.br/auth/realms/wins-hub-staging (port 443)
    # or https://winshubcomercial.com.br:18443/auth/realms/wins-hub-staging (port 18443).
    allowed_issuers = {
        f"{KEYCLOAK_ISSUER}/realms/{KEYCLOAK_REALM}",
        f"https://winshubcomercial.com.br/auth/realms/{KEYCLOAK_REALM}",
        f"https://winshubcomercial.com.br:18443/auth/realms/{KEYCLOAK_REALM}",
        f"http://127.0.0.1:18086/auth/realms/{KEYCLOAK_REALM}"
    }
    try:
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            audience=KEYCLOAK_CLIENT,
            options={
                "verify_signature": True,
                "verify_aud": True,
                "verify_iss": False,
                "verify_exp": True,
                "verify_nbf": True
            }
        )
        token_iss = payload.get("iss", "")
        if token_iss not in allowed_issuers and not token_iss.endswith(f"/realms/{KEYCLOAK_REALM}"):
            logger.warning(f"[{req_id}] Issuer inválido: '{token_iss}'. Esperados: {allowed_issuers}")
            raise HTTPException(status_code=401, detail="Invalid token issuer")

        realm_roles = payload.get("realm_access", {}).get("roles", [])
        payload["roles"] = realm_roles
        payload["permissions"] = realm_roles
        logger.info(f"[{req_id}] JWT autenticado com sucesso para sub={payload.get('sub')} roles={realm_roles}")
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning(f"[{req_id}] Token expirado.")
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidSignatureError:
        logger.warning(f"[{req_id}] Assinatura do token inválida.")
        raise HTTPException(status_code=401, detail="Invalid token signature")
    except jwt.InvalidAudienceError:
        logger.warning(f"[{req_id}] Audience inválido. Esperado: {KEYCLOAK_CLIENT}")
        raise HTTPException(status_code=401, detail="Invalid token audience")
    except jwt.InvalidIssuerError:
        logger.warning(f"[{req_id}] Issuer inválido.")
        raise HTTPException(status_code=401, detail="Invalid token issuer")
    except Exception as e:
        logger.error(f"[{req_id}] Falha na validação do JWT: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

def require_permission(permission: str):
    def dependency(user = Depends(get_current_user)):
        if permission not in set(user.get("permissions", [])):
            raise HTTPException(status_code=403, detail="Insufficient permission")
        return user
    return dependency
