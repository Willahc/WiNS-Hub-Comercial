#!/usr/bin/env bash
# Rollback homolog 8.1b — remove apenas runtimes/nginx novos de Engenharia/Log.
# Default dry-run. Apply: CONFIRM=YES bash rollback_fase81b.sh --apply
# NAO toca: wins_agro, stagings, backups, DNS, VPS menor, saude, agro api
set -euo pipefail
APPLY=0
[[ "${1:-}" == "--apply" ]] && APPLY=1
run(){ if [[ $APPLY -eq 1 ]]; then eval "$*"; else echo "DRY-RUN: $*"; fi; }
echo "mode=$([[ $APPLY -eq 1 ]] && echo APPLY || echo DRY)"
if [[ $APPLY -eq 1 && "${CONFIRM:-}" != "YES" ]]; then echo "need CONFIRM=YES"; exit 2; fi
run "docker compose -f /opt/winshub/engenharia/shared/docker-compose.engenharia.yml down"
run "docker compose -f /opt/winshub/log/shared/docker-compose.log.yml down"
run "nginx -t && systemctl reload nginx"
echo "Preserva dumps, stagings, /opt/winshub codigo, wins_agro, DNS."
