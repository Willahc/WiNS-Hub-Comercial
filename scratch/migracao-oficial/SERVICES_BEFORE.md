# Mapeamento de Serviços — Pré-Migração

## Status dos Serviços Internos
- **API Unificada (FastAPI / Wave 1)**
  - Endereço local: `http://127.0.0.1:18085`
  - Health check: `http://127.0.0.1:18085/api/v1/health` -> `{"status":"ok"}`
  - Proxy Nginx: `/api/v1/`

- **API Legada**
  - Endereço local: `http://127.0.0.1:18083`
  - Health check: `http://127.0.0.1:18083/api/health` -> `{"status":"ok"}`
  - Proxy Nginx: `/api/`

- **Keycloak IAM**
  - Endereço local: `http://127.0.0.1:18086`
  - OpenID Config: `http://127.0.0.1:18086/auth/realms/wins-hub-staging/.well-known/openid-configuration`
  - Proxy Nginx: `/auth/`

- **Nginx Gateway (HTTPS 18443)**
  - Processo: `nginx -c /root/wins_hub_unificado/staging/nginx-host.conf`
  - Certificado SSL: `/etc/letsencrypt/live/winshubcomercial.com.br/fullchain.pem`
  - Chave SSL: `/etc/letsencrypt/live/winshubcomercial.com.br/privkey.pem`
