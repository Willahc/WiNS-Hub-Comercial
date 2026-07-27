#!/bin/bash
# ==============================================================================
# WiNS Hub — Script de Rollback de Nginx e CSP (Etapa 2)
# ==============================================================================
set -euo pipefail

BACKUP_DIR="/root/backup_pre_nginx_csp_20260720_1428"

if [ ! -d "$BACKUP_DIR" ]; then
    echo "[ERRO] Diretório de backup não encontrado: $BACKUP_DIR" >&2
    exit 1
fi

echo "[1/4] Restaurando arquivos do nginx do backup..."
cp "$BACKUP_DIR/winshubcomercial.com.br.conf" "/etc/nginx/sites-available/winshubcomercial.com.br.conf"
cp "$BACKUP_DIR/wins-hub-security-headers.conf" "/etc/nginx/snippets/wins-hub-security-headers.conf"

echo "[2/4] Validando sintaxe da configuração do nginx..."
nginx -t

echo "[3/4] Executando reload do nginx (sem downtime)..."
nginx -s reload

echo "[4/4] Validando acessibilidade das rotas de baseline..."
URLS=(
    "https://winshubcomercial.com.br/"
    "https://winshubcomercial.com.br/login"
    "https://winshubcomercial.com.br/agro/"
    "https://winshubcomercial.com.br/engenharia/"
    "https://winshubcomercial.com.br/log/"
    "https://winshubcomercial.com.br/saude/"
    "https://winshubcomercial.com.br/agro/empresa-360"
)

for url in "${URLS[@]}"; do
    code=$(curl -sS -o /dev/null -w "%{http_code}" --connect-timeout 5 "$url" 2>/dev/null || echo "FAIL")
    echo "GET $url -> Status: $code"
done

echo "=== ROLLBACK NGINX E CSP CONCLUÍDO ==="
