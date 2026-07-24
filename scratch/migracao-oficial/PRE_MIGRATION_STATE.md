# Inventário e Estado Pré-Migração — WiNS Hub Oficial

Data: 2026-07-24
Ambiente: Homologação / Produção (Porta HTTPS 18443)
Tag Git de Checkpoint: `pre-migration-checkpoint-20260724`

## 1. Diretório e Arquitetura do Projeto
- Diretório real: `/root/wins_hub_unificado`
- Entrypoint frontend: `/root/wins_hub_unificado/src/main.tsx`
- Framework & Routing: React 19 + React Router DOM 7 (`BrowserRouter`)
- Basename anterior: `/demo/` (em `vite.config.ts` e `App.tsx`)
- Vite base anterior: `/demo/`
- Script de build oficial: `npm run build:gate` (`tsc -b && vite build --mode gate`)
- Variáveis `.env.gate`:
  - `VITE_WINS_WAVE1_REAL=true`
  - `VITE_API_URL=/api/v1`
  - `VITE_AUTH_PROVIDER=keycloak`
  - `VITE_KEYCLOAK_URL=https://winshubcomercial.com.br:18443/auth`
  - `VITE_KEYCLOAK_REALM=wins-hub-staging`
  - `VITE_KEYCLOAK_CLIENT_ID=wins-hub-spa`

## 2. Nginx em 18443 (`staging/nginx-host.conf`)
- Master process Nginx rodando em PID `2734809` com `-c /root/wins_hub_unificado/staging/nginx-host.conf`.
- Routing de proxy:
  - `/api/v1/` -> `http://127.0.0.1:18085` (API unificada Python/FastAPI)
  - `/api/` -> `http://127.0.0.1:18083` (API legada)
  - `/auth/` -> `http://127.0.0.1:18086` (Keycloak 26.2)
  - `/demo/` -> `root /root/wins_hub_unificado/staging-root; try_files $uri $uri/ /demo/index.html;`
  - `/mockups-v2/` -> `alias /root/wins_hub_unificado/mockups-v2/dist/; try_files $uri $uri/ /mockups-v2/index.html;`

## 3. Keycloak & Autenticação
- Realm: `wins-hub-staging`
- Client: `wins-hub-spa` (Public client, PKCE S256)
- Provider `keycloak-js`: 26.2.4
- Silent Check SSO: `silent-check-sso.html`

## 4. Backups de Segurança Salvos
- Nginx Config anterior: `scratch/migracao-oficial/NGINX_BEFORE.conf` (MD5: `90667abbe37134b8b37c2fdbc79c7cf6`)
- Dist anterior: `scratch/migracao-oficial/dist_before`
- Git Tag: `pre-migration-checkpoint-20260724`
