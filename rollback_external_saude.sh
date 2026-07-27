#!/usr/bin/env bash
# Rollback — publicação externa WiNS Hub Saúde (Fase 7.7)
# Default: DRY-RUN (simulação). Exigir confirmação explícita para aplicar.
#
# Uso:
#   bash rollback_external_saude.sh              # simula
#   bash rollback_external_saude.sh --apply      # aplica (pede CONFIRM=YES)
#   CONFIRM=YES bash rollback_external_saude.sh --apply

set -euo pipefail

APPLY=0
if [[ "${1:-}" == "--apply" ]]; then
  APPLY=1
fi

BACKUP_NGINX_ROOT="${BACKUP_NGINX_ROOT:-/backup_wins_agro/saude/20260718_074407/external_publish_20260718_142456/nginx}"
SHELL_BACKUP="${SHELL_BACKUP:-/backup_wins_agro/saude/20260718_074407/external_publish_20260718_142456/shell/base.html}"
COMPOSE_MAIN="/root/wins_agro_v1/docker-compose.yml"
COMPOSE_SAUDE="/opt/wins-hub-saude/shared/docker-compose.saude.yml"
VHOST_ENABLED="/etc/nginx/sites-enabled/wins-hub-saude.conf"
VHOST_AVAILABLE="/etc/nginx/sites-available/wins-hub-saude.conf"
RATE_CONF="/etc/nginx/conf.d/wins_security_common.conf"
HTPASSWD="/etc/nginx/.htpasswd_saude"
# credencial NÃO é apagada automaticamente (pode ser necessária p/ auditoria)

log() { printf '[rollback_external_saude] %s\n' "$*"; }
run() {
  if [[ "$APPLY" -eq 1 ]]; then
    log "EXEC: $*"
    eval "$@"
  else
    log "DRY-RUN: $*"
  fi
}

log "Modo: $([[ $APPLY -eq 1 ]] && echo APPLY || echo DRY-RUN/SIMULAÇÃO)"
log "Backup nginx: $BACKUP_NGINX_ROOT"

if [[ "$APPLY" -eq 1 ]]; then
  if [[ "${CONFIRM:-}" != "YES" ]]; then
    log "Recusado: defina CONFIRM=YES para aplicar rollback real."
    exit 2
  fi
fi

# 1. Desabilitar vhost Saúde
run "rm -f '$VHOST_ENABLED'"

# 2. Remover confs adicionadas desta fase (rate zones + snippets opcionalmente mantidos)
run "rm -f '$RATE_CONF'"
# vhost available pode permanecer para reativação; remover se desejado:
# run "rm -f '$VHOST_AVAILABLE'"

# 3. nginx -t
if [[ "$APPLY" -eq 1 ]]; then
  nginx -t
else
  log "DRY-RUN: nginx -t (será executado no apply)"
fi

# 4. reload nginx
run "systemctl reload nginx"

# 5. Remover publicação loopback do compose e recriar serviço
#    Mantém container interno se ports forem removidos (expose only)
if [[ -f "$COMPOSE_SAUDE" ]]; then
  run "python3 - <<'PY'
from pathlib import Path
p = Path('$COMPOSE_SAUDE')
text = p.read_text()
# remove ports block for loopback 18080 if present
import re
text2 = re.sub(r'\\n\\s*ports:\\n\\s*#.*\\n\\s*-\\s*\"127\\.0\\.0\\.1:18080:8000\"\\n', '\\n', text)
if text2 == text:
    text2 = text.replace('    ports:\\n      # Fase 7.7: only loopback — host nginx proxies; not public\\n      - \"127.0.0.1:18080:8000\"\\n', '')
if text2 != text:
    p.write_text(text2)
    print('compose_ports_removed')
else:
    print('compose_ports_unchanged_or_manual')
PY"
  run "docker compose -f '$COMPOSE_MAIN' -f '$COMPOSE_SAUDE' up -d saude-api"
fi

# 6. Shell: restaurar base.html e copiar para container api
if [[ -f "$SHELL_BACKUP" ]]; then
  run "cp -a '$SHELL_BACKUP' /root/wins_agro_v1/app/frontend/base.html"
  run "docker cp /root/wins_agro_v1/app/frontend/base.html wins_agro_v1-api-1:/app/frontend/base.html"
fi

# 7. NÃO apagar certificado (se existir)
log "Preservado: certificados, banco, schema saude/core, imagem 5507b90, logs, htpasswd (manual)."

# 8. Outros vhosts intocados
log "Outros vhosts (default, cliente-inteligente) não são restaurados a partir deste script além do reload."

if [[ "$APPLY" -eq 0 ]]; then
  log "Simulação concluída. Para aplicar: CONFIRM=YES bash $0 --apply"
  exit 0
fi

log "Rollback aplicado. Validar: nginx -t; curl Host saude; docker ps; links do shell."
exit 0
