 CREATE OR REPLACE FUNCTION engenharia.fn_portao_enfileirar()             +
  RETURNS trigger                                                         +
  LANGUAGE plpgsql                                                        +
  SECURITY DEFINER                                                        +
  SET search_path TO 'public', 'wins_v2'                                  +
 AS $function$                                                            +
 BEGIN                                                                    +
     IF NEW.status_portao = 'EM_ANALISE'                                  +
        AND wins_v2.portao_flag_on('PORTAO_OBRAS_ENABLED')                +
        AND wins_v2.portao_flag_on('PORTAO_OBRAS_NEW_CAPTURES_ENABLED')   +
     THEN                                                                 +
         IF NOT EXISTS (                                                  +
             SELECT 1 FROM wins_v2.portao_fila                            +
              WHERE obra_id = NEW.id                                      +
                AND status IN ('pendente', 'processando')                 +
         ) THEN                                                           +
             INSERT INTO wins_v2.portao_fila (obra_id, captura_id, status)+
             VALUES (NEW.id, NEW.id, 'pendente');                         +
         END IF;                                                          +
     END IF;                                                              +
     RETURN NEW;                                                          +
 END;                                                                     +
 $function$                                                               +
 

