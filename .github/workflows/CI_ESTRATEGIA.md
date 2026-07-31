# Estratégia de CI — gates ao diff e baseline não bloqueante

## Problema original

- `.github/workflows/ci.yml` executava `ruff check .` no repositório inteiro,
  encontrando **241 erros** históricos (F401×198, F841×24, F821×9, F541×7,
  F811×3; 210 corrigíveis com `--fix`) e interrompendo o job antes do `pytest`.
  PRs sem relação com Python (ex.: #5 auth, #6 componentes) eram bloqueados
  por dívida de arquivos que não tocaram.
- `.github/workflows/agro-e2e.yml` executava em **todo** `pull_request`, inclusive
  PRs sem alterações Agro, gerando e-mails duplicados sem ação útil.
- Ambos os workflows escutavam `push: branches: [master]`; a branch oficial é
  `main`.

## Estratégia aplicada

### `ci.yml` — 4 jobs

1. **changed-python-quality** (bloqueante): roda `ruff check` apenas nos
   arquivos `.py` alterados pelo PR/push (`git diff --name-only --diff-filter=ACMR`
   entre base e head). Sem Python alterado → passa com aviso. Erros em arquivos
   NÃO alterados não bloqueiam.
2. **focused-tests** (bloqueante):
   - Detecção de escopo com `case` INDEPENDENTES: `apps/api/routes.py` pode
     marcar auth E Agro simultaneamente (case único pararia na 1ª correspondência).
   - Auth: executa `apps/api/test_auth_session.py` (arquitetura atual) e
     `app/tests/test_auth.py` (legado), em invocações separadas para evitar
     colisão do módulo `auth` entre `apps/api/` e `app/`. Com `DB_*` dummy de CI
     (pools falham no import e são capturados). Sem nenhum teste existente →
     falha explícita "Alteração de autenticação sem teste focado disponível".
     `apps/api/test_api.py` é excluído (sobe uvicorn com caminho hardcoded).
   - Agro backend: procura `apps/api/test_agro*.py` (atual); sem eles, executa
     legados compatíveis e registra aviso exigindo teste específico em PRs
     futuros que toquem `wave1_repository.py`/endpoints Agro.
   - Vitest quando auth/Agro frontend muda. Ruff global nunca impede os testes.
3. **repository-baseline** (informativo, `continue-on-error: true`): `ruff check .`
   mostra a dívida global e publica summary com o total. Não bloqueia e não
   declara o baseline aprovado. TODO: tornar bloqueante após redução controlada.
4. **frontend-quality** (quando frontend muda): `npm ci` + `npx vitest run`
   (bloqueante — verde no baseline); `npx tsc -b` e `npx vite build` são
   INFORMATIVOS porque o baseline de `origin/main` está vermelho (~222 erros tsc
   e build quebrado por componentes referenciados ausentes: `AppSidebar`,
   `territorial/BrazilUfSelect`, `relationshipCatalog` — reparados no PR #6).
   TODO: tornar bloqueantes após reparo. **NUNCA** usa `npm run build` (o script
   faz deploy para `/opt/winshub/spa` + reload Nginx). GitHub Actions não executa
   deploy.

### `agro-e2e.yml` — restrito por paths

- `push: branches: [main]` e `pull_request` com `paths` restrito a:
  `src/pages/Agro*.tsx`, `src/components/Agro*.tsx`,
  `src/pages/agroApiEndpoints.ts`, `src/pages/agroOportunidadesContract.ts`,
  `apps/api/wave1_repository.py`, `apps/api/routes.py`,
  `staging/agro_external_gate.py`, `.github/workflows/agro-e2e.yml`.
- `workflow_dispatch` preservado para execução manual.
- **Relevância real de `routes.py`**: o arquivo é compartilhado entre auth e
  Agro, e `paths` do GitHub Actions não distinguem hunks. No início do job, se
  `routes.py` mudou, o diff é inspecionado (sem imprimir conteúdo) em busca de
  símbolos/endpoints Agro; alteração só de auth → summary e job encerra com
  sucesso, SEM instalar Playwright.
- Segredos `WINS_HUB_GATE_USER`/`WINS_HUB_GATE_PASSWORD` são apenas verificados
  quanto à presença (nunca exibidos). O step `id` é `gate_credentials` para o
  próprio secret scan não capturá-lo. Indisponíveis → job pulado com summary
  explícito (sem "No jobs were run"). PR de fork não recebe segredos.
- **Secret scan** detecta VALORES hardcoded (atribuição de literal a chave
  sensível: `password = "x"`, `"api_key": "y"`), não palavras técnicas — nomes
  de steps, comentários, docs e identificadores do workflow não disparam.
- Semântica do gate de produção (testa winshubcomercial.com.br):
  - `pull_request`: informativo (`continue-on-error`) — testa o bundle
    ATUALMENTE PUBLICADO, não o código do PR;
  - `push` em `main`: bloqueante — valida a implantação pós-deploy;
  - `workflow_dispatch`: bloqueante — manual.

## Baseline medido em origin/main (2026-07-31)

| Check | Resultado |
|---|---|
| `ruff check .` | 241 erros (210 auto-fixáveis) |
| `npx tsc -b` | 222 erros TS |
| `npx vitest run` | 21 passed |
| `npx vite build` | falha (imports não resolvidos) |

## Matriz de execução

| Cenário | changed-python | focused-tests | baseline | frontend-quality | agro-e2e |
|---|---|---|---|---|---|
| PR só docs | passa | passa (sem testes) | informativo | pula | não dispara |
| PR frontend não Agro | passa | passa | informativo | vitest bloqueia; tsc/build info | não dispara |
| PR frontend Agro | passa | vitest Agro | informativo | vitest bloqueia; tsc/build info | informativo |
| PR backend Agro | ruff no diff | pytest Agro (atual/legado) | informativo | pula | informativo |
| PR auth (só auth.py) | ruff no diff | pytest auth (atual/legado) | informativo | pula | não dispara |
| PR auth tocando routes.py | ruff no diff | pytest auth + agro legado | informativo | vitest | dispara e pula (sem relevância Agro) |
| PR Agro tocando routes.py | ruff no diff | pytest auth + agro legado | informativo | vitest | dispara e executa (relevante) |
| push em main | ruff no diff | testes por escopo | informativo | vitest bloqueia; tsc/build info | bloqueante (paths Agro) |
| workflow_dispatch | ruff no diff | testes por escopo | informativo | vitest bloqueia; tsc/build info | bloqueante (manual) |
| PR de fork sem segredos | passa | passa | informativo | conforme escopo | pula com summary |
