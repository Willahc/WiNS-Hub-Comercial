-- 02_upsert_core_empresa_saude.sql
--
-- Insere em core.empresa os CNPJs saúde ainda não cadastrados (CORE_NOVO).
-- Usa regra canônica de nomes e regra municipal validada.
-- Aplica a migracao_id para tracking.
-- Não altera empresas preexistentes.

BEGIN;

-- ============================================================
-- Preparação: CNPJs válidos das fontes com dados de nome e município
-- ============================================================
CREATE TEMP TABLE temp_saude_empresa_source AS
SELECT DISTINCT
    lpad(
        REPLACE(REPLACE(REPLACE(e.cnpj, '.', ''), '/', ''), '-', ''),
        14, '0'
    )::char(14) AS cnpj,
    COALESCE(NULLIF(TRIM(e.razao_social), ''), NULLIF(TRIM(e.nome_fantasia), '')) AS razao_social,
    NULLIF(TRIM(e.nome_fantasia), '') AS nome_fantasia,
    e.municipio_cod,
    NULLIF(TRIM(e.uf), '') AS uf
FROM saude.estabelecimentos e
WHERE e.cnpj IS NOT NULL
  AND e.cnpj <> ''
  AND LENGTH(REPLACE(REPLACE(REPLACE(e.cnpj, '.', ''), '/', ''), '-', '')) = 14

UNION ALL

SELECT DISTINCT
    lpad(
        REPLACE(REPLACE(REPLACE(o.cnpj, '.', ''), '/', ''), '-', ''),
        14, '0'
    )::char(14) AS cnpj,
    COALESCE(NULLIF(TRIM(o.razao_social), ''), NULLIF(TRIM(o.nome_fantasia), '')) AS razao_social,
    NULLIF(TRIM(o.nome_fantasia), '') AS nome_fantasia,
    NULL::int AS municipio_cod,
    NULLIF(TRIM(o.uf), '') AS uf
FROM saude.operadoras_ans o
WHERE o.cnpj IS NOT NULL
  AND o.cnpj <> ''
  AND LENGTH(REPLACE(REPLACE(REPLACE(o.cnpj, '.', ''), '/', ''), '-', '')) = 14;

-- ============================================================
-- Resolução municipal por CNPJ
-- ============================================================
-- Para CNPJs com estabelecimentos em múltiplos municípios, deixamos NULL.
CREATE TEMP TABLE temp_municipio_resolvido AS
SELECT
    cnpj,
    CASE
        WHEN COUNT(DISTINCT municipio_cod) = 1
         AND COUNT(*) = COUNT(municipio_cod)  -- sem NULLs
         AND MAX(municipio_cod) IS NOT NULL
         AND EXISTS (
             SELECT 1 FROM core.municipio m
             WHERE m.codigo_ibge / 10 = MAX(municipio_cod)
         )
        THEN (SELECT m.codigo_ibge
              FROM core.municipio m
              WHERE m.codigo_ibge / 10 = MAX(s.municipio_cod)
              LIMIT 1)
        ELSE NULL
    END AS codigo_ibge,
    CASE
        WHEN COUNT(DISTINCT uf) = 1
         AND COUNT(*) = COUNT(uf)
         AND MAX(uf) IS NOT NULL
        THEN MAX(uf)
        ELSE NULL
    END AS uf_resolvido
FROM temp_saude_empresa_source s
GROUP BY cnpj;

-- ============================================================
-- Agregação de nomes: escolhe a razao_social mais frequente
-- ============================================================
CREATE TEMP TABLE temp_nome_resolvido AS
SELECT DISTINCT ON (s.cnpj)
    s.cnpj,
    s.razao_social AS melhor_razao,
    s.nome_fantasia AS melhor_fantasia
FROM temp_saude_empresa_source s
ORDER BY s.cnpj,
    CASE WHEN s.razao_social IS NOT NULL THEN 0 ELSE 1 END,
    s.razao_social;

-- ============================================================
-- Inserção em core.empresa (apenas CORE_NOVO)
-- ============================================================
INSERT INTO core.empresa (
    cnpj, cnpj_basico, razao_social, nome_fantasia,
    uf, codigo_ibge, fonte, vivo
)
SELECT
    n.cnpj,
    SUBSTRING(n.cnpj::text FROM 1 FOR 8) AS cnpj_basico,
    n.melhor_razao AS razao_social,
    n.melhor_fantasia AS nome_fantasia,
    m.uf_resolvido AS uf,
    m.codigo_ibge,
    'saude' AS fonte,
    true AS vivo
FROM temp_nome_resolvido n
LEFT JOIN temp_municipio_resolvido m ON m.cnpj = n.cnpj
WHERE n.cnpj NOT IN (
    SELECT cnpj FROM core.empresa
)
ON CONFLICT (cnpj) DO NOTHING;

-- ============================================================
-- Tracking das empresas inseridas
-- ============================================================
INSERT INTO saude.migracao_empresa_tracking (cnpj, migracao_id)
SELECT cnpj, :'migracao_id'
FROM core.empresa
WHERE fonte = 'saude'
  AND cnpj IN (
    SELECT cnpj FROM temp_nome_resolvido
  )
  AND cnpj NOT IN (
    SELECT cnpj FROM saude.migracao_empresa_tracking
    WHERE migracao_id = :'migracao_id'
  );

-- ============================================================
-- Log da etapa
-- ============================================================
INSERT INTO saude.migracao_log (migracao_id, etapa, script, linhas_afetadas)
SELECT :'migracao_id', 'upsert_empresa', '02_upsert_core_empresa_saude.sql',
       COUNT(*)::int
FROM saude.migracao_empresa_tracking
WHERE migracao_id = :'migracao_id';

-- Limpeza
DROP TABLE IF EXISTS temp_saude_empresa_source;
DROP TABLE IF EXISTS temp_municipio_resolvido;
DROP TABLE IF EXISTS temp_nome_resolvido;

COMMIT;
