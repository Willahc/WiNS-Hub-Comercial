BEGIN;
SET search_path = engenharia, public;

ALTER TABLE engenharia.decisores_obra
  ADD COLUMN IF NOT EXISTS status_vinculo_obra text,
  ADD COLUMN IF NOT EXISTS classificacao_compatibilidade text,
  ADD COLUMN IF NOT EXISTS qualidade_contato text,
  ADD COLUMN IF NOT EXISTS tipo_evidencia text,
  ADD COLUMN IF NOT EXISTS fonte_evidencia text,
  ADD COLUMN IF NOT EXISTS verificado_em timestamptz;

UPDATE engenharia.decisores_obra
SET
  status_vinculo_obra = CASE
    WHEN fonte ILIKE '%contrato%' OR fonte ILIKE '%edital%' OR fonte ILIKE '%pncp%' OR fonte ILIKE '%obrasgov%' OR fonte ILIKE '%documento%' OR COALESCE(hipotese_replicacao,'') = 'DIRETO_DOCUMENTAL'
      THEN 'DECISOR_VALIDADO'
    WHEN confianca_match >= 70
      THEN 'CONTATO_VALIDADO'
    WHEN confianca_match >= 50
      THEN 'CONTATO_SUGERIDO'
    ELSE 'POTENCIAL'
  END,
  classificacao_compatibilidade = CASE
    WHEN confianca_match >= 70 THEN 'ALTA_COMPATIBILIDADE'
    WHEN confianca_match >= 50 THEN 'MEDIA_COMPATIBILIDADE'
    ELSE 'BAIXA_COMPATIBILIDADE'
  END,
  qualidade_contato = CASE
    WHEN email IS NOT NULL AND telefone IS NOT NULL AND linkedin_url IS NOT NULL THEN 'COMPLETO'
    WHEN email IS NOT NULL OR telefone IS NOT NULL OR linkedin_url IS NOT NULL THEN 'VERIFICADO'
    ELSE 'INCOMPLETO'
  END,
  tipo_evidencia = CASE
    WHEN fonte ILIKE '%contrato%' OR fonte ILIKE '%edital%' OR fonte ILIKE '%pncp%' OR fonte ILIKE '%obrasgov%' OR fonte ILIKE '%documento%' OR COALESCE(hipotese_replicacao,'') = 'DIRETO_DOCUMENTAL'
      THEN 'DOCUMENTAL_EDITAL_CONTRATO'
    WHEN confianca_match >= 70
      THEN 'REGISTRO_EMPRESARIAL_QSA'
    WHEN confianca_match >= 50
      THEN 'COMPATIBILIDADE_CARGO_SETOR'
    ELSE 'ESTIMATIVA_ALGORITMICA'
  END,
  fonte_evidencia = COALESCE(fonte, 'DESCONHECIDA'),
  verificado_em = COALESCE(email_verificado_em, registrado_em, now())
WHERE excluido_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_decisores_obra_status_vinculo
  ON engenharia.decisores_obra (status_vinculo_obra);

COMMIT;
