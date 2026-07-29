BEGIN;

DROP INDEX IF EXISTS engenharia.idx_decisores_obra_status_vinculo;

ALTER TABLE engenharia.decisores_obra
  DROP COLUMN IF EXISTS status_vinculo_obra,
  DROP COLUMN IF EXISTS classificacao_compatibilidade,
  DROP COLUMN IF EXISTS tipo_evidencia,
  DROP COLUMN IF EXISTS fonte_evidencia,
  DROP COLUMN IF EXISTS verificado_em;

COMMIT;
