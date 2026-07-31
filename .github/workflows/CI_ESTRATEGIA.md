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
2. **focused-tests** (bloqueante): testes do núcleo de auth quando arquivos de
   auth mudam; testes de domínio Agro quando backend Agro muda; Vitest quando
   auth/Agro frontend muda. Ruff global nunca impede os testes.
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
- Segredos `WINS_HUB_GATE_USER`/`WINS_HUB_GATE_PASSWORD` são apenas verificados
  quanto à presença (nunca exibidos). Indisponíveis → job pulado com summary
  explícito (sem "No jobs were run"). PR de fork não recebe segredos.
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
| PR backend Agro | ruff no diff | pytest Agro | informativo | pula | informativo |
| PR auth | ruff no diff | pytest auth + vitest | informativo | vitest bloqueia; tsc/build info | não dispara |
| push em main | ruff no diff | testes por escopo | informativo | vitest bloqueia; tsc/build info | bloqueante (paths Agro) |
| workflow_dispatch | ruff no diff | testes por escopo | informativo | vitest bloqueia; tsc/build info | bloqueante (manual) |
| PR de fork sem segredos | passa | passa | informativo | conforme escopo | pula com summary |
