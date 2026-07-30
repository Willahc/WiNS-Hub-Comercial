# WiNS Hub — Onda 1 — Performance

Benchmark local em 21/07/2026, API em loopback, PostgreSQL ativo, 10 amostras aquecidas por cenário. Concorrência: 30 requisições com 10 workers. p99 com dez amostras é indicativo, não SLA estatístico.

| Cenário | p50 | p95 | p99 | Média |
|---|---:|---:|---:|---:|
| Obras página 1 | 63,48 ms | 69,86 ms | 69,86 ms | 64,54 ms |
| Obras página 600 | 84,24 ms | 89,34 ms | 89,34 ms | 85,02 ms |
| Obras busca “rodovia” | 12,12 ms | 15,54 ms | 15,54 ms | 12,65 ms |
| Obras UF=SP + “rodovia” | 8,94 ms | 9,23 ms | 9,23 ms | 8,82 ms |
| Empresa por CNPJ | 2,69 ms | 3,10 ms | 3,10 ms | 2,74 ms |
| Fornecedor busca “engenharia” | 5.749,63 ms | 6.049,57 ms | 6.049,57 ms | 5.817,47 ms |
| Decisor cargo “diretor” | 57,08 ms | 70,81 ms | 70,81 ms | 58,15 ms |
| Concorrência 10, filtro combinado de obras | 61,95 ms | 277,73 ms | 288,06 ms | 107,20 ms |

Detalhe de obra: 18 ms observado. Detalhe de fornecedor: 49 ms. Empresa 360° com obras relacionadas: 5,75 s, exigindo ajuste.

## Planos atuais

Busca de obras usa `idx_obras_nome_trgm` e `idx_obras_empresa_trgm`, BitmapOr e Bitmap Heap Scan; execução observada de 3,69 ms.

Busca de fornecedores por duas colunas executa Parallel Seq Scan sobre 4.094.527 linhas, remove aproximadamente 1.973.954 linhas por worker, lê 169.909 buffers e custa `222284.69`; execução SQL observada de 2,99 s, agravada pela contagem total na API.

## Índices propostos — não criados

1. Consulta: razão social ou nome fantasia com `ILIKE '%texto%'` e situação ativa. Proposta: dois GIN trigram parciais, um em `razao_social` e outro em `nome_fantasia`, `WHERE situacao_cadastral='02'`. Custo: armazenamento e maior custo de INSERT/UPDATE/VACUUM em 4,1 milhões de linhas. Impacto esperado: BitmapOr semelhante ao de obras. Rollback: `DROP INDEX CONCURRENTLY` de cada índice.
2. Consulta Empresa 360°: `engenharia.obras WHERE cnpj=? OR cnpj_executora=?`. Proposta: B-tree parcial em `cnpj` e em `cnpj_executora` quando não nulos. Custo: dois índices sobre 35.690 linhas, manutenção baixa. Impacto esperado: remover scan do detalhe. Rollback: remoção concorrente dos dois índices.
3. Páginas profundas: migrar de OFFSET para cursor `(sort_key,id)`. Não exige índice novo quando a ordenação já é suportada; altera contrato de paginação e precisa compatibilidade.

Nenhum índice foi criado nesta onda porque as propostas aguardam aprovação com base nestes planos e custos.
