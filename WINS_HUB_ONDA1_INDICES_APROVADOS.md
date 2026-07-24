# WiNS Hub — Onda 1 — Índices Aprovados

## Índice 1: `idx_forn_razao_social_trgm`

| Campo | Valor |
|-------|-------|
| Tabela | `engenharia.fornecedores` |
| Colunas | `razao_social` (GIN trigram) |
| Tipo | GIN (pg_trgm) |
| Tamanho estimado | 221 MB |
| Consulta beneficiada | Busca textual por razão social: `WHERE situacao_cadastral='02' AND razao_social ILIKE '%termo%'` |
| Risco | Aumento de ~63ms em INSERT de texto + WAL |
| Impacto em escrita | Moderado — GIN com 4.1M linhas |
| Tempo de criação | ~2 min (CONCURRENTLY) |
| CREATE INDEX CONCURRENTLY | Sim |
| Rollback | `DROP INDEX CONCURRENTLY engenharia.idx_forn_razao_social_trgm` |

---

## Índice 2: `idx_forn_nome_fantasia_trgm`

| Campo | Valor |
|-------|-------|
| Tabela | `engenharia.fornecedores` |
| Colunas | `nome_fantasia` (GIN trigram) |
| Tipo | GIN (pg_trgm) |
| Tamanho estimado | 63 MB |
| Consulta beneficiada | Busca textual por nome fantasia: `WHERE situacao_cadastral='02' AND nome_fantasia ILIKE '%termo%'` |
| Risco | Baixo |
| Impacto em escrita | Moderado |
| Tempo de criação | ~2 min (CONCURRENTLY) |
| CREATE INDEX CONCURRENTLY | Sim |
| Rollback | `DROP INDEX CONCURRENTLY engenharia.idx_forn_nome_fantasia_trgm` |

---

## Índice 3: `idx_forn_cnae_descricao_trgm`

| Campo | Valor |
|-------|-------|
| Tabela | `engenharia.fornecedores` |
| Colunas | `cnae_descricao` (GIN trigram) |
| Tipo | GIN (pg_trgm) |
| Tamanho estimado | 65 MB |
| Consulta beneficiada | Busca textual por descrição CNAE: `WHERE situacao_cadastral='02' AND cnae_descricao ILIKE '%termo%'` |
| Risco | Baixo |
| Impacto em escrita | Moderado |
| Tempo de criação | ~2 min (CONCURRENTLY) |
| CREATE INDEX CONCURRENTLY | Sim |
| Rollback | `DROP INDEX CONCURRENTLY engenharia.idx_forn_cnae_descricao_trgm` |

---

## Índice 4: `idx_af_entidade_status_cob`

| Campo | Valor |
|-------|-------|
| Tabela | `canonical_mvp.atributo_fonte` |
| Colunas | `(entidade_id, status)` INCLUDE `(fonte, confianca)` |
| Tipo | B-tree covering (INCLUDE) |
| Tamanho estimado | 789 MB |
| Consulta beneficiada | Subqueries da `vw_empresa_360`: `WHERE entidade_id = e.id AND status = 'ativo'` — agregações de `fonte` e `confianca` |
| Risco | Moderado — índice grande (789 MB), impacto em INSERT/WAL |
| Impacto em escrita | Moderado — 13.3M linhas, manutenção de covering index |
| Tempo de criação | ~5 min (CONCURRENTLY) |
| CREATE INDEX CONCURRENTLY | Sim |
| Rollback | `DROP INDEX CONCURRENTLY canonical_mvp.idx_af_entidade_status_cob` |

---

## Resumo

| Índice | Tamanho | Tipo | Benefício |
|--------|--------:|------|-----------|
| `idx_forn_razao_social_trgm` | 221 MB | GIN parcial | Busca textual fornecedores |
| `idx_forn_nome_fantasia_trgm` | 63 MB | GIN parcial | Busca textual fornecedores |
| `idx_forn_cnae_descricao_trgm` | 65 MB | GIN parcial | Busca textual fornecedores |
| `idx_af_entidade_status_cob` | 789 MB | B-tree covering | Empresa 360° |
| **Total** | **1.138 MB** | | |

Nenhum índice redundante foi criado.
Nenhuma coluna de baixa seletividade foi indexada cegamente — todos os índices têm justificativa de consulta associada.
