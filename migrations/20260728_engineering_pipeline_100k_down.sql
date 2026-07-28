BEGIN;

CREATE OR REPLACE FUNCTION engenharia.recompute_classificacao_obra(p_obra_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  v_max_score integer;
  v_has_email_max_score boolean;
  v_valor numeric;
  v_validada boolean;
  v_fonte_tipo text;
  v_classificacao_atual text;
  v_smtp_verified boolean;
  v_has_real_decisor boolean;
  v_nova text;
BEGIN
  SELECT o.valor_estimado, (o.validacao_obra_at IS NOT NULL),
         COALESCE(o.fonte_tipo, 'OFICIAL'), o.classificacao_computed,
         COALESCE(o.nivel1_email_smtp_verified, false)
    INTO v_valor, v_validada, v_fonte_tipo, v_classificacao_atual,
         v_smtp_verified
    FROM engenharia.obras o
   WHERE o.id = p_obra_id;

  IF v_fonte_tipo = 'NOTICIA' THEN RETURN; END IF;

  SELECT COALESCE(MAX(d.confianca_match), 0)
    INTO v_max_score
    FROM engenharia.decisores_obra d
   WHERE d.obra_id = p_obra_id
     AND d.excluido_em IS NULL
     AND COALESCE(d.hipotese_replicacao, '')
         <> 'REPLICADO_PROVAVEL_FALSO_POSITIVO';

  SELECT EXISTS (
    SELECT 1 FROM engenharia.decisores_obra d
    JOIN engenharia.obras o ON o.id = d.obra_id
    WHERE d.obra_id = p_obra_id AND d.excluido_em IS NULL
      AND COALESCE(d.hipotese_replicacao, '')
          <> 'REPLICADO_PROVAVEL_FALSO_POSITIVO'
      AND d.confianca_match >= 70
      AND (NULLIF(d.email, '') IS NOT NULL
        OR NULLIF(d.linkedin_url, '') IS NOT NULL
        OR NULLIF(o.nivel1_email, '') IS NOT NULL)
  ) INTO v_has_email_max_score;

  SELECT EXISTS (
    SELECT 1 FROM engenharia.decisores_obra d
    WHERE d.obra_id = p_obra_id AND d.excluido_em IS NULL
      AND COALESCE(d.hipotese_replicacao, '')
          <> 'REPLICADO_PROVAVEL_FALSO_POSITIVO'
  ) INTO v_has_real_decisor;

  v_nova := CASE
    WHEN v_max_score >= 70 AND v_has_email_max_score THEN 'OURO'
    WHEN v_max_score >= 50 THEN 'PRATA'
    WHEN v_max_score >= 30 AND v_smtp_verified AND v_has_real_decisor
      THEN 'PRATA'
    WHEN v_validada AND v_valor >= 50e6
         AND v_fonte_tipo IN ('OFICIAL', 'MANUAL') THEN 'BRONZE'
    WHEN v_validada AND v_valor >= 10e6
         AND v_fonte_tipo IN ('OFICIAL', 'MANUAL') THEN 'PIPELINE'
    WHEN v_classificacao_atual IN ('OURO', 'PRATA', 'BRONZE', 'PIPELINE')
      THEN 'PIPELINE'
    ELSE v_classificacao_atual
  END;

  UPDATE engenharia.obras SET classificacao_computed = v_nova
   WHERE id = p_obra_id;
END;
$function$;

COMMIT;
