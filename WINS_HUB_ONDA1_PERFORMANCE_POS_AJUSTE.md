# WiNS Hub — Onda 1 — Performance Pós-Ajuste

## Data do benchmark: 2026-07-21 20:00 UTC
## Ambiente: Staging (conexão direta ao PostgreSQL, pool aquecido)

---

## Fornecedores — Busca Textual

### Consulta otimizada

```sql
SELECT f.cnpj, f.razao_social, f.nome_fantasia, f.cnae_principal, f.cnae_descricao,
       f.porte, f.uf, coalesce(f.municipio_nome, f.municipio_rfb) municipio,
       f.situacao_cadastral, f.matches_count, f.atualizado_em,
       count(*) OVER() AS total
FROM engenharia.fornecedores f
WHERE f.situacao_cadastral='02'
  AND ((COALESCE(f.razao_social,'') || ' ' || COALESCE(f.nome_fantasia,'') || ' ' || COALESCE(f.cnae_descricao,'')) ILIKE '%engenharia%')
ORDER BY f.matches_count DESC NULLS LAST, f.razao_social
LIMIT 25 OFFSET 0;
```

### Resultados (10 amostras aquecidas)

| Métrica | Valor |
|---------|------:|
| Amostras | 10 |
| p50 | 1.136 ms |
| p95 | **1.241 ms** |
| p99 | 1.241 ms |
| Média | 1.140 ms |
| Taxa de erro | 0% |
| Timeout | Nenhum |

### Comparativo

| Cenário | Antes | Depois | Redução |
|---------|------:|-------:|--------:|
| Busca textual (p95) | 5.980 ms | **1.241 ms** | **-79%** |
| Busca textual (p50) | 5.749 ms | **1.136 ms** | **-80%** |

### Plano de execução (após índices)

```
BitmapOr
  ├── Bitmap Index Scan (idx_forn_razao_social_trgm)   → 145.553 rows (181 ms)
  ├── Bitmap Index Scan (idx_forn_nome_fantasia_trgm)   → 99.674 rows
  └── Bitmap Index Scan (idx_forn_cnae_descricao_trgm)  → 175.872 rows
Bitmap Heap Scan → 226.185 rows → 49.595 blocks (3,2s cold → 0,9s warm)
Sort (Top-N heapsort, 35 kB) → LIMIT 25
```

---

## Empresa 360° — Lookup por CNPJ

### Consulta otimizada (vw_empresa_360 com subqueries correlacionadas + covering index)

```sql
SELECT * FROM canonical_mvp.vw_empresa_360 WHERE cnpj = '49695768000116';
```

### Resultados (10 amostras aquecidas)

| Métrica | Valor |
|---------|------:|
| Amostras | 10 |
| p50 | 1,9 ms |
| p95 | **2,8 ms** |
| p99 | 2,8 ms |
| Média | 2,0 ms |
| Taxa de erro | 0% |
| Timeout | Nenhum |

### Detalhe completo (view + obras + fornecedor)

| Métrica | Valor |
|---------|------:|
| p50 | 28,3 ms |
| p95 | **161,0 ms** |
| Média | 40,7 ms |

### Comparativo

| Cenário | Antes | Depois | Redução |
|---------|------:|-------:|--------:|
| View lookup (p95) | 4.190 ms | **2,8 ms** | **-99,9%** |
| Detalhe completo (p95) | ~4.250 ms | **161 ms** | **-96%** |

### Plano de execução (após índice coberto)

```
Index Scan (entidade_empresa_cnpj_key) → 1 row (0,04 ms)
Nested Loop Left Join (geo) → 0 rows (0,1 ms)
SubPlan 1-3 (papel_vertical) → Index Scan, 1 row cada (0,04 ms)
SubPlan 4 (atributo_fonte: count DISTINCT fonte) → Index Only Scan (0,13 ms)  ← 105.631 → 9 buffers
SubPlan 5 (atributo_fonte: max confianca) → Index Only Scan (0,02 ms)         ← 105.631 → 9 buffers
SubPlan 6-7 (geo conflitos) → Index Scan (0,05 ms)
Total: 1,14 ms
```

---

## Metas Obrigatórias

| Meta | Antes | Depois | Status |
|------|------:|-------:|:------|
| Fornecedores p95 < 2s | 5.980 ms | **1.241 ms** | ✅ **ATINGIDA** |
| Empresa 360° p95 < 3s | 4.190 ms | **2,8 ms** | ✅ **ATINGIDA** |
| Zero timeout | - | ✅ | ✅ |
| Zero erro adicional | - | ✅ | ✅ |
| Nenhuma regressão relevante | - | ✅ | ✅ |

---

## Endpoints sem regressão (benchmark de regressão)

| Endpoint | p95 (ms) | Comparação |
|----------|---------:|:-----------|
| Obras página 1 | 61,4 | ✅ Estável (63 ms antes) |
| Obras busca textual | 8,0 | ✅ Estável (15 ms antes) |
| Obras filtros combinados | 3,9 | ✅ Estável (9 ms antes) |
| Decisores cargo | 35,4 | ✅ Estável (70 ms antes) |
| Empresa por CNPJ | 3,1 | ✅ Estável (3 ms antes) |
