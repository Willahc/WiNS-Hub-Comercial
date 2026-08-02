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
PERSISTENT_OVERRIDE="/root/wins_agro_v1/docker-compose.release.yml"

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

validate_functional_api() {
  local container_name="$1"
  docker exec -i "$container_name" python - <<'PY'
import json, os, time, urllib.request

base = "http://127.0.0.1:8000/api/v1"
secret = os.environ.get("WINS_INTERNAL_SECRET", "")
if not secret:
    raise SystemExit("WINS_INTERNAL_SECRET ausente no container")
headers = {
    "X-WiNS-Authenticated-User": "agro-release-validator",
    "X-WiNS-Display-Name": "Agro Release Validator",
    "X-WiNS-Roles": "agro",
    "X-WiNS-Auth-Mode": "maintenance",
    "X-WiNS-Internal-Secret": secret,
}
timings = {}
def get(path, authenticated=True):
    request = urllib.request.Request(base + path, headers=headers if authenticated else {})
    started = time.monotonic()
    with urllib.request.urlopen(request, timeout=15) as response:
        if response.status != 200:
            raise AssertionError(f"{path}: HTTP {response.status}")
        payload = json.load(response)
    timings[path] = round((time.monotonic() - started) * 1000, 2)
    return payload

assert get("/health", False)["status"] == "ok"
status = get("/agro/oportunidades/status")
assert status["engine_status"] == "VALIDATION"
signals = get("/agro/oportunidades?stage=SIGNAL&page=1&page_size=25")
assert isinstance(signals.get("items"), list) and signals["items"]
for item in signals["items"]:
    for forbidden in ("score", "min_score", "composicao_score", "decisor", "contato", "telefone", "email"):
        assert forbidden not in item or item[forbidden] in (None, "")
funnel = get("/agro/oportunidades/funil")
assert funnel["municipalities_evaluated"] == 5536
assert funnel["signals_total"] == 1368
assert funnel["deserto_vet_signals"] == 539
assert funnel["low_coverage_signals"] == 829
assert funnel["validated_total"] == 0
rules = get("/agro/oportunidades/regras")
by_rule = {rule["rule_id"]: rule for rule in rules["rules"]}
assert by_rule["TECHNICAL_COVERAGE_GAP_MUNICIPAL_V1"]["status"] == "ACTIVE"
property_rule = by_rule["PROPERTY_IN_TECHNICAL_GAP_V1"]
assert property_rule["status"] in ("ACTIVE", "UNAVAILABLE")
if property_rule["status"] == "UNAVAILABLE":
    assert property_rule.get("blockers")
for rule in rules["rules"]:
    if rule["status"] == "PLANNED":
        assert rule.get("produced_count") == 0
stages = get("/agro/oportunidades/estagios")
by_stage = {stage["stage"]: stage for stage in stages["stages"]}
assert by_stage["SIGNAL"]["status"] == "ACTIVE" and by_stage["SIGNAL"]["available"] is True
assert by_stage["CANDIDATE"]["status"] in ("ACTIVE", "UNAVAILABLE")
assert by_stage["VALIDATION"]["status"] == "UNAVAILABLE"
assert by_stage["VALIDATED"]["status"] == "UNAVAILABLE"
assert timings["/agro/oportunidades/estagios"] < 1000
assert timings["/agro/oportunidades/regras"] < 1000
print(json.dumps({"status": "pass", "timings_ms": timings}, ensure_ascii=False))
PY
}

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
    '/agro/oportunidades/regras' '/agro/oportunidades/estagios' '/agro/oportunidades/calculadas' '/agro/imoveis' \
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
CANARY_RESULT="$(validate_functional_api "$CANARY_NAME")" || { docker logs "$CANARY_NAME" >&2 || true; fail "Canário funcional reprovado"; }
printf '%s\n' "$CANARY_RESULT" > "$ARTIFACT_DIR/canary-functional.json"
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
PERSISTED_IMAGE_BEFORE="none"
if [[ -f "$PERSISTENT_OVERRIDE" ]]; then
  PERSISTED_IMAGE_BEFORE="$(python3 - "$PERSISTENT_OVERRIDE" <<'PY'
import sys
for line in open(sys.argv[1], encoding="utf-8"):
    if line.strip().startswith("image:"):
        print(line.split(":", 1)[1].strip())
        break
PY
)"
fi

python3 - "$ARTIFACT_DIR/report.json" "$RELEASE_ID" "$BACKEND_SHA" "$FRONTEND_SHA" "$IMAGE_TAG" "$IMAGE_ID" "$BACKEND_GATE" "$FRONTEND_GATE" "$CANARY_GATE" "$ASSET_HASH_FILE" "$PERSISTED_IMAGE_BEFORE" "$PERSISTENT_OVERRIDE" <<'PY'
import json, pathlib, sys
report, release_id, backend, frontend, tag, image_id, bg, fg, canary, hashes, persisted_before, override_path = sys.argv[1:]
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
    "persistent_override": override_path,
    "official_image_before_apply": persisted_before,
    "official_image_after_apply": None,
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
if [[ -f "$PERSISTENT_OVERRIDE" ]]; then
  cp "$PERSISTENT_OVERRIDE" "$BACKUP_ROOT/docker-compose.release.yml"
  printf 'present\n' > "$BACKUP_ROOT/override-state.txt"
else
  printf 'absent\n' > "$BACKUP_ROOT/override-state.txt"
fi
[[ -s "$BACKUP_ROOT/container.json" && -s "$BACKUP_ROOT/image.json" && -s "$BACKUP_ROOT/frontend.sha256" && -s "$BACKUP_ROOT/override-state.txt" ]] || fail "Backup incompleto; apply abortado"

OVERRIDE_CANDIDATE="$(mktemp /root/wins_agro_v1/.docker-compose.release.yml.XXXXXX)"
cat > "$OVERRIDE_CANDIDATE" <<YAML
services:
  hub-api:
    image: $IMAGE_TAG
YAML
docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" -f "$OVERRIDE_CANDIDATE" config >/dev/null || fail "Override persistente proposto é inválido"
mv "$OVERRIDE_CANDIDATE" "$PERSISTENT_OVERRIDE"
[[ -f "$PERSISTENT_OVERRIDE" ]] || fail "Publicação atômica do override falhou"

rollback() {
  log "Rollback: restaurando backend, frontend e override persistente anteriores"
  local rollback_override
  rollback_override="$(mktemp /root/wins_agro_v1/.docker-compose.release.rollback.yml.XXXXXX)"
  if [[ "$(cat "$BACKUP_ROOT/override-state.txt")" == "present" ]]; then
    cp "$BACKUP_ROOT/docker-compose.release.yml" "$rollback_override"
  else
    cat > "$rollback_override" <<YAML
services:
  hub-api:
    image: $OLD_IMAGE
YAML
  fi
  docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" -f "$rollback_override" config >/dev/null
  mv "$rollback_override" "$PERSISTENT_OVERRIDE"
  docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" -f "$PERSISTENT_OVERRIDE" up -d --no-build hub-api
  rsync -a --delete "$BACKUP_ROOT/frontend/" "$FRONTEND_DESTINATION/"
  validate_functional_api "$PRODUCTION_CONTAINER" > "$BACKUP_ROOT/rollback-functional.json"
  nginx -t && nginx -s reload
  printf 'rollback-complete\n' > "$BACKUP_ROOT/rollback-status.txt"
}

if ! docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" -f "$PERSISTENT_OVERRIDE" up -d --no-build hub-api; then
  rollback
  fail "Troca do backend falhou; rollback executado"
fi
if ! rsync -a --delete "$ARTIFACT_DIR/dist/" "$FRONTEND_DESTINATION/"; then
  rollback
  fail "Publicação frontend falhou; rollback executado"
fi
if ! validate_functional_api "$PRODUCTION_CONTAINER" > "$ARTIFACT_DIR/production-functional.json" || ! nginx -t; then
  rollback
  fail "Validação pós-troca falhou; rollback executado"
fi
for asset in "${referenced_assets[@]}"; do
  [[ -f "$FRONTEND_DESTINATION/$asset" ]] || { rollback; fail "Asset publicado ausente: $asset"; }
done
nginx -s reload
python3 - "$ARTIFACT_DIR/report.json" "$IMAGE_TAG" "$BACKUP_ROOT" "$(cat "$BACKUP_ROOT/override-state.txt")" <<'PY'
import json, pathlib, sys
path, image, backup, override_state = sys.argv[1:]
payload = json.loads(pathlib.Path(path).read_text())
payload["official_image_after_apply"] = image
payload["persistent_override_previous_state"] = override_state
payload["persistent_override_backup"] = (
    backup + "/docker-compose.release.yml" if override_state == "present" else None
)
payload["apply"] = "pass"
pathlib.Path(path).write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
PY
log "Apply concluído para $PRODUCTION_DOMAIN; backup em $BACKUP_ROOT"
