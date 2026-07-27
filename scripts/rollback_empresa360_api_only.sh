#!/bin/bash
# ==============================================================================
# WiNS Hub — Rollback API-only da Empresa 360°
# ==============================================================================
# Uso:  ./scripts/rollback_empresa360_api_only.sh
#
# Este script desfaz APENAS as alterações de código da API (Empresa 360°).
# NÃO ALTERA:
#   - banco de dados (zero SQL, zero DDL, zero GRANT)
#   - nginx (zero alteração de config, zero reload)
#   - schema canonical_mvp
#   - vw_empresa_360
#
# O rollback funciona trocando a tag da imagem Docker para a versão anterior
# (pre-empresa360-<timestamp>) e reiniciando o container api com --no-build.
# ==============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

log() { echo "[$(date '+%H:%M:%S')] $*"; }
err() { echo "[ERRO] $*" >&2; }

# ---------------------------------------------------------------------------
# 0. Pré-validação
# ---------------------------------------------------------------------------
if ! command -v docker &>/dev/null; then
    err "Docker não encontrado — abortando"
    exit 1
fi

API_CONTAINER=$(docker ps --format '{{.Names}}' | grep '\-api' | head -1)
if [ -z "$API_CONTAINER" ]; then
    err "Container da API não encontrado"
    exit 1
fi
log "Container da API: $API_CONTAINER"

# ---------------------------------------------------------------------------
# 1. Descobrir a tag de rollback disponível
# ---------------------------------------------------------------------------
ROLLBACK_TAG=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep 'pre-empresa360-' | sort | tail -1 || true)

if [ -z "$ROLLBACK_TAG" ]; then
    err "Nenhuma imagem com tag 'pre-empresa360-' encontrada"
    err "Rollback manual: git checkout <commit-anterior> && docker compose build api && docker compose up -d api"
    exit 1
fi

CURRENT_TAG=$(docker inspect "$API_CONTAINER" --format '{{.Config.Image}}' 2>/dev/null || echo "unknown")

log "Imagem atual: $CURRENT_TAG"
log "Rollback alvo: $ROLLBACK_TAG"

if [ "$CURRENT_TAG" = "$ROLLBACK_TAG" ]; then
    log "A imagem atual já é a de rollback — nada a fazer"
    exit 0
fi

# ---------------------------------------------------------------------------
# 2. Aplicar rollback via retag + compose
# ---------------------------------------------------------------------------
log "Aplicando rollback: $ROLLBACK_TAG -> wins_agro_v1-api:latest"

# Extrai o repositório da tag de rollback (remove :tag)
REPO="${ROLLBACK_TAG%:*}"
IMAGE_ID=$(docker images --format '{{.ID}}' --filter "reference=$ROLLBACK_TAG" | head -1)

if [ -z "$IMAGE_ID" ]; then
    err "Image ID não encontrado para $ROLLBACK_TAG"
    exit 1
fi

log "Image ID: $IMAGE_ID"

# Salva a imagem atual como rollback-fallback antes de trocar
docker tag "wins_agro_v1-api:latest" "wins_agro_v1-api:rollback-fallback-$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true

# Retag a imagem de rollback como latest
docker tag "$ROLLBACK_TAG" "wins_agro_v1-api:latest"

# ---------------------------------------------------------------------------
# 3. Restaurar código fonte do backup (se disponível)
# ---------------------------------------------------------------------------
BACKUP_DIR=$(ls -d /root/backup_pre_empresa360_*/ 2>/dev/null | sort | tail -1 || true)
if [ -n "$BACKUP_DIR" ]; then
    log "Restaurando código do backup: $BACKUP_DIR"
    if [ -f "${BACKUP_DIR}app.main.py" ]; then
        cp "${BACKUP_DIR}app.main.py" "$ROOT/app/main.py" 2>/dev/null || true
    fi
    if [ -f "${BACKUP_DIR}app.repositories.empresa_360.py" ]; then
        cp "${BACKUP_DIR}app.repositories.empresa_360.py" "$ROOT/app/repositories/empresa_360.py" 2>/dev/null || true
    fi
    if [ -f "${BACKUP_DIR}app.services.empresa_360.py" ]; then
        cp "${BACKUP_DIR}app.services.empresa_360.py" "$ROOT/app/services/empresa_360.py" 2>/dev/null || true
    fi
    if [ -f "${BACKUP_DIR}app.routers.empresa_360.py" ]; then
        cp "${BACKUP_DIR}app.routers.empresa_360.py" "$ROOT/app/routers/empresa_360.py" 2>/dev/null || true
    fi
    if [ -f "${BACKUP_DIR}app.frontend.empresa_360.html" ]; then
        cp "${BACKUP_DIR}app.frontend.empresa_360.html" "$ROOT/app/frontend/empresa_360.html" 2>/dev/null || true
    fi
    if [ -f "${BACKUP_DIR}app.frontend.base.html" ]; then
        cp "${BACKUP_DIR}app.frontend.base.html" "$ROOT/app/frontend/base.html" 2>/dev/null || true
    fi
    if [ -f "${BACKUP_DIR}docker-compose.yml" ]; then
        cp "${BACKUP_DIR}docker-compose.yml" "$ROOT/docker-compose.yml" 2>/dev/null || true
    fi
    log "Código restaurado do backup"
else
    log "Nenhum backup encontrado em /root/backup_pre_empresa360_*/ — pulando restauração de código"
fi

# ---------------------------------------------------------------------------
# 4. Restart da API
# ---------------------------------------------------------------------------
log "Reiniciando container da API com a imagem anterior (sem rebuild)..."
docker compose up -d --no-build api

# ---------------------------------------------------------------------------
# 5. Aguardar healthcheck
# ---------------------------------------------------------------------------
log "Aguardando healthcheck..."
for i in $(seq 1 12); do
    if curl -sf http://127.0.0.1:18083/healthz >/dev/null 2>&1; then
        log "API saudável após rollback"
        break
    fi
    if [ "$i" -eq 12 ]; then
        err "API não ficou saudável após 60s — rollback com problemas"
        exit 1
    fi
    sleep 5
done

# ---------------------------------------------------------------------------
# 6. Pós-validação
# ---------------------------------------------------------------------------
log "--- Pós-validação ---"
for url in \
    "http://127.0.0.1:18083/healthz" \
    "https://winshubcomercial.com.br/"; do
    code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "$url" 2>/dev/null || echo "FAIL")
    log "$url → $code"
done

log "=== Rollback concluído ==="
log "IMPORTANTE: O rollback alterou APENAS o container da API."
log "nginx, banco de dados e configs não foram tocados."
