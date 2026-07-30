#!/usr/bin/env bash
# Rollback homologação Fase 8.1 (NÃO altera DNS / NÃO toca VPS menor)
# Default: dry-run. Apply: CONFIRM=YES bash rollback_fase81_homolog.sh --apply
set -euo pipefail
APPLY=0; [[ "${1:-}" == "--apply" ]] && APPLY=1
run(){ if [[ $APPLY -eq 1 ]]; then eval "$*"; else echo "DRY-RUN: $*"; fi; }
echo "mode=$([[ $APPLY -eq 1 ]] && echo APPLY || echo DRY)"
if [[ $APPLY -eq 1 && "${CONFIRM:-}" != "YES" ]]; then echo "need CONFIRM=YES"; exit 2; fi
run "rm -f /etc/nginx/sites-enabled/winshub-homolog-paths.conf"
run "nginx -t && systemctl reload nginx"
echo "Preserva: wins_hub_staging, caminhao_vazio_staging, /opt/winshub, dumps em /backup_wins_agro/fase81_*"
echo "DNS e VPS menor intocados."
