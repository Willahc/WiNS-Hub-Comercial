# WiNS Hub — Runbook Operacional

## Infraestrutura

| Item | Valor |
|------|-------|
| VPS principal | 2.25.162.199 (8 GB RAM, 2 vCPU, ~96 GB disco) |
| VPS secundária | (backup, contingência, Cliente Inteligente) |
| Domínio principal | `winshubcomercial.com.br` |
| Domínio Agro | `winshubagro.cloud` |
| Docker Compose | `/root/wins_agro_v1/docker-compose.yml` |
| Código fonte | `/root/wins_agro_v1/` |
| .env | `/root/wins_agro_v1/.env` |

## Serviços (Docker)

| Serviço | Porta interna | Healthcheck | Descrição |
|---------|--------------|-------------|-----------|
| `db` (PostgreSQL 16+PostGIS) | 5432 | `pg_isready` | Banco principal |
| `api` (FastAPI) | 8000 | `/healthz` | Backend Python |
| `nginx` | 80/443 | `nginx -t` | Reverse proxy |
| `certbot` | — | — | TLS renewal |

## Endpoints críticos (winshubcomercial.com.br)

| Rota | Proxy para | Porta |
|------|-----------|-------|
| `/` | Shell estático | — |
| `/agro/` | `hub_agro_api` | 18083 |
| `/engenharia/` | `hub_engenharia` | 18081 |
| `/log/` | `hub_log_api` | 18082 |
| `/saude/` | `hub_saude_api` | 18080 |

## Deploy

```bash
# Deploy completo
./scripts/deploy.sh

# Apenas código (pula nginx e DB)
./scripts/deploy.sh --skip-nginx --skip-db

# Apenas nginx
./scripts/deploy.sh --skip-build --skip-db

# Dry run
./scripts/deploy.sh --dry-run -v
```

## Rollback

```bash
# Rollback completo (DB + código + nginx)
./scripts/rollback_empresa360.sh
```

## Monitoramento

### Healthcheck
```bash
# Executar manualmente
bash /root/wins_hub_auditoria/scripts/healthcheck.sh

# Configurar no cron (a cada 5 min)
# */5 * * * * root /root/wins_hub_auditoria/scripts/healthcheck.sh
```

### Alertas (recomendados)

| Alerta | Canal | Critério |
|--------|-------|----------|
| Site fora do ar | Webhook (Slack/Pushover) | Healthcheck HTTP != 2xx/401 |
| Disco ≥ 80% | Webhook | `df /` ≥ 80% |
| Container unhealthy | Webhook | Docker healthcheck falhou |
| Certificado < 30 dias | Webhook | `openssl x509 -checkend` |
| Backup ausente | Webhook | Heartbeat ausente em 24h |
| Nginx config inválida | Webhook | `nginx -t` falhou |

### Heartbeat (healthchecks.io)
Configurar no `/root/wins_agro_v1/.backup_env`:
```
HEARTBEAT_URL=https://hc-ping.com/seu-uuid-aqui
```

## Backups

| Item | Detalhe |
|------|---------|
| Script | `/root/wins_agro_v1/scripts/backup_db.sh` |
| Local | `/root/backups_db/` (retenção 14 dias) |
| Offsite | SCP via OFFSITE_TARGET |
| Cifrado | GPG assimétrico (chave privada OFFSITE) |
| Formato | `pg_dump -Fc` (custom) |
| Exclui | `cnpj.stg_*` (dados RFB re-geráveis) |
| Tamanho típico | ~440 MB cifrado |
| Config | `/root/wins_agro_v1/.backup_env` |

### Teste de restauração
```bash
# 1. Criar container temporário
docker run -d --name db_test postgis/postgis:16-3.4-alpine

# 2. Decifrar backup
gpg --decrypt /root/backups_db/wins_agro_20260719_120000.dump.gpg > restore.dump

# 3. Restaurar
docker exec -i db_test pg_restore -U postgres -d wins_agro < restore.dump

# 4. Validar
docker exec db_test psql -U postgres -d wins_agro -c "SELECT count(*) FROM canonical_mwp.entidade_empresa"

# 5. Remover container de teste
docker rm -f db_test
```

## Empresa 360° — API

| Endpoint | Descrição | Autenticação |
|----------|-----------|-------------|
| `GET /api/empresa/{cnpj}` | Busca por CNPJ | JWT |
| `GET /api/empresa/id/{id}` | Busca por UUID | JWT |
| `GET /api/empresa/{id}/fontes` | Fontes de dados | JWT |
| `GET /api/empresa/{id}/papeis` | Papéis verticais | JWT |
| `GET /api/empresa/{id}/conflitos` | Conflitos geográficos | JWT |
| `GET /api/empresa/{id}/geografias` | Todas as geografias | JWT |
| `GET /api/empresas` | Listagem paginada | JWT |
| `GET /api/empresas/estatisticas` | Estatísticas | JWT |

## Segurança

### Headers (nginx winshubcomercial)
TODOS os locations com `add_header` próprio DEVEM repetir todos os security headers:

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=()" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" always;
```

### Cookies de sessão
- `access_token`: httponly, secure, samesite=lax, 8h de expiração
- `wa_chal`: httponly, secure, samesite=lax, 5 min

## Troubleshooting

### API retornando 502
1. Verificar se o container está rodando: `docker ps | grep api`
2. Verificar logs: `docker logs wins_agro_v1-api-1 --tail 50`
3. Verificar se o banco está acessível: `docker exec wins_agro_v1-db-1 pg_isready`

### Login não funciona
1. Verificar SECRET_KEY no .env
2. Verificar MARI_PASSWORD_HASH
3. Verificar rate limit: acesso via `/agro/` precisa bater em `/agro/login`

### Queda de performance
1. Verificar locks: `docker exec wins_agro_v1-db-1 psql -U postgres -c "SELECT * FROM pg_locks WHERE NOT granted"`
2. Verificar disco: `df -h /`
3. Verificar transações longas: `docker exec wins_agro_v1-db-1 psql -U postgres -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE state = 'active' AND now() - pg_stat_activity.query_start > interval '5 minutes'"`

### Certificado expirando
```bash
# Renovação manual
docker exec wins_agro_v1-certbot-1 certbot renew
# Ou no host:
certbot renew
```

## Responsáveis

| Área | Responsável | Contato |
|------|-------------|---------|
| Operação | — | — |
| Banco | — | — |
| Frontend | — | — |
| Segurança | — | — |
