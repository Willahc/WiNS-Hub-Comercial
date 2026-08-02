# Release oficial do Radar Agro

O backend e o frontend do Radar têm fontes canônicas independentes. O deploy oficial deve ser executado exclusivamente por `deploy/deploy-agro-release.sh`, que lê os SHAs imutáveis de `deploy/agro-release.json` e cria worktrees detached separados.

## Proteções operacionais

- Não execute `/root/wins_agro_v1/scripts/deploy.sh`.
- Não use `/root/wins_hub_unificado` como fonte de build.
- Não faça merge entre as linhagens backend e frontend.
- Não execute `docker compose up` usando apenas `/root/wins_agro_v1/docker-compose.yml`.
- Toda operação do serviço `hub-api` deve incluir o override persistente `/root/wins_agro_v1/docker-compose.release.yml`.
- O override persistente contém somente a tag imutável da imagem oficial e é publicado por rename atômico após `docker compose config`.

## Comandos oficiais

Dry-run obrigatório:

```bash
deploy/deploy-agro-release.sh --dry-run
```

Apply explícito, somente após aprovação do artifact do dry-run:

```bash
deploy/deploy-agro-release.sh --apply
```

Rollback automático: qualquer falha durante o apply restaura o container anterior preservado, o frontend e o override persistente registrados no diretório de backup. O container anterior é parado e renomeado, não apagado. Para recuperação operacional manual, use o backup específico da release e nunca o checkout principal:

```bash
BACKUP=/srv/winshub/backups/releases/<release_id>-<data_utc>
if [ "$(cat "$BACKUP/override-state.txt")" = present ]; then
  cp "$BACKUP/docker-compose.release.yml" /root/wins_agro_v1/.docker-compose.release.rollback.yml
else
  PREVIOUS_IMAGE=$(cat "$BACKUP/previous-image.txt")
  printf 'services:\n  hub-api:\n    image: %s\n' "$PREVIOUS_IMAGE" \
    > /root/wins_agro_v1/.docker-compose.release.rollback.yml
fi
docker compose -p wins_agro_v1 \
  -f /root/wins_agro_v1/docker-compose.yml \
  -f /root/wins_agro_v1/.docker-compose.release.rollback.yml \
  config >/dev/null
mv /root/wins_agro_v1/.docker-compose.release.rollback.yml /root/wins_agro_v1/docker-compose.release.yml
docker compose -p wins_agro_v1 \
  -f /root/wins_agro_v1/docker-compose.yml \
  -f /root/wins_agro_v1/docker-compose.release.yml \
  up -d --no-build hub-api
rsync -a --delete "$BACKUP/frontend/" /opt/winshub/spa/
docker exec wins_agro_v1-hub-api-1 python -c \
  "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=3)"
nginx -t && nginx -s reload
```

Se `override-state.txt` registrar `absent`, o rollback automático fixa a imagem anterior em um novo override persistente para impedir regressão ao contexto de build legado.

Nenhum desses comandos executa migração ou SQL destrutivo.
