-- 04_populate_saude_empresa_core_map.sql
--
-- Popula saude.empresa_core_map com vínculos CNES e ANS.
--
-- NÃO insere nem atualiza core.empresa (responsabilidade do script 02).
-- NÃO insere nem atualiza core.papel_vertical (responsabilidade do script 03).
-- Insere APENAS em:
--   - saude.empresa_core_map
--   - saude.migracao_log

BEGIN;

-- ============================================================
-- PARTE 1: Vínculos CNES → core.empresa
-- ============================================================
INSERT INTO saude.empresa_core_map (
    cnes_id, registro_ans, cnpj, migracao_id, metodo_match
)
SELECT DISTINCT
    e.cnes_id,
    NULL::varchar AS registro_ans,
    lpad(
        REPLACE(REPLACE(REPLACE(e.cnpj, '.', ''), '/', ''), '-', ''),
        14, '0'
    )::char(14) AS cnpj,
    :'migracao_id'::varchar AS migracao_id,
    'cnpj_valido' AS metodo_match
FROM saude.estabelecimentos e
WHERE e.cnes_id IS NOT NULL
  AND e.cnpj IS NOT NULL
  AND e.cnpj <> ''
  AND LENGTH(REPLACE(REPLACE(REPLACE(e.cnpj, '.', ''), '/', ''), '-', '')) = 14
ON CONFLICT (cnes_id) DO NOTHING;

-- ============================================================
-- PARTE 2: Vínculos ANS → core.empresa
-- ============================================================
INSERT INTO saude.empresa_core_map (
    cnes_id, registro_ans, cnpj, migracao_id, metodo_match
)
SELECT DISTINCT
    NULL::int AS cnes_id,
    o.registro_ans,
    lpad(
        REPLACE(REPLACE(REPLACE(o.cnpj, '.', ''), '/', ''), '-', ''),
        14, '0'
    )::char(14) AS cnpj,
    :'migracao_id'::varchar AS migracao_id,
    'cnpj_valido' AS metodo_match
FROM saude.operadoras_ans o
WHERE o.registro_ans IS NOT NULL
  AND o.cnpj IS NOT NULL
  AND o.cnpj <> ''
  AND LENGTH(REPLACE(REPLACE(REPLACE(o.cnpj, '.', ''), '/', ''), '-', '')) = 14
ON CONFLICT (registro_ans) DO NOTHING;

-- ============================================================
-- Log da etapa
-- ============================================================
INSERT INTO saude.migracao_log (migracao_id, etapa, script, linhas_afetadas)
SELECT :'migracao_id', 'populate_map', '04_populate_saude_empresa_core_map.sql',
       COUNT(*)::int
FROM saude.empresa_core_map
WHERE migracao_id = :'migracao_id';

COMMIT;
