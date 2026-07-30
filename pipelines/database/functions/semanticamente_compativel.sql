 CREATE OR REPLACE FUNCTION engenharia.semanticamente_compativel(p_campo_canonico_id text, p_valor_a text, p_valor_b text)+
  RETURNS boolean                                                                                                         +
  LANGUAGE plpgsql                                                                                                        +
  STABLE                                                                                                                  +
  SET search_path TO 'wins_v2', 'pg_temp'                                                                                 +
 AS $function$                                                                                                            +
 BEGIN                                                                                                                    +
     IF (p_valor_a = 'valor_financiado' AND p_valor_b = 'valor_contratado') OR                                            +
        (p_valor_a = 'valor_contratado' AND p_valor_b = 'valor_financiado') THEN                                          +
         RETURN TRUE;                                                                                                     +
     END IF;                                                                                                              +
                                                                                                                          +
     IF (p_valor_a = 'CAPEX' AND p_valor_b = 'estimativa') OR                                                             +
        (p_valor_a = 'estimativa' AND p_valor_b = 'CAPEX') THEN                                                           +
         RETURN TRUE;                                                                                                     +
     END IF;                                                                                                              +
                                                                                                                          +
     IF (p_valor_a = 'CONTRATANTE' AND p_valor_b = 'EXECUTORA') OR                                                        +
        (p_valor_a = 'EXECUTORA' AND p_valor_b = 'CONTRATANTE') THEN                                                      +
         RETURN TRUE;                                                                                                     +
     END IF;                                                                                                              +
                                                                                                                          +
     IF p_valor_a ~ '^\d{2}/\d{2}/\d{4}$' AND p_valor_b ~ '^\d{2}/\d{4}$' THEN                                            +
         RETURN TRUE;                                                                                                     +
     END IF;                                                                                                              +
     IF p_valor_a ~ '^\d{2}/\d{4}$' AND p_valor_b ~ '^\d{2}/\d{2}/\d{4}$' THEN                                            +
         RETURN TRUE;                                                                                                     +
     END IF;                                                                                                              +
     IF p_valor_a ~ '^\d{4}-\d{2}-\d{2}$' AND p_valor_b ~ '^\d{2}/\d{2}/\d{4}$' THEN                                      +
         RETURN TRUE;                                                                                                     +
     END IF;                                                                                                              +
     IF p_valor_a ~ '^\d{2}/\d{2}/\d{4}$' AND p_valor_b ~ '^\d{4}-\d{2}-\d{2}$' THEN                                      +
         RETURN TRUE;                                                                                                     +
     END IF;                                                                                                              +
     IF p_valor_a ~ '^\d{4}-\d{2}-\d{2}$' AND p_valor_b ~ '^\d{2}/\d{4}$' THEN                                            +
         RETURN TRUE;                                                                                                     +
     END IF;                                                                                                              +
     IF p_valor_a ~ '^\d{2}/\d{4}$' AND p_valor_b ~ '^\d{4}-\d{2}-\d{2}$' THEN                                            +
         RETURN TRUE;                                                                                                     +
     END IF;                                                                                                              +
                                                                                                                          +
     RETURN FALSE;                                                                                                        +
 END;                                                                                                                     +
 $function$                                                                                                               +
 

