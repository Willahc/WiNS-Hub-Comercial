 CREATE OR REPLACE FUNCTION engenharia.cnpj_valido(p_cnpj text)                 +
  RETURNS boolean                                                               +
  LANGUAGE plpgsql                                                              +
  IMMUTABLE                                                                     +
 AS $function$                                                                  +
 DECLARE                                                                        +
     v_cnpj TEXT;                                                               +
     v_soma INT;                                                                +
     v_resto INT;                                                               +
     v_dv1 INT;                                                                 +
     v_dv2 INT;                                                                 +
     v_pesos1 INT[] := ARRAY[5,4,3,2,9,8,7,6,5,4,3,2];                          +
     v_pesos2 INT[] := ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2];                        +
 BEGIN                                                                          +
     v_cnpj := regexp_replace(COALESCE(p_cnpj, ''), '[^0-9]', '', 'g');         +
     IF length(v_cnpj) != 14 THEN RETURN FALSE; END IF;                         +
     IF v_cnpj ~ '^(\d)\1{13}$' THEN RETURN FALSE; END IF;                      +
                                                                                +
     v_soma := 0;                                                               +
     FOR i IN 1..12 LOOP                                                        +
         v_soma := v_soma + (substring(v_cnpj from i for 1)::INT * v_pesos1[i]);+
     END LOOP;                                                                  +
     v_resto := v_soma % 11;                                                    +
     v_dv1 := CASE WHEN v_resto < 2 THEN 0 ELSE 11 - v_resto END;               +
     IF substring(v_cnpj from 13 for 1)::INT != v_dv1 THEN RETURN FALSE; END IF;+
                                                                                +
     v_soma := 0;                                                               +
     FOR i IN 1..13 LOOP                                                        +
         v_soma := v_soma + (substring(v_cnpj from i for 1)::INT * v_pesos2[i]);+
     END LOOP;                                                                  +
     v_resto := v_soma % 11;                                                    +
     v_dv2 := CASE WHEN v_resto < 2 THEN 0 ELSE 11 - v_resto END;               +
     IF substring(v_cnpj from 14 for 1)::INT != v_dv2 THEN RETURN FALSE; END IF;+
                                                                                +
     RETURN TRUE;                                                               +
 END;                                                                           +
 $function$                                                                     +
 

