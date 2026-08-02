#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
MANIFEST="$SCRIPT_DIR/agro-release.json"
MODE="dry-run"
COMPOSE_FILE="/root/wins_agro_v1/docker-compose.yml"
COMPOSE_PROJECT="wins_agro_v1"
PRODUCTION_CONTAINER="wins_agro_v1-hub-api-1"
PRODUCTION_ENV_FILE="/root/wins_agro_v1/.env"
PRODUCTION_NETWORK="wins_agro_v1_default"

usage() {
  echo "Uso: $0 [--dry-run|--apply]"
}

case "${1:---dry-run}" in
  --dry-run) MODE="dry-run" ;;
  --apply) MODE="apply" ;;
  -h|--help) usage; exit 0 ;;
  *) usage >&2; exit 2 ;;
esac
[[ $# -le 1 ]] || { usage >&2; exit 2; }

log() { printf '[%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"; }
fail() { printf '[ERRO] %s\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || fail "Comando obrigatório ausente: $1"; }

for command_name in git python3 npm npx ruff pytest docker curl sha256sum; do need "$command_name"; done
[[ -f "$MANIFEST" ]] || fail "Manifesto ausente: $MANIFEST"

manifest_values="$({ python3 - "$MANIFEST" <<'PY'
import json, re, sys
path = sys.argv[1]
with open(path, encoding="utf-8") as handle:
    data = json.load(handle)
schema = {
    "release_id": None,
    "repository": None,
    "backend": {"commit": None, "source_path": None},
    "frontend": {"commit": None, "source_path": None},
    "production": {"domain": None, "frontend_destination": None},
}
def validate(value, expected, where="manifest"):
    if not isinstance(value, dict):
        raise SystemExit(f"{where} deve ser objeto")
    unknown = sorted(set(value) - set(expected))
    missing = sorted(set(expected) - set(value))
    if unknown or missing:
        raise SystemExit(f"{where}: campos desconhecidos={unknown}; ausentes={missing}")
    for key, child in expected.items():
        if child is not None:
            validate(value[key], child, f"{where}.{key}")
        elif not isinstance(value[key], str) or not value[key]:
            raise SystemExit(f"{where}.{key} deve ser string não vazia")
validate(data, schema)
for side in ("backend", "frontend"):
    if not re.fullmatch(r"[0-9a-f]{40}", data[side]["commit"]):
        raise SystemExit(f"SHA inválido em {side}.commit")
if data["repository"] != "Willahc/WiNS-Hub-Comercial":
    raise SystemExit("repository não autorizado")
if data["production"]["frontend_destination"] != "/opt/winshub/spa":
    raise SystemExit("destino frontend inesperado")
print(data["release_id"])
print(data["repository"])
print(data["backend"]["commit"])
print(data["backend"]["source_path"])
print(data["frontend"]["commit"])
print(data["frontend"]["source_path"])
print(data["production"]["domain"])
print(data["production"]["frontend_destination"])
PY
} 2>&1)" || fail "Manifesto inválido: $manifest_values"

mapfile -t manifest_fields <<<"$manifest_values"
RELEASE_ID="${manifest_fields[0]}"
REPOSITORY="${manifest_fields[1]}"
BACKEND_SHA="${manifest_fields[2]}"
BACKEND_SOURCE_PATH="${manifest_fields[3]}"
FRONTEND_SHA="${manifest_fields[4]}"
FRONTEND_SOURCE_PATH="${manifest_fields[5]}"
PRODUCTION_DOMAIN="${manifest_fields[6]}"
FRONTEND_DESTINATION="${manifest_fields[7]}"
IMAGE_TAG="wins-hub-api:agro-radar-${BACKEND_SHA:0:7}"
UTC_STAMP="$(date -u +'%Y%m%dT%H%M%SZ')"
ARTIFACT_DIR="/tmp/winshub-release-artifacts/${RELEASE_ID}-${UTC_STAMP}"
TEMP_ROOT="$(mktemp -d "/tmp/${RELEASE_ID}.XXXXXX")"
BACKEND_WORKTREE="$TEMP_ROOT/backend"
FRONTEND_WORKTREE="$TEMP_ROOT/frontend"
CANARY_NAME="agro-release-canary-${BACKEND_SHA:0:7}-$$"

cleanup() {
  docker rm -f "$CANARY_NAME" >/dev/null 2>&1 || true
  git -C "$REPO_ROOT" worktree remove --force "$BACKEND_WORKTREE" >/dev/null 2>&1 || true
  git -C "$REPO_ROOT" worktree remove --force "$FRONTEND_WORKTREE" >/dev/null 2>&1 || true
}
trap cleanup EXIT

mkdir -p "$ARTIFACT_DIR"
log "release_id=$RELEASE_ID mode=$MODE"
log "Buscando refs remotas sem alterar a branch aberta"
git -C "$REPO_ROOT" fetch origin --prune

remote_refs="$(git -C "$REPO_ROOT" ls-remote origin)"
grep -q "^${BACKEND_SHA}[[:space:]]" <<<"$remote_refs" || fail "SHA backend não existe no remoto: $BACKEND_SHA"
grep -q "^${FRONTEND_SHA}[[:space:]]" <<<"$remote_refs" || fail "SHA frontend não existe no remoto: $FRONTEND_SHA"
git -C "$REPO_ROOT" cat-file -e "${BACKEND_SHA}^{commit}" || fail "Objeto backend ausente após fetch"
git -C "$REPO_ROOT" cat-file -e "${FRONTEND_SHA}^{commit}" || fail "Objeto frontend ausente após fetch"

git -C "$REPO_ROOT" worktree add --detach "$BACKEND_WORKTREE" "$BACKEND_SHA"
git -C "$REPO_ROOT" worktree add --detach "$FRONTEND_WORKTREE" "$FRONTEND_SHA"
[[ "$(git -C "$BACKEND_WORKTREE" rev-parse HEAD)" == "$BACKEND_SHA" ]] || fail "Worktree backend em SHA incorreto"
[[ "$(git -C "$FRONTEND_WORKTREE" rev-parse HEAD)" == "$FRONTEND_SHA" ]] || fail "Worktree frontend em SHA incorreto"
[[ -z "$(git -C "$BACKEND_WORKTREE" status --porcelain)" ]] || fail "Worktree backend está sujo antes dos gates"
[[ -z "$(git -C "$FRONTEND_WORKTREE" status --porcelain)" ]] || fail "Worktree frontend está sujo antes dos gates"

backend_root="$(realpath "$BACKEND_WORKTREE/$BACKEND_SOURCE_PATH")"
frontend_root="$(realpath "$FRONTEND_WORKTREE/$FRONTEND_SOURCE_PATH")"
[[ -d "$backend_root" && -f "$backend_root/Dockerfile" ]] || fail "Raiz backend inválida: $backend_root"
[[ -d "$frontend_root" && -f "$frontend_root/package.json" ]] || fail "Raiz frontend inválida: $frontend_root"
[[ "$backend_root" != /root/wins_hub_unificado* ]] || fail "Backend proibido: checkout principal"
[[ "$frontend_root" != /root/wins_hub_unificado* ]] || fail "Frontend proibido: checkout principal"

log "Gates backend em $BACKEND_SHA"
(
  cd "$BACKEND_WORKTREE"
  ruff check apps/api
  python3 -m py_compile apps/api/*.py
  pytest -q \
    apps/api/test_agro_canal_tecnico.py \
    apps/api/test_agro_holdings_catalog.py \
    apps/api/test_agro_people_links.py \
    apps/api/test_agro_production_truth.py \
    apps/api/test_agro_propriedades_catalog.py \
    apps/api/test_agro_radar_sinais.py
  git diff --check
  routes_file="apps/api/routes.py"
  for endpoint in \
    '/agro/oportunidades/status' '/agro/oportunidades' '/agro/oportunidades/funil' \
    '/agro/oportunidades/regras' '/agro/oportunidades/calculadas' '/agro/imoveis' \
    '/agro/pessoas-vinculos' '/agro/holdings' '/agro/tecnicos' '/agro/deserto-veterinario'; do
    grep -Fq "$endpoint" "$routes_file" || fail "Endpoint backend ausente: /api/v1$endpoint"
  done
  grep -Fq 'deprecated' "$routes_file" || fail "Alias depreciado sem marcação"
)
BACKEND_GATE="pass"

log "Construindo imagem imutável $IMAGE_TAG"
docker build --label "org.opencontainers.image.revision=$BACKEND_SHA" \
  --label "com.winshub.release_id=$RELEASE_ID" -t "$IMAGE_TAG" "$backend_root"

[[ -f "$PRODUCTION_ENV_FILE" ]] || fail "Arquivo de ambiente para canário ausente: $PRODUCTION_ENV_FILE"
docker network inspect "$PRODUCTION_NETWORK" >/dev/null 2>&1 || fail "Rede do canário ausente: $PRODUCTION_NETWORK"
docker run -d --name "$CANARY_NAME" --network "$PRODUCTION_NETWORK" \
  --env-file "$PRODUCTION_ENV_FILE" -e DB_HOST=db -e DB_PORT=5432 -e DB_USER=wins_hub_api_ro \
  --entrypoint /bin/sh "$IMAGE_TAG" -c \
  'export DB_PASS="$HUB_DB_PASS"; exec uvicorn main:app --host 0.0.0.0 --port 8000' >/dev/null
CANARY_GATE="fail"
for attempt in $(seq 1 30); do
  if docker exec "$CANARY_NAME" python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=3)" >/dev/null 2>&1; then
    CANARY_GATE="pass"
    break
  fi
  sleep 2
done
[[ "$CANARY_GATE" == "pass" ]] || { docker logs "$CANARY_NAME" >&2 || true; fail "Imagem não respondeu ao health no canário"; }
docker rm -f "$CANARY_NAME" >/dev/null

log "Gates frontend em $FRONTEND_SHA"
(
  cd "$frontend_root"
  npm ci
  npx tsc -b
  npx vitest run
  npx vite build
  git diff --check
)
FRONTEND_GATE="pass"
DIST_DIR="$frontend_root/dist"
[[ -f "$DIST_DIR/index.html" ]] || fail "dist/index.html ausente"

mapfile -t referenced_assets < <(python3 - "$DIST_DIR/index.html" <<'PY'
from html.parser import HTMLParser
import sys
class Assets(HTMLParser):
    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        value = values.get("src") if tag == "script" else values.get("href") if tag == "link" else None
        if value and value.startswith("/"):
            print(value.lstrip("/"))
Assets().feed(open(sys.argv[1], encoding="utf-8").read())
PY
)
[[ ${#referenced_assets[@]} -gt 0 ]] || fail "index.html não referencia assets locais"
for asset in "${referenced_assets[@]}"; do
  [[ -f "$DIST_DIR/$asset" ]] || fail "Asset referenciado ausente: $asset"
done

required_dist_strings=(
  'Sinais e Oportunidades Agro' 'Motor em validação' 'Sinais' 'Candidatas'
  'Em validação' 'Validadas' 'Regras do motor' 'Propriedades' 'Pessoas & Vínculos'
  'Holdings' 'Técnica' 'Deserto Veterinário' 'Genética'
)
for expected in "${required_dist_strings[@]}"; do
  grep -R -a -Fq "$expected" "$DIST_DIR" || fail "Conteúdo esperado ausente no dist: $expected"
done
grep -R -a -Fq '/agro/mapa' "$DIST_DIR" || grep -R -a -Fq 'Mapa Territorial' "$DIST_DIR" || fail "Mapa Agro ausente no dist"
radar_source="$frontend_root/src/pages/AgroOportunidadesApproved.tsx"
for forbidden in 'Fila Comercial' 'Score:' 'Insumos Agrícolas & Fertilizantes' 'Armazenagem & Silos Rurais' 'Frete & Logística de Escoamento' 'Máquinas, Tratores & Irrigação'; do
  ! grep -Fq "$forbidden" "$radar_source" || fail "Conteúdo proibido no Radar: $forbidden"
done

cp -a "$DIST_DIR" "$ARTIFACT_DIR/dist"
ASSET_HASH_FILE="$ARTIFACT_DIR/assets.sha256"
find "$ARTIFACT_DIR/dist/assets" -type f -print0 | sort -z | xargs -0 sha256sum > "$ASSET_HASH_FILE"
cp "$MANIFEST" "$ARTIFACT_DIR/agro-release.json"
IMAGE_ID="$(docker image inspect "$IMAGE_TAG" --format '{{.Id}}')"

python3 - "$ARTIFACT_DIR/report.json" "$RELEASE_ID" "$BACKEND_SHA" "$FRONTEND_SHA" "$IMAGE_TAG" "$IMAGE_ID" "$BACKEND_GATE" "$FRONTEND_GATE" "$CANARY_GATE" "$ASSET_HASH_FILE" <<'PY'
import json, pathlib, sys
report, release_id, backend, frontend, tag, image_id, bg, fg, canary, hashes = sys.argv[1:]
assets = []
for line in pathlib.Path(hashes).read_text().splitlines():
    digest, name = line.split(maxsplit=1)
    assets.append({"name": name, "sha256": digest})
payload = {
    "release_id": release_id,
    "backend_sha": backend,
    "frontend_sha": frontend,
    "proposed_image_tag": tag,
    "image_id": image_id,
    "assets": assets,
    "gates": {"backend": bg, "frontend": fg, "canary": canary},
}
from datetime import datetime, timezone
payload["generated_at_utc"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
pathlib.Path(report).write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
PY

if [[ "$MODE" == "dry-run" ]]; then
  log "DRY-RUN concluído; produção não foi alterada"
  log "Artifact local: $ARTIFACT_DIR"
  exit 0
fi

[[ -d "$FRONTEND_DESTINATION" ]] || fail "Destino frontend não existe: $FRONTEND_DESTINATION"
[[ -f "$COMPOSE_FILE" ]] || fail "Compose de produção ausente: $COMPOSE_FILE"
docker inspect "$PRODUCTION_CONTAINER" >/dev/null 2>&1 || fail "Container atual ausente: $PRODUCTION_CONTAINER"
BACKUP_ROOT="/srv/winshub/backups/releases/${RELEASE_ID}-${UTC_STAMP}"
mkdir -p "$BACKUP_ROOT/frontend"
docker inspect "$PRODUCTION_CONTAINER" > "$BACKUP_ROOT/container.json"
OLD_IMAGE="$(docker inspect "$PRODUCTION_CONTAINER" --format '{{.Config.Image}}')"
docker image inspect "$OLD_IMAGE" > "$BACKUP_ROOT/image.json"
printf '%s\n' "$OLD_IMAGE" > "$BACKUP_ROOT/previous-image.txt"
cp -a "$FRONTEND_DESTINATION/." "$BACKUP_ROOT/frontend/"
find "$BACKUP_ROOT/frontend" -type f -print0 | sort -z | xargs -0 sha256sum > "$BACKUP_ROOT/frontend.sha256"
[[ -s "$BACKUP_ROOT/container.json" && -s "$BACKUP_ROOT/image.json" && -s "$BACKUP_ROOT/frontend.sha256" ]] || fail "Backup incompleto; apply abortado"

OVERRIDE_FILE="$TEMP_ROOT/release-compose.override.yml"
cat > "$OVERRIDE_FILE" <<YAML
services:
  hub-api:
    image: $IMAGE_TAG
YAML

rollback() {
  log "Rollback: restaurando backend e frontend anteriores"
  cat > "$OVERRIDE_FILE" <<YAML
services:
  hub-api:
    image: $OLD_IMAGE
YAML
  docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" -f "$OVERRIDE_FILE" up -d --no-build hub-api
  rsync -a --delete "$BACKUP_ROOT/frontend/" "$FRONTEND_DESTINATION/"
  nginx -t && nginx -s reload
}

if ! docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" -f "$OVERRIDE_FILE" up -d --no-build hub-api; then
  rollback
  fail "Troca do backend falhou; rollback executado"
fi
if ! rsync -a --delete "$ARTIFACT_DIR/dist/" "$FRONTEND_DESTINATION/"; then
  rollback
  fail "Publicação frontend falhou; rollback executado"
fi
if ! curl -fsS "http://127.0.0.1:18085/api/v1/health" >/dev/null || ! nginx -t; then
  rollback
  fail "Validação pós-troca falhou; rollback executado"
fi
nginx -s reload
log "Apply concluído para $PRODUCTION_DOMAIN; backup em $BACKUP_ROOT"
