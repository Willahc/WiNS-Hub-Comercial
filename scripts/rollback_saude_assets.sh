#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR="${1:-}"
if [[ -z "$BACKUP_DIR" || ! -d "$BACKUP_DIR/docs" ]]; then
  echo "Uso: $0 /root/backup_pre_saude_assets_locais_<timestamp>" >&2
  exit 2
fi
TARGET=/opt/wins-hub-saude/releases/5507b90/docs
BUILD=/opt/wins-hub-saude/build/5507b90/docs
cp -a "$BACKUP_DIR/docs/." "$TARGET/"
cp -a "$BACKUP_DIR/docs/." "$BUILD/"
find "$TARGET" -type f -print0 | sort -z | xargs -0 sha256sum > "$BACKUP_DIR/rollback_checksums_after.sha256"
echo "Frontend Saúde restaurado; Basic Auth, banco e Nginx não foram alterados."
