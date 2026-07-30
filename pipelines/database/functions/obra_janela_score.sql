 CREATE OR REPLACE FUNCTION engenharia.obra_janela_score(p_fase text, p_data_publicacao date, p_status_licenca text, p_valor_estimado numeric)+
  RETURNS integer                                                                                                                             +
  LANGUAGE plpgsql                                                                                                                            +
  STABLE                                                                                                                                      +
 AS $function$                                                                                                                                +
 DECLARE                                                                                                                                      +
     score INT := 50;                                                                                                                         +
     dias_desde_pub INT;                                                                                                                      +
     is_renovacao BOOLEAN;                                                                                                                    +
 BEGIN                                                                                                                                        +
     dias_desde_pub := COALESCE(CURRENT_DATE - p_data_publicacao, 180);                                                                       +
     is_renovacao := COALESCE(p_status_licenca ILIKE '%renova%' OR                                                                            +
                              p_status_licenca ILIKE '%prorrog%', false);                                                                     +
                                                                                                                                              +
     score := CASE p_fase                                                                                                                     +
         WHEN 'LICENCA_INSTALACAO' THEN                                                                                                       +
             CASE WHEN dias_desde_pub <= 60  THEN 95                                                                                          +
                  WHEN dias_desde_pub <= 180 THEN 80                                                                                          +
                  WHEN dias_desde_pub <= 365 THEN 65                                                                                          +
                  ELSE 45 END                                                                                                                 +
         WHEN 'LICENCA_PREVIA' THEN                                                                                                           +
             CASE WHEN dias_desde_pub <= 90  THEN 85                                                                                          +
                  WHEN dias_desde_pub <= 365 THEN 65                                                                                          +
                  ELSE 50 END                                                                                                                 +
         WHEN 'EM_EXECUCAO' THEN                                                                                                              +
             CASE WHEN dias_desde_pub <= 30  THEN 80                                                                                          +
                  WHEN dias_desde_pub <= 180 THEN 60                                                                                          +
                  WHEN dias_desde_pub <= 365 THEN 40                                                                                          +
                  ELSE 25 END                                                                                                                 +
         WHEN 'PLANEJAMENTO' THEN                                                                                                             +
             CASE WHEN dias_desde_pub <= 180 THEN 60                                                                                          +
                  WHEN dias_desde_pub <= 365 THEN 50                                                                                          +
                  ELSE 35 END                                                                                                                 +
         WHEN 'LICITACAO_ABERTA' THEN 90                                                                                                      +
         WHEN 'PROJETO'          THEN 55                                                                                                      +
         ELSE 40                                                                                                                              +
     END;                                                                                                                                     +
                                                                                                                                              +
     IF is_renovacao THEN score := score - 15; END IF;                                                                                        +
     IF p_valor_estimado >= 5000000000 THEN score := score + 5; END IF;                                                                       +
                                                                                                                                              +
     RETURN GREATEST(0, LEAST(100, score));                                                                                                   +
 END;                                                                                                                                         +
 $function$                                                                                                                                   +
 

