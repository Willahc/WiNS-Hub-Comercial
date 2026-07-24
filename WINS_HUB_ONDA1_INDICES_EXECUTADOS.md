# WiNS Hub — Onda 1 — Índices Executados em Staging

## Ambiente

- **Host**: `127.0.0.1:5432`
- **Database**: `wins_agro`
- **Schema**: `engenharia`, `canonical_mvp`
- **Data**: 2026-07-21 20:00 UTC
- **Conexões ativas durante criação**: < 5

---

## 1. `idx_forn_razao_social_trgm`

```sql
CREATE INDEX CONCURRENTLY idx_forn_razao_social_trgm
ON engenharia.fornecedores USING gin (razao_social gin_trgm_ops)
WHERE situacao_cadastral='02';
```

- **Tempo de criação**: ~2 min
- **Locks**: Nenhum (CONCURRENTLY)
- **Espaço em disco**: 221 MB
- **Serviços interrompidos**: Nenhum

---

## 2. `idx_forn_nome_fantasia_trgm`

```sql
CREATE INDEX CONCURRENTLY idx_forn_nome_fantasia_trgm
ON engenharia.fornecedores USING gin (nome_fantasia gin_trgm_ops)
WHERE situacao_cadastral='02';
```

- **Tempo de criação**: ~2 min
- **Locks**: Nenhum (CONCURRENTLY)
- **Espaço em disco**: 63 MB
- **Serviços interrompidos**: Nenhum

---

## 3. `idx_forn_cnae_descricao_trgm`

```sql
CREATE INDEX CONCURRENTLY idx_forn_cnae_descricao_trgm
ON engenharia.fornecedores USING gin (cnae_descricao gin_trgm_ops)
WHERE situacao_cadastral='02';
```

- **Tempo de criação**: ~2 min
- **Locks**: Nenhum (CONCURRENTLY)
- **Espaço em disco**: 65 MB
- **Serviços interrompidos**: Nenhum

---

## 4. `idx_af_entidade_status_cob`

```sql
CREATE INDEX CONCURRENTLY idx_af_entidade_status_cob
ON canonical_mvp.atributo_fonte (entidade_id, status)
INCLUDE (fonte, confianca);
```

- **Tempo de criação**: ~5 min
- **Locks**: Nenhum (CONCURRENTLY)
- **Espaço em disco**: 789 MB
- **Serviços interrompidos**: Nenhum

---

## Pós-criação

- **ANALYZE** executado em: `fornecedores`, `atributo_fonte`, `entidade_empresa`, `papel_vertical`
- **Nenhuma consulta ou serviço foi interrompido**
- **Nenhum índice redundante foi criado**

## Rollback

Para reverter todos os índices:

```sql
DROP INDEX CONCURRENTLY IF EXISTS engenharia.idx_forn_razao_social_trgm;
DROP INDEX CONCURRENTLY IF EXISTS engenharia.idx_forn_nome_fantasia_trgm;
DROP INDEX CONCURRENTLY IF EXISTS engenharia.idx_forn_cnae_descricao_trgm;
DROP INDEX CONCURRENTLY IF EXISTS canonical_mvp.idx_af_entidade_status_cob;
```
