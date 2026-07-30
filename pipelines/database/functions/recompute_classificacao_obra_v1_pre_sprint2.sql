 CREATE OR REPLACE FUNCTION engenharia.recompute_classificacao_obra_v1_pre_sprint2(p_obra_id uuid)+
  RETURNS void                                                                                    +
  LANGUAGE plpgsql                                                                                +
 AS $function$                                                                                    +
 BEGIN                                                                                            +
   UPDATE obras SET classificacao_computed = CASE                                                 +
     -- Preserva NOTICIA (regra original)                                                         +
     WHEN COALESCE(fonte_tipo,'OFICIAL') = 'NOTICIA' THEN classificacao_computed                  +
     -- OURO: decisor formal com email/linkedin (regra original)                                  +
     WHEN EXISTS (                                                                                +
       SELECT 1 FROM decisores_obra d                                                             +
       WHERE d.obra_id = obras.id AND d.excluido_em IS NULL                                       +
         AND d.tipo_cargo IS NOT NULL AND d.tipo_cargo <> 'OUTRO'                                 +
         AND (NULLIF(d.email,'') IS NOT NULL OR NULLIF(d.linkedin_url,'') IS NOT NULL)            +
     ) THEN 'OURO'                                                                                +
     -- PRATA: tem nivel1_nome (regra original)                                                   +
     WHEN obras.nivel1_nome IS NOT NULL AND obras.nivel1_nome <> '' THEN 'PRATA'                  +
     -- BRONZE: capex >= 50M + validada + OFICIAL/MANUAL (NOVA — 17/05/2026)                      +
     WHEN obras.valor_estimado >= 50e6                                                            +
       AND obras.validacao_obra_at IS NOT NULL                                                    +
       AND obras.fonte_tipo IN ('OFICIAL','MANUAL')                                               +
     THEN 'BRONZE'                                                                                +
     -- Preserva atual (PIPELINE/NULL/REJEITADO existentes)                                       +
     ELSE classificacao_computed                                                                  +
   END                                                                                            +
   WHERE id = p_obra_id;                                                                          +
 END;                                                                                             +
 $function$                                                                                       +
 

