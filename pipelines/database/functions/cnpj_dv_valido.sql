 CREATE OR REPLACE FUNCTION engenharia.cnpj_dv_valido(value text)               +
  RETURNS boolean                                                               +
  LANGUAGE plpgsql                                                              +
  IMMUTABLE PARALLEL SAFE STRICT                                                +
 AS $function$                                                                  +
 DECLARE                                                                        +
     total INTEGER;                                                             +
     digit_one INTEGER;                                                         +
     digit_two INTEGER;                                                         +
     position INTEGER;                                                          +
 BEGIN                                                                          +
     IF value !~ '^[0-9]{14}$' OR value = repeat(substr(value, 1, 1), 14) THEN  +
         RETURN FALSE;                                                          +
     END IF;                                                                    +
                                                                                +
     total := 0;                                                                +
     FOR position IN 1..12 LOOP                                                 +
         total := total                                                         +
             + substr(value, position, 1)::INTEGER                              +
             * CASE WHEN position <= 4 THEN 6 - position ELSE 14 - position END;+
     END LOOP;                                                                  +
     digit_one := 11 - (total % 11);                                            +
     IF digit_one >= 10 THEN                                                    +
         digit_one := 0;                                                        +
     END IF;                                                                    +
     IF digit_one <> substr(value, 13, 1)::INTEGER THEN                         +
         RETURN FALSE;                                                          +
     END IF;                                                                    +
                                                                                +
     total := 0;                                                                +
     FOR position IN 1..13 LOOP                                                 +
         total := total                                                         +
             + substr(value, position, 1)::INTEGER                              +
             * CASE WHEN position <= 5 THEN 7 - position ELSE 15 - position END;+
     END LOOP;                                                                  +
     digit_two := 11 - (total % 11);                                            +
     IF digit_two >= 10 THEN                                                    +
         digit_two := 0;                                                        +
     END IF;                                                                    +
                                                                                +
     RETURN digit_two = substr(value, 14, 1)::INTEGER;                          +
 END;                                                                           +
 $function$                                                                     +
 

