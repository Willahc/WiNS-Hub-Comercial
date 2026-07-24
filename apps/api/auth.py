import time
import urllib.request
import json
import base64
import jwt
import logging
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

def get_current_user(request: Request, authorization: Optional[str] = Header(None)):
    req_id = getattr(request.state, "request_id", "unknown")
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
    # JWKS may be fetched on loopback while tokens correctly advertise the
    # externally visible HTTPS issuer.
    expected_iss = f"{KEYCLOAK_ISSUER}/realms/{KEYCLOAK_REALM}"
    try:
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            audience=KEYCLOAK_CLIENT,
            issuer=expected_iss,
            options={
                "verify_signature": True,
                "verify_aud": True,
                "verify_iss": True,
                "verify_exp": True,
                "verify_nbf": True
            }
        )
        realm_roles = payload.get("realm_access", {}).get("roles", [])
        payload["roles"] = realm_roles
        payload["permissions"] = realm_roles
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("Token expirado.")
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidSignatureError:
        logger.warning("Assinatura do token inválida.")
        raise HTTPException(status_code=401, detail="Invalid token signature")
    except jwt.InvalidAudienceError:
        logger.warning(f"Audience inválido. Esperado: {KEYCLOAK_CLIENT}")
        raise HTTPException(status_code=401, detail="Invalid token audience")
    except jwt.InvalidIssuerError:
        logger.warning(f"Issuer inválido. Esperado: {expected_iss}")
        raise HTTPException(status_code=401, detail="Invalid token issuer")
    except Exception as e:
        logger.error(f"Falha na validação do JWT: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

def require_permission(permission: str):
    def dependency(user = Depends(get_current_user)):
        if permission not in set(user.get("permissions", [])):
            raise HTTPException(status_code=403, detail="Insufficient permission")
        return user
    return dependency
