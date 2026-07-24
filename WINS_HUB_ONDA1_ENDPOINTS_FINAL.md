# WiNS Hub — Endpoints finais da Onda 1

Medição em 2026-07-21, no staging TLS `https://winshubcomercial.com.br:18443`, com 7 amostras por cenário, token Keycloak válido e tempos ponta a ponta. Todas as listas usam `page`, `page_size` e limite máximo de 100. O banco opera em leitura, com `statement_timeout=8s`; o proxy usa timeout de 10s e request ID.

| Método | Rota | Fonte real | Paginação | Filtros / ordenação | Autorização | p50 | p95 | p99 | Estado no frontend |
|---|---|---|---|---|---|---:|---:|---:|---|
| GET | `/api/v1/engenharia/obras` | `wins_agro.engenharia.obras` + `referencia.municipio` | Sim, máx. 100 | busca, município, UF, status; nome, valor, atualização | role `engenharia` | 86,32 ms | 92,80 ms | 92,80 ms | Conectado: dashboard e lista; loading/erro/vazio, fonte e atualização |
| GET | `/api/v1/engenharia/obras/{id}` | `engenharia.obras`, `decisores_obra`, `matches_v2` | N/A; coleções relacionadas limitadas a 20 | ID existente | role `engenharia` | 30,00 ms | 59,53 ms | 59,53 ms | Conectado: detalhe, campos parciais e precisão geográfica |
| GET | `/api/v1/engenharia/projetos` | Projeção de `engenharia.obras`; `vw_projetos_mestre` vazia | Sim, máx. 100 | mesmos filtros de obras | role `engenharia` | 87,61 ms | 94,00 ms | 94,00 ms | Identificado como **projeção**, com fonte e aviso; não é projeto real |
| GET | `/api/v1/empresas` | `wins_agro.core.empresa` | Sim, máx. 100 | busca, CNPJ, UF, ativo; nome/atualização | role `empresa360` | 236,16 ms | 262,16 ms | 262,16 ms | Conectado: empresas; sem fallback silencioso |
| GET | `/api/v1/empresas/{id}` | `canonical_mvp.vw_empresa_360`, obras e fornecedor | N/A; obras limitadas a 30 | CNPJ ou ID canônico existente | role `empresa360` | 4.053,22 ms | 4.187,40 ms | 4.187,40 ms | Conectado: Empresa 360°; funcional, acima da meta de 3s |
| GET | `/api/v1/fornecedores` | `wins_agro.engenharia.fornecedores` | Sim, máx. 100 | busca, CNPJ, município, UF, ativo; nome/matches | role `empresa360` | 5.718,89 ms | 5.981,41 ms | 5.981,41 ms | Conectado; funcional, acima da meta de 2s |
| GET | `/api/v1/fornecedores/{id}` | `engenharia.fornecedores` + `matches_v2`/`obras` | N/A; matches limitados a 30 | CNPJ existente | role `empresa360` | 28,95 ms | 32,28 ms | 32,28 ms | Conectado: detalhe do fornecedor |
| GET | `/api/v1/decisores` | `engenharia.decisores_obra` + `obras` | Sim, máx. 100 | busca, cargo, obra | role `decisores`; dados integrais apenas com `decisores:sensitive` | 84,43 ms | 101,64 ms | 101,64 ms | Conectado; contatos mascarados e acesso sensível auditado |
| GET | `/api/v1/oportunidades` | `engenharia.matches_v2`, obras visíveis e fornecedores | Sim, máx. 100 | obra, CNPJ, score mínimo | role `engenharia` | 265,82 ms | 313,99 ms | 313,99 ms | Conectado; valor comercial indisponível/não homologado |
| GET | `/api/v1/mapa` | `engenharia.obras` + centroide de `referencia.municipio` | Sim, máx. 100 | município, UF, status | role `engenharia` | 93,37 ms | 103,40 ms | 103,40 ms | Conectado; `geoPrecision=municipality` ou `unknown` |

O endpoint sanitizado `GET /healthz` retorna somente `{"status":"ok"}`. Nenhum endpoint da Onda 1 aceita resposta não paginada de milhões de registros.
