#!/bin/bash
# rollback_app_saude.sh
# Rollback da aplicação WiNS Hub Saúde (Fase 7.6)
# Uso: bash rollback_app_saude.sh

set -euo pipefail

echo "[ROLLBACK] Removendo container saude-api..."
docker compose -f /root/wins_agro_v1/docker-compose.yml \
  -f /opt/wins-hub-saude/shared/docker-compose.saude.yml \
  down saude-api 2>/dev/null || true

echo "[ROLLBACK] Removendo imagem..."
docker rmi wins-hub-saude:5507b90 2>/dev/null || true

echo "[ROLLBACK] Removendo env_file..."
rm -f /opt/wins-hub-saude/shared/saude.env

echo "[ROLLBACK] Verificando servicos originais..."
docker ps
echo ""
echo "[ROLLBACK] Concluido. Role wins_saude_app preservada no banco."
echo "[ROLLBACK] Para remove-la: docker exec -i wins_agro_v1-db-1 psql -U postgres -d wins_agro -c \"DROP ROLE IF EXISTS wins_saude_app;\""
