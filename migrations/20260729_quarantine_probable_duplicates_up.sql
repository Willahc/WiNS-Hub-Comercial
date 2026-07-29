BEGIN;
SET search_path = engenharia, public;

-- Quarentena de obras duplicatas prováveis
WITH new_obras AS (
  SELECT o.id, o.nome, o.municipio, o.uf
    FROM engenharia.obras o
   WHERE DATE(o.criado_em) = '2026-07-28'
),
old_obras AS (
  SELECT o.id, o.nome, o.municipio, o.uf
    FROM engenharia.obras o
   WHERE DATE(o.criado_em) < '2026-07-28'
),
duplicates AS (
  SELECT DISTINCT n.id as obra_nova_id
    FROM new_obras n
    JOIN old_obras o
      ON LOWER(TRIM(o.nome)) = LOWER(TRIM(n.nome))
     AND COALESCE(LOWER(TRIM(o.municipio)),'') = COALESCE(LOWER(TRIM(n.municipio)),'')
     AND COALESCE(o.uf,'') = COALESCE(n.uf,'')
)
UPDATE engenharia.obras
   SET status_portao = 'EM_ANALISE_MANUAL',
       visivel = false,
       portao_motivo = 'REVISAO_DUPLICIDADE'
 WHERE id IN (SELECT obra_nova_id FROM duplicates);

-- Fila de revisão de duplicadas
CREATE OR REPLACE VIEW engenharia.vw_fila_revisao_duplicadas AS
WITH new_obras AS (
  SELECT o.id, o.nome, o.municipio, o.uf, o.valor_estimado, o.fonte, o.cnpj, o.criado_em
    FROM engenharia.obras o
   WHERE DATE(o.criado_em) = '2026-07-28'
),
old_obras AS (
  SELECT o.id, o.nome, o.municipio, o.uf, o.valor_estimado, o.fonte, o.cnpj, o.criado_em
    FROM engenharia.obras o
   WHERE DATE(o.criado_em) < '2026-07-28'
)
SELECT
  n.id AS obra_candidata_id,
  o.id AS obra_referencia_id,
  n.nome,
  n.municipio,
  n.uf,
  n.fonte AS fonte_candidata,
  o.fonte AS fonte_referencia,
  n.valor_estimado AS valor_candidata,
  o.valor_estimado AS valor_referencia,
  'MESMO_NOME_E_MUNICIPIO' AS motivo_similaridade,
  'REVISAR_EDITAL_OU_VINCULAR' AS acao_sugerida
FROM new_obras n
JOIN old_obras o
  ON LOWER(TRIM(o.nome)) = LOWER(TRIM(n.nome))
 AND COALESCE(LOWER(TRIM(o.municipio)),'') = COALESCE(LOWER(TRIM(n.municipio)),'')
 AND COALESCE(o.uf,'') = COALESCE(n.uf,'');

COMMIT;
