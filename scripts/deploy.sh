#!/bin/bash
# ==============================================================================
# WiNS Hub — Deploy Script Unificado
# ==============================================================================
# Uso:  ./scripts/deploy.sh [--dry-run] [--skip-build] [--skip-nginx] [--skip-db]
#
# Este script executa em ordem:
#   1. Valida pré-requisitos (DNS, TLS, git status)
#   2. Git pull (se em branch de deploy)
#   3. Build & restart dos containers Docker
#   4. Migrações de banco (SQL)
#   5. Aplica config nginx (winshubcomercial + winshubagro)
#   6. Valida pós-deploy (healthcheck)
# ==============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DRY_RUN=false
SKIP_BUILD=false
SKIP_NGINX=false
SKIP_DB=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run) DRY_RUN=true ;;
        --skip-build) SKIP_BUILD=true ;;
        --skip-nginx) SKIP_NGINX=true ;;
        --skip-db) SKIP_DB=true ;;
        -v|--verbose) VERBOSE=true ;;
        *) echo "Uso: $0 [--dry-run] [--skip-build] [--skip-nginx] [--skip-db]"; exit 1 ;;
    esac
    shift
done

log() { echo "[$(date '+%H:%M:%S')] $*"; }
warn() { echo "[AVISO] $*"; }
err() { echo "[ERRO] $*" >&2; }

run() {
    if $DRY_RUN; then echo "[DRY-RUN] $*"; return 0; fi
    if $VERBOSE; then log "EXEC: $*"; fi
    "$@"
}

# ==============================================================================
# FASE 0: Pré-validação
# ==============================================================================
log "=== WiNS Hub Deploy ==="

if ! command -v docker &>/dev/null; then err "Docker não encontrado"; exit 1; fi
if ! command -v nginx &>/dev/null; then warn "nginx não encontrado — deploy só do código"; fi

# ==============================================================================
# FASE 1: Build & Restart dos Containers
# ==============================================================================
if ! $SKIP_BUILD; then
    log "--- Build da API ---"
    run docker compose build api

    log "--- Restart dos containers ---"
    run docker compose up -d api nginx

    log "--- Aguardando healthcheck da API ---"
    for i in $(seq 1 12); do
        if curl -sf http://127.0.0.1:18083/healthz >/dev/null 2>&1; then
            log "API saudável"
            break
        fi
        if [ "$i" -eq 12 ]; then
            err "API não ficou saudável após 60s"
            exit 1
        fi
        sleep 5
    done
fi

# ==============================================================================
# FASE 2: Migrações de Banco
# ==============================================================================
if ! $SKIP_DB; then
    log "--- Migrações do banco ---"

    DB_CONT=$(docker ps --format '{{.Names}}' | grep db | head -1)
    if [ -z "$DB_CONT" ]; then
        err "Container do banco não encontrado"
        exit 1
    fi

    psql_db() { docker exec -i "$DB_CONT" psql -U postgres -d wins_agro "$@"; }

    # Grant para wins_app no schema canonical_mvp (se não existir)
    log "Grant wins_app no canonical_mvp..."
    run psql_db -c "GRANT USAGE ON SCHEMA canonical_mvp TO wins_app;" 2>/dev/null || true
    run psql_db -c "GRANT SELECT ON ALL TABLES IN SCHEMA canonical_mvp TO wins_app;" 2>/dev/null || true

    log "Migrações concluídas"
fi

# ==============================================================================
# FASE 3: Configuração nginx
# ==============================================================================
if ! $SKIP_NGINX; then
    if command -v nginx &>/dev/null; then
        log "--- Aplicando config nginx ---"

        # winshubagro.cloud
        if [ -f /etc/nginx/sites-available/winshubagro.cloud.conf ]; then
            run cp "$ROOT/nginx/nginx.conf" /etc/nginx/sites-available/winshubagro.cloud.conf
            log "winshubagro: config copiada"
        fi

        # winshubcomercial.com.br (se a config melhorada existir)
        if [ -f /etc/nginx/sites-available/winshubcomercial.com.br.conf ]; then
            run cp "$ROOT/nginx/winshubcomercial.conf.improved" /etc/nginx/sites-available/winshubcomercial.com.br.conf
            log "winshubcomercial: config copiada (CORRIGIDA — headers repetidos)"
        fi

        # Valida e recarrega
        if nginx -t; then
            run nginx -s reload
            log "nginx recarregado com sucesso"
        else
            err "nginx -t falhou — config NÃO aplicada"
            exit 1
        fi
    fi
fi

# ==============================================================================
# FASE 4: Pós-validação
# ==============================================================================
log "--- Pós-validação ---"

# URLs para validar
URLS=(
    "https://winshubcomercial.com.br/"
    "https://winshubcomercial.com.br/agro/"
    "https://winshubcomercial.com.br/engenharia/"
    "https://winshubcomercial.com.br/log/"
    "https://winshubcomercial.com.br/saude/"
    "https://winshubagro.cloud/"
)

for url in "${URLS[@]}"; do
    code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "$url" 2>/dev/null || echo "FAIL")
    if [ "$code" = "200" ] || [ "$code" = "307" ] || [ "$code" = "401" ]; then
        log "OK $url → $code"
    else
        warn "$url → $code (inesperado)"
    fi
done

# Valida headers de segurança
log "--- Verificando headers de segurança ---"
HEADER_TESTS=(
    "winshubcomercial.com.br/agro/"
    "winshubcomercial.com.br/engenharia/"
    "winshubcomercial.com.br/log/"
)
for url in "${HEADER_TESTS[@]}"; do
    full="https://$url"
    hsts=$(curl -sI "$full" 2>/dev/null | grep -i "strict-transport-security" || true)
    csp=$(curl -sI "$full" 2>/dev/null | grep -i "content-security-policy" || true)
    if [ -n "$hsts" ] && [ -n "$csp" ]; then
        log "OK headers $full"
    else
        warn "HEADERS FALTANDO em $full — HSTS=$([ -n "$hsts" ] && echo 'sim' || echo 'não') CSP=$([ -n "$csp" ] && echo 'sim' || echo 'não')"
    fi
done

log "=== Deploy concluído ==="
