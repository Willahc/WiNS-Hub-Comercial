-- 06_rollback_core_integration_saude.sql
--
-- Rollback da integração saúde no core usando migracao_id.
-- NÃO executar automaticamente. Requer troca explícita para COMMIT.
-- Por padrão termina em ROLLBACK.
--
-- Uso: psql -v migracao_id='saude_core_20260718_131251' -f 06_rollback_core_integration_saude.sql

BEGIN;

-- ============================================================
-- 1. Remover mapas desta migração
-- ============================================================
DELETE FROM saude.empresa_core_map
WHERE migracao_id = :'migracao_id';

-- ============================================================
-- 2. Remover papéis inseridos por esta migração
-- ============================================================
DELETE FROM core.papel_vertical p
WHERE (p.cnpj, p.vertical, p.tipo) IN (
    SELECT cnpj, vertical, tipo
    FROM saude.migracao_papel_tracking
    WHERE migracao_id = :'migracao_id'
);

-- ============================================================
-- 3. Remover empresas inseridas por esta migração
--      desde que não tenham outros vínculos
-- ============================================================
DELETE FROM core.empresa e
WHERE e.cnpj IN (
    SELECT cnpj
    FROM saude.migracao_empresa_tracking
    WHERE migracao_id = :'migracao_id'
)
AND NOT EXISTS (
    SELECT 1 FROM core.papel_vertical p
    WHERE p.cnpj = e.cnpj AND p.vertical != 'saude'
)
AND NOT EXISTS (
    SELECT 1 FROM core.contato c
    WHERE c.cnpj = e.cnpj
)
AND NOT EXISTS (
    SELECT 1 FROM saude.empresa_core_map m
    WHERE m.cnpj = e.cnpj AND m.migracao_id != :'migracao_id'
);

-- ============================================================
-- 4. Limpar tracking
-- ============================================================
DELETE FROM saude.migracao_empresa_tracking WHERE migracao_id = :'migracao_id';
DELETE FROM saude.migracao_papel_tracking WHERE migracao_id = :'migracao_id';
DELETE FROM saude.migracao_log WHERE migracao_id = :'migracao_id';

-- ============================================================
-- Padrão: ROLLBACK. Troque para COMMIT somente se confirmado.
-- ============================================================
ROLLBACK;
