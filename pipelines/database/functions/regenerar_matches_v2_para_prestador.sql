 CREATE OR REPLACE FUNCTION engenharia.regenerar_matches_v2_para_prestador(p_prestador_id uuid, p_threshold numeric DEFAULT 30)+
  RETURNS integer                                                                                                              +
  LANGUAGE plpgsql                                                                                                             +
 AS $function$                                                                                                                 +
 DECLARE                                                                                                                       +
   v_inseridos INTEGER := 0;                                                                                                   +
   v_cnpj TEXT;                                                                                                                +
 BEGIN                                                                                                                         +
   -- Pega CNPJs vinculados ao prestador                                                                                       +
   FOR v_cnpj IN SELECT cnpj FROM prestador_empresas WHERE prestador_id = p_prestador_id AND ativo LOOP                        +
     -- Remove matches antigos desse cnpj                                                                                      +
     DELETE FROM matches_v2 WHERE cnpj = v_cnpj;                                                                               +
     -- Calcula novos                                                                                                          +
     WITH novos AS (                                                                                                           +
       SELECT o.id AS obra_id, v_cnpj AS cnpj, scc.score, scc.breakdown                                                        +
       FROM obras o                                                                                                            +
       CROSS JOIN LATERAL (SELECT * FROM calcular_score_match_v2(o.id, v_cnpj)) scc                                            +
       WHERE o.classificacao_computed IN ('OURO','PRATA','BRONZE','PIPELINE')                                                  +
         AND (o.visivel IS NULL OR o.visivel = true)                                                                           +
         AND COALESCE(o.fonte_tipo,'OFICIAL') != 'NOTICIA'                                                                     +
         AND scc.score IS NOT NULL                                                                                             +
         AND scc.score >= p_threshold                                                                                          +
     )                                                                                                                         +
     INSERT INTO matches_v2 (obra_id, cnpj, score, score_breakdown)                                                            +
     SELECT obra_id, cnpj, score, breakdown FROM novos                                                                         +
     ON CONFLICT (obra_id, cnpj) DO UPDATE SET                                                                                 +
       score = EXCLUDED.score,                                                                                                 +
       score_breakdown = EXCLUDED.score_breakdown,                                                                             +
       gerado_em = NOW();                                                                                                      +
     GET DIAGNOSTICS v_inseridos = ROW_COUNT;                                                                                  +
   END LOOP;                                                                                                                   +
   RETURN v_inseridos;                                                                                                         +
 END;                                                                                                                          +
 $function$                                                                                                                    +
 

