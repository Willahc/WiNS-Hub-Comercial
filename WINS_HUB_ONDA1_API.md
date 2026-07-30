# WiNS Hub — Onda 1 — API real

API FastAPI implementada em `apps/api`. Todas as listas exigem autenticação, `page>=1`, `1<=page_size<=100`, timeout SQL de 8 segundos, request ID e resposta com proveniência, total e última atualização. `page_size=101` retorna HTTP 422.

| Endpoint | Estado local | Pesquisa/filtros principais |
|---|---|---|
| `GET /api/v1/engenharia/obras` | homologado localmente | nome/empresa, município, UF, status, ordenação |
| `GET /api/v1/engenharia/obras/{id}` | homologado localmente | UUID existente; detalhe e vínculos |
| `GET /api/v1/engenharia/projetos` | homologado com ressalva | projeção paginada de obras |
| `GET /api/v1/empresas` | homologado localmente | CNPJ, razão/nome fantasia, UF, ativo, ordenação |
| `GET /api/v1/empresas/{id}` | homologado com ressalva de latência | CNPJ/ID, obras e fornecedor |
| `GET /api/v1/fornecedores` | requer ajuste de performance textual | CNPJ, razão/nome fantasia, município, UF, ativo |
| `GET /api/v1/fornecedores/{id}` | homologado localmente | CNPJ e matches |
| `GET /api/v1/decisores` | homologado localmente | nome, cargo, obra; contatos mascarados |
| `GET /api/v1/oportunidades` | homologado localmente | obra, CNPJ, score mínimo |
| `GET /api/v1/mapa` | homologado com precisão municipal | município, UF, status |

Respostas de lista usam `{items, meta}`; `meta` inclui página, limite máximo, total, fonte, data e indicador parcial. Campos ausentes são nulos ou sinalizados. Não existe fallback HTTP→mock na configuração `wave1`.

## Segurança

- Role `wins_hub_api_ro`: sem superuser, create role/database ou bypass RLS.
- INSERT, UPDATE, DELETE, CREATE, DROP e TRUNCATE foram testados e bloqueados.
- Foram concedidos apenas `USAGE` e `SELECT` nos sete objetos necessários da Onda 1.
- Decisores não recebem email/telefone integral sem `decisores:sensitive`; cada consulta gera log de acesso com sujeito e request ID.

## Ressalvas

OpenAPI existe na nova aplicação, mas ela não foi publicada externamente. A autenticação real de staging não foi disponibilizada; os testes locais usam o token de desenvolvimento permitido somente fora de modo forçado de produção.
