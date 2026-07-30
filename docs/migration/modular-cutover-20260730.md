# Modular Platform Cutover — 2026-07-30

## Origin
- **Source repository**: `/root/wins_hub_unificado` (local, no remote)
- **Last source SHA**: `5be8a7f757b77371fd718f64a3e834a736ffd47c`
- **Author of last commit**: WiNS Migration Bot
- **Source history**: 28 commits, 7 tags, 2 branches (`main`, `master`)

## Local commits (chronological)

| SHA | Message |
|-----|---------|
| 9f23371 | checkpoint: pre-migration initial state |
| 0536bf8 | chore: official app migration foundation |
| 8aba89f | feat: official login |
| 044a820 | feat: official overview |
| cfb51d8 | feat: official engineering dashboard |
| 1a5920f | feat: official works directory |
| 85d9c06 | feat: official work detail |
| ae2042b | test: official app gates |
| 323008d | deploy: official root cutover |
| 650aea0 | fix(engineering): bind restored dashboard to canonical metrics |
| bd7c1cf | fix(engineering): reconcile work detail semantics and provenance |
| 6f8d32e | fix(engineering): reconcile work 648c945f semantics and provenance |
| cc7ee41 | fix(engineering): update operational status label for active works |
| 93121d7 | feat(engineering): link service providers and explain work match scores |
| 5f4110a | fix(engineering): map operational opportunities and stabilize provenance |
| f1db234 | fix(engineering): prevent provenance tab render lock |
| 32189bc | fix(engineering): remove duplicate dashboard card metrics |
| 57cfedd | fix(engineering): refine semantic labels for people and matchmaker coverage |
| 865f211 | feat(relationships): complete canonical graph integration and review security |
| b6f28dd | feat(relationships): add backend review endpoint with Keycloak identity and audit |
| b6a970b | feat(relacionamentos): publicar autorizacao por allowlist, escrita real e auditoria keycloak |
| f792dcc | feat(relacionamentos): materializacao de arestas reais do grafo e relatorio atualizado |
| d14cf9a | feat(engenharia): evolucao do catalogo de obras com filtros server-side |
| f2751cd | feat(engenharia): evolucao do catalogo de prestadores de servicos |
| e4eb297 | fix(engenharia): reconciliacao estrita do universo de prestadores |
| b5d302a | feat(engenharia): evolucao do catalogo de fornecedores de insumos |
| 44c9952 | feat(relationships): improve investigation search and empty state |
| 5be8a7f | feat(agro): E2E gate, nomenclatura precisa dos KPIs e auditoria do mapa |

## Local tags

| Tag | Message |
|-----|---------|
| pre-migration-checkpoint-20260724 | Baseline before official root cutover |
| v2.4.0-relacionamentos-approved | Release oficial de relacionamentos com arestas reais |
| v2.5.0-obras-catalog-evolved | Catalogo de obras com filtros server-side e taxonomia CAPEX |
| v2.6.0-prestadores-catalog-evolved | Catalogo de empresas prestadoras de servicos |
| v2.7.0-prestadores-reconciled | Reconciliacao estrita do universo de prestadores |
| v2.8.0-insumos-catalog-evolved | Catalogo de Fornecedores de Insumos da Engenharia |
| v2.9.0-relationships-search-evolved | Busca e Estado Inicial do Modulo de Relacionamentos |

## Preserved monolith
- **Monolith SHA**: `136f976512b0922cde6da3be085abb26c5727b71`
- **Preservation tag**: `pre-modular-migration-20260730`
- **Preservation branch**: `legacy/monolith-pre-modular-migration`

## Transport method
- **Tool**: `rsync -ah` with explicit exclusion list
- **Exclusions applied**:
  - `.git/` (git history not imported)
  - `.env`, `.env.*` (environment variables with potential secrets)
  - `__pycache__/`, `*.pyc`, `*.pyo` (compiled Python)
  - `node_modules/` (npm dependencies)
  - `dist/` (build output)
  - `.pytest_cache/`
  - `mockups-v2/` (design mockups, separate concern)
  - `scratch/` (contained hardcoded DB passwords — **real secrets excluded**)
  - `arquivos/` (data files, screenshots)
  - `screenshots/` (test screenshots)
  - `staging-root/` (old demo build artifact)
  - `docs/audits/engineering-inputs/` (1.7 GB CSV with raw supplier data)
  - `apps/api/data/` (generated supplier evidence JSON)
  - `package-lock.json` (regenerable)
  - `.gitignore` (manually reconciled)
  - `.github/` (manually reconciled)
  - `README.md` (manually reconciled)

## Previous structure (monolith)
```
app/                    # Monolithic FastAPI application
engineering_vertical/   # Old vertical SPA
engineering_capture/    # Old capture scripts
nginx/                  # Nginx config
docker-compose.yml      # Production compose
scripts/                # Operational scripts
systemd/                # Systemd service files
migrations/             # SQL migrations
```

## New structure (modular)
```
apps/api/               # Modular FastAPI backend (Dockerfile, routes, repositories)
src/                    # React SPA frontend (TypeScript, Vite)
public/                 # Static assets (favicon, icons, Keycloak SSO)
staging/                # E2E tests and external gate validations
pipelines/              # Database functions, seeds, schema, views, triggers
scripts/                # Audit and data processing scripts
docs/                   # Documentation, migration records
.github/workflows/      # CI pipelines (ci.yml + agro-e2e.yml)
nginx/                  # Nginx config (preserved from monolith)
docker-compose.yml      # Production compose (preserved from monolith)
systemd/                # Systemd services (preserved from monolith)
migrations/             # SQL migrations (preserved from monolith)
certbot/                # Let's Encrypt (preserved from monolith)
logrotate/              # Log rotation (preserved from monolith)
```

## Production containers using modular code
| Container | Image | Code source |
|-----------|-------|-------------|
| wins_agro_v1-hub-api-1 | wins_agro_v1-hub-api | `apps/api/` (built via Dockerfile, context `../wins_hub_unificado/apps/api`) |
| SPA | N/A | `src/` built with Vite, served by Nginx |

## Build steps
1. `npm install`
2. `npm run build` (Vite → `dist/`)
3. `docker build -f apps/api/Dockerfile -t wins_agro_v1-hub-api apps/api/`

## Deployment steps
- Current production runs from `/root/wins_agro_v1/docker-compose.yml`
- Docker build context: `../wins_hub_unificado/apps/api`
- No bind-mounts for API code; image is rebuilt and container restarted

## Rollback plan
1. Restore monolith from tag `pre-modular-migration-20260730`
2. Rebuild monolith Docker image from `app/Dockerfile` or restore previous container
3. Restore old Nginx config from preserved branch `legacy/monolith-pre-modular-migration`

## Known limitations
1. `docs/` content from monolith was removed (was specific to old vertical approach)
2. `scripts/` was merged: 4 modular audit scripts added alongside ~230 monolith scripts
3. `.gitignore` was extended; the old `staging/` blanket exclusion was removed to track modular E2E tests
4. Hardcoded credentials found in `scratch/` directory were excluded; that directory must NOT be published
5. Some modular app scripts reference `mock_jwt_token_wave1` (test mocks, not real tokens)
