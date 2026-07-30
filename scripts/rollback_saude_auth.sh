#!/usr/bin/env bash
# WiNS Hub Saúde — Rollback de Autenticação Saneado (Etapa 4A)
set -euo pipefail

BACKUP_DIR="/root/backup_clean_saude_auth"

if [ ! -d "$BACKUP_DIR" ]; then
    echo "ERROR: Diretorio de backup saneado $BACKUP_DIR nao encontrado." >&2
    exit 1
fi

echo "Restaurando arquivos de autenticação da vertical Saúde (Saneados)..."

# Restaurando o arquivo sem credenciais
cp "$BACKUP_DIR/login.html" "/opt/wins-hub-saude/build/5507b90/docs/login.html"
cp "$BACKUP_DIR/login.html" "/opt/wins-hub-saude/releases/5507b90/docs/login.html"

echo "Rollback saneado concluido com sucesso."
