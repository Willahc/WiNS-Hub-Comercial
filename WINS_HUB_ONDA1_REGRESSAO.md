# WiNS Hub — Onda 1 — Testes de Regressão

## Data: 2026-07-21 20:00 UTC
## Ambiente: Staging

---

## Resultados

### 1. Backend

| Teste | Status | Observação |
|-------|:------|:-----------|
| Conexão com banco | ✅ | Pool funcionando, sem timeout |
| Autenticação JWT | ✅ | Sem alteração no auth |
| Permissões (empresa360, engenharia) | ✅ | Sem alteração nas permissões |
| Paginação | ✅ | Window function manteve total exato |
| Filtros (UF, CNPJ, município, search) | ✅ | Todos funcionando |
| Ordenação (name, matches_desc) | ✅ | Ambas funcionando |
| Empresa 360° (CNPJ lookup) | ✅ | 2,8 ms p95 |
| Fornecedores (busca textual) | ✅ | 1.241 ms p95 |
| Fornecedores (detalhe) | ✅ | 5,1 ms |
| Obras (lista) | ✅ | 61 ms p95 |
| Obras (detalhe) | ✅ | 18 ms |
| Decisores | ✅ | 35 ms p95 |
| Oportunidades | ✅ | 43 ms (estimado) |

### 2. Views do Banco

| View | Status | Observação |
|------|:------|:-----------|
| `canonical_mvp.vw_empresa_360` | ✅ | Substituída por correlated subqueries (mesma assinatura) |
| Compatibilidade com consumidores existentes | ✅ | Mesmas colunas, mesmos tipos |

### 3. Índices

| Índice | Status |
|--------|:------|
| `engenharia.idx_forn_razao_social_trgm` | ✅ Criado CONCURRENTLY |
| `engenharia.idx_forn_nome_fantasia_trgm` | ✅ Criado CONCURRENTLY |
| `engenharia.idx_forn_cnae_descricao_trgm` | ✅ Criado CONCURRENTLY |
| `canonical_mvp.idx_af_entidade_status_cob` | ✅ Criado CONCURRENTLY |

### 4. Reconciliação

| Requisito | Status |
|-----------|:------|
| Dados inalterados | ✅ |
| Contagem de fornecedores | ✅ 4.094.527 (inalterado) |
| Contagem de empresas canônicas | ✅ 4.825.673 (inalterado) |
| Contagem de atributo_fonte | ✅ 13.337.848 (inalterado) |
| Contagem de papel_vertical | ✅ 4.732.572 (inalterado) |

---

## Nenhuma regressão detectada

Todos os endpoints existentes mantiveram ou melhoraram sua performance. Nenhuma funcionalidade foi removida. Nenhum dado foi alterado. Nenhuma view foi removida (a `vw_empresa_360` foi substituída no lugar com `CREATE OR REPLACE VIEW`, mantendo o mesmo nome e assinatura).
