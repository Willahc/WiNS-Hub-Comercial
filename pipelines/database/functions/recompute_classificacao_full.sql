 CREATE OR REPLACE FUNCTION engenharia.recompute_classificacao_full(p_id uuid)                                     +
  RETURNS void                                                                                                     +
  LANGUAGE plpgsql                                                                                                 +
 AS $function$                                                                                                     +
 BEGIN                                                                                                             +
   UPDATE obras SET classificacao_computed = CASE                                                                  +
     WHEN COALESCE(fonte_tipo,'OFICIAL') = 'NOTICIA' THEN classificacao_computed                                   +
     -- OURO live: decisor canônico vale mesmo em fonte asset                                                      +
     WHEN EXISTS (                                                                                                 +
       SELECT 1 FROM decisores_obra d                                                                              +
       WHERE d.obra_id=obras.id AND d.excluido_em IS NULL                                                          +
         AND d.tipo_cargo IS NOT NULL AND d.tipo_cargo <> 'OUTRO'                                                  +
         AND (NULLIF(d.email,'') IS NOT NULL OR NULLIF(d.linkedin_url,'') IS NOT NULL)                             +
     ) THEN 'OURO'                                                                                                 +
     -- PRATA: tem nivel1_nome                                                                                     +
     WHEN obras.nivel1_nome IS NOT NULL AND obras.nivel1_nome <> '' THEN 'PRATA'                                   +
     -- Asset fontes sem OURO/PRATA → NULL (não viram PIPELINE nem BRONZE)                                         +
     WHEN fonte IN ('anm_cfem','mapa_sif','abiove_processadoras','unica_usinas') THEN NULL                         +
     -- BRONZE (NOVO 17/05/2026): validada + capex>=50M + OFICIAL/MANUAL + sem nivel1                              +
     WHEN obras.valor_estimado >= 50000000                                                                         +
       AND obras.validacao_obra_at IS NOT NULL                                                                     +
       AND COALESCE(fonte_tipo,'OFICIAL') IN ('OFICIAL','MANUAL')                                                  +
       AND COALESCE(nivel1_nome,'') = ''                                                                           +
     THEN 'BRONZE'                                                                                                 +
     -- PIPELINE: pré-operação com capex menor (>=10M, sem validacao)                                              +
     WHEN fase IN ('EM_EXECUCAO','PLANEJAMENTO','LICENCA_INSTALACAO','LICENCA_PREVIA','LICITACAO_ABERTA','PROJETO')+
       AND valor_estimado IS NOT NULL AND valor_estimado >= 10000000                                               +
       AND COALESCE(nivel1_nome,'') = ''                                                                           +
       AND COALESCE(fonte_tipo,'OFICIAL') <> 'NOTICIA'                                                             +
     THEN 'PIPELINE'                                                                                               +
     ELSE NULL                                                                                                     +
   END                                                                                                             +
   WHERE id = p_id;                                                                                                +
 END;                                                                                                              +
 $function$                                                                                                        +
 

