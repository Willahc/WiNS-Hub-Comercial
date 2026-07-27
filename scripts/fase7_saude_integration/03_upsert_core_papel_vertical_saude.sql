-- 03_upsert_core_papel_vertical_saude.sql
--
-- CORRIGIDO: Insere papéis saúde para todos os CNPJs válidos das fontes
-- Regras:
--   1. UNION ALL preserva CNPJs com dois tipos
--   2. Sem filtro de existência em core.empresa
--   3. ON CONFLICT (cnpj, vertical, tipo) DO NOTHING
--   4. Sem dependência de codigo_ibge
--   5. CNPJ tratado como texto (sem cast para bigint)
--   6. Tracking com migracao_id

BEGIN;

-- ============================================================
-- Inserir papéis verticais saúde
-- ============================================================
INSERT INTO core.papel_vertical (cnpj, vertical, tipo)
SELECT DISTINCT
    lpad(
        REPLACE(REPLACE(REPLACE(e.cnpj, '.', ''), '/', ''), '-', ''),
        14, '0'
    )::char(14) AS cnpj,
    'saude' AS vertical,
    'estabelecimento_saude' AS tipo
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
    'saude' AS vertical,
    'operadora_ans' AS tipo
FROM saude.operadoras_ans o
WHERE o.cnpj IS NOT NULL
  AND o.cnpj <> ''
  AND LENGTH(REPLACE(REPLACE(REPLACE(o.cnpj, '.', ''), '/', ''), '-', '')) = 14
ON CONFLICT (cnpj, vertical, tipo) DO NOTHING;

-- ============================================================
-- Tracking dos papéis inseridos
-- ============================================================
INSERT INTO saude.migracao_papel_tracking (cnpj, vertical, tipo, migracao_id)
SELECT p.cnpj, p.vertical, p.tipo, :'migracao_id'::varchar
FROM core.papel_vertical p
WHERE p.vertical = 'saude'
  AND (p.cnpj, p.vertical, p.tipo) NOT IN (
    SELECT cnpj, vertical, tipo
    FROM saude.migracao_papel_tracking
    WHERE migracao_id = :'migracao_id'
  );

-- ============================================================
-- Log da etapa
-- ============================================================
INSERT INTO saude.migracao_log (migracao_id, etapa, script, linhas_afetadas)
SELECT :'migracao_id', 'upsert_papel', '03_upsert_core_papel_vertical_saude.sql',
       COUNT(*)::int
FROM saude.migracao_papel_tracking
WHERE migracao_id = :'migracao_id';

COMMIT;
