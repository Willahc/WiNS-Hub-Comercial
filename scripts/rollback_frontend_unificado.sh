#!/usr/bin/env bash
# Rollback do frontend unificado — executar somente apos uma implantacao autorizada.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/root/backup_pre_frontend_unificado_20260720_174407}"
if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "BACKUP_DIR nao definido ou inexistente; nenhum arquivo foi alterado." >&2
  exit 2
fi

for path in shell templates verticals; do
  [[ -d "$BACKUP_DIR/$path" ]] || { echo "Backup incompleto: $path" >&2; exit 3; }
done

# A aplicacao deve fornecer um manifesto com pares origem:destino.
MANIFEST="$BACKUP_DIR/manifest.frontend"
[[ -f "$MANIFEST" ]] || { echo "Manifesto ausente: $MANIFEST" >&2; exit 4; }
while IFS='|' read -r source target; do
  [[ -z "${source// }" || "$source" == \#* ]] && continue
  [[ "$source" == /* && "$target" == /* ]] || { echo "Entrada invalida no manifesto" >&2; exit 5; }
  if [[ -d "$BACKUP_DIR/$source" ]]; then
    mkdir -p "$target"
    cp -a "$BACKUP_DIR/$source/." "$target/"
  else
    install -D -m 0644 "$BACKUP_DIR/$source" "$target"
  fi
done < "$MANIFEST"

bash -n "$0"
if command -v nginx >/dev/null 2>&1; then nginx -t
elif command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx 'wins_agro_v1-nginx-1'; then
  docker exec wins_agro_v1-nginx-1 nginx -t
fi
echo "Rollback do frontend concluido; banco, dados, grants e certificados nao foram tocados."
