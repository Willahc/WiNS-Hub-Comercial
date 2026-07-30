# WiNS Hub — Performance final e propostas de índice

## Resultado medido

As medições ponta a ponta constam em `WINS_HUB_ONDA1_ENDPOINTS_FINAL.md`. Oito dos dez cenários atendem às metas iniciais. Permanecem fora da meta:

- busca de fornecedores: p95 **5,98s**, meta <2s;
- Empresa 360°: p95 **4,19s**, meta <3s.

Ambos permanecem abaixo do timeout externo de 10s e do timeout SQL de 8s na configuração homologada. Nenhum índice foi criado.

## EXPLAIN ANALYZE controlado

### Fornecedores

Consulta: busca textual ativa por razão social, nome fantasia ou CNAE, ordenada por `matches_count`, com paginação e contagem exata. O plano original contém `Parallel Seq Scan` sobre aproximadamente 4,1 milhões de registros, filtro com `OR`, sort e custo estimado 222.284; execução observada próxima de 3s para a seleção e cerca de 6s no ciclo completo seleção + contagem. A tentativa controlada de alinhar a expressão ao GIN existente eliminou o sequential scan, mas o `Bitmap Heap Scan` ainda visitou 97.329 blocos/226.185 linhas e a contagem chegou a 8,87s; a alteração não foi mantida.

Proposta, sujeita a aprovação: índices GIN trigram parciais separados sobre `razao_social` e `nome_fantasia`, com predicado `situacao_cadastral='02'`, acompanhados de reescrita `UNION` de candidatos antes do sort. O GIN composto existente ocupa 269 MiB; a estimativa conservadora para os dois índices é 300–550 MiB no total. Impacto de escrita: aumento de WAL, I/O e custo em INSERT/UPDATE de texto; criação deve usar `CONCURRENTLY` em janela monitorada. Rollback: `DROP INDEX CONCURRENTLY` dos novos índices e restauração da consulta atual.

### Empresa 360°

Consulta: lookup por CNPJ na `canonical_mvp.vw_empresa_360`. O registro principal usa índice e é rápido, mas dois subplanos leem `canonical_mvp.atributo_fonte`: cada `Index Scan` em `idx_af_entidade` toca cerca de 105.629 buffers; execução total observada 3,94–4,19s. A tabela tem 2.814 MiB e o índice atual `(entidade_tipo, entidade_id, atributo)` tem 834 MiB. Há ainda sequential scan de apenas 35.690 obras (~64ms), que não é o gargalo principal.

Proposta, sujeita a aprovação: índice parcial/coberto em `atributo_fonte (entidade_tipo, entidade_id) INCLUDE (fonte, status, confianca)` limitado aos registros ativos usados pela view; alternativamente, separar o lookup cadastral do agregado de proveniência e carregá-lo sob demanda. Tamanho estimado: 350–650 MiB, dependente da seletividade de `status`. Impacto de escrita: WAL e manutenção adicional na ingestão de atributos. Rollback: `DROP INDEX CONCURRENTLY` e retorno ao plano/view atual.

## Decisão do gate

As propostas estão documentadas para aprovação prévia. Não houve `CREATE INDEX`, `REINDEX`, alteração de tabela ou mudança de produção. Até a aprovação e nova medição com concorrência/páginas profundas, as duas metas seguem pendentes.
