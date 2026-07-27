#!/usr/bin/env bash
# WiNS Hub Agro — Rollback de Autenticação e Frontend (Etapa 3)
set -euo pipefail

BACKUP_DIR="/root/backup_pre_agro_auth_20260720_1533"

if [ ! -d "$BACKUP_DIR" ]; then
    echo "ERROR: Diretorio de backup $BACKUP_DIR nao encontrado." >&2
    exit 1
fi

echo "Restaurando arquivos de autenticação e frontend a partir do backup..."

# Restaurando arquivos principais
cp "$BACKUP_DIR/main.py" "/root/wins_agro_v1/app/main.py"
cp "$BACKUP_DIR/auth.py" "/root/wins_agro_v1/app/auth.py"
cp "$BACKUP_DIR/base.html" "/root/wins_agro_v1/app/frontend/base.html"
cp "$BACKUP_DIR/login.html" "/root/wins_agro_v1/app/frontend/login.html"

# Removendo arquivo de teste novo se existir
rm -f "/root/wins_agro_v1/app/tests/test_etapa3_auth.py"

echo "Rollback concluido com sucesso."
