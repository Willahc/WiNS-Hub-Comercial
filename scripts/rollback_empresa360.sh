#!/bin/bash
# ==============================================================================
# WiNS Hub — Rollback da Empresa 360° + Segurança
# ==============================================================================
# Desfaz as alterações aplicadas no deploy da Fase 1 e 2:
#   1. Restaura a vw_empresa_360 para a versão pré-B83 (sem geografia)
#   2. Remove a tabela empresa_geografia
#   3. Remove os novos endpoints Python do main.py
#   4. Restaura a config nginx original
# ==============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

log() { echo "[$(date '+%H:%M:%S')] $*"; }
warn() { echo "[AVISO] $*"; }

DB_CONT=$(docker ps --format '{{.Names}}' | grep db | head -1)

if [ -z "$DB_CONT" ]; then
    warn "Container do banco não encontrado — pulando rollback de DB"
    SKIP_DB=true
else
    SKIP_DB=false
fi

# ==============================================================================
# 1. Rollback do banco (vw_empresa_360 + empresa_geografia)
# ==============================================================================
if ! $SKIP_DB; then
    log "=== Rollback do banco ==="

    # Restaura a view para a versão sem geografia (CTE original da FASE B4)
    log "Restaurando vw_empresa_360 original (sem geografia)..."
    docker exec -i "$DB_CONT" psql -U postgres -d wins_agro <<'SQL'
CREATE OR REPLACE VIEW canonical_mvp.vw_empresa_360 AS
WITH papeis_agregados AS (
    SELECT pv.entidade_id,
           jsonb_agg(jsonb_build_object('vertical', pv.vertical, 'tipo', pv.tipo, 'fonte', pv.fonte)
                     ORDER BY pv.vertical, pv.tipo) AS papeis,
           count(DISTINCT pv.vertical) FILTER (WHERE pv.ativo = true) AS verticais_ativas,
           count(*) FILTER (WHERE pv.ativo = true) AS total_papeis
    FROM canonical_mvp.papel_vertical pv
    GROUP BY pv.entidade_id
),
fontes_agregadas AS (
    SELECT af.entidade_id,
           count(DISTINCT af.fonte) AS total_fontes,
           max(af.confianca) AS confianca_max
    FROM canonical_mvp.atributo_fonte af
    WHERE af.status = 'ativo'
    GROUP BY af.entidade_id
)
SELECT e.id, e.cnpj, e.cnpj_basico, e.cnpj_ordem, e.cnpj_dv,
       e.razao_social, e.nome_fantasia, e.situacao_cadastral,
       e.natureza_juridica, e.capital_social, e.porte,
       CASE WHEN e.matriz_filial = '1'::bpchar THEN 'MATRIZ'::text ELSE 'FILIAL'::text END AS tipo_matriz,
       e.data_abertura, e.uf, e.municipio, e.codigo_ibge,
       COALESCE(pa.papeis, '[]'::jsonb) AS papeis,
       COALESCE(pa.verticais_ativas, 0::bigint) AS verticais_ativas,
       COALESCE(pa.total_papeis, 0::bigint) AS total_papeis,
       COALESCE(fa.total_fontes, 0::bigint) AS total_fontes,
       COALESCE(fa.confianca_max, e.confianca_geral) AS confianca_geral,
       e.vivo, e.criado_em, e.atualizado_em
FROM canonical_mvp.entidade_empresa e
LEFT JOIN papeis_agregados pa ON pa.entidade_id = e.id
LEFT JOIN fontes_agregadas fa ON fa.entidade_id = e.id;
SQL
    log "vw_empresa_360 restaurada versão original"

    # Remove tabela de geografia
    log "Removendo canonical_mvp.empresa_geografia..."
    docker exec -i "$DB_CONT" psql -U postgres -d wins_agro <<'SQL'
DROP TABLE IF EXISTS canonical_mvp.empresa_geografia CASCADE;
SQL
    log "empresa_geografia removida"
fi

# ==============================================================================
# 2. Rollback do código (main.py + routers/services/repositories)
# ==============================================================================
log "=== Rollback do código ==="

# Restaura main.py (remove import do empresa_360_router)
if [ -f main.py.bak ]; then
    cp main.py.bak main.py
    log "main.py restaurado do backup (.bak)"
else
    log "main.py.bak não encontrado — rollback manual necessário"
    warn "Remova manualmente: as linhas 'from routers.empresa_360 import...' e 'app.include_router(empresa_360_router)'"
fi

# Remove os novos arquivos
for f in routers/empresa_360.py services/empresa_360.py repositories/empresa_360.py frontend/empresa_360.html tests/test_empresa_360.py; do
    if [ -f "$f" ]; then
        rm -f "$f"
        log "Removido: $f"
    fi
done

# Reverte base.html (remove link Empresa 360° do sidebar)
log "Reverta o base.html removendo o link 'Empresa 360°' do sidebar"

# ==============================================================================
# 3. Rollback do nginx
# ==============================================================================
log "=== Rollback do nginx ==="

if [ -f /etc/nginx/sites-available/winshubcomercial.com.br.conf.bak ]; then
    cp /etc/nginx/sites-available/winshubcomercial.com.br.conf.bak /etc/nginx/sites-available/winshubcomercial.com.br.conf
    nginx -t && nginx -s reload
    log "nginx restaurado do backup"
else
    warn "Backup do nginx não encontrado em /etc/nginx/sites-available/"
    warn "Re-aplique manualmente a partir do script enable_tls_winshubcomercial.sh original"
fi

# ==============================================================================
# 4. Rebuild & restart
# ==============================================================================
log "=== Rebuild & restart ==="
docker compose build api
docker compose up -d api nginx

log "=== Rollback concluído ==="
