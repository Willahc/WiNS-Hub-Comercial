 CREATE OR REPLACE FUNCTION engenharia.fn_portao_nova_captura()                              +
  RETURNS trigger                                                                            +
  LANGUAGE plpgsql                                                                           +
  SECURITY DEFINER                                                                           +
  SET search_path TO 'public', 'wins_v2'                                                     +
 AS $function$                                                                               +
 DECLARE                                                                                     +
     v_enabled boolean;                                                                      +
     v_new_cap boolean;                                                                      +
 BEGIN                                                                                       +
     BEGIN                                                                                   +
         v_enabled := wins_v2.portao_flag_on('PORTAO_OBRAS_ENABLED');                        +
         v_new_cap := wins_v2.portao_flag_on('PORTAO_OBRAS_NEW_CAPTURES_ENABLED');           +
     EXCEPTION WHEN OTHERS THEN                                                              +
         RETURN NEW;                                                                         +
     END;                                                                                    +
                                                                                             +
     IF NOT (v_enabled AND v_new_cap) THEN                                                   +
         RETURN NEW;                                                                         +
     END IF;                                                                                 +
                                                                                             +
     -- Não sobrescrever decisão manual/existente                                            +
     IF NEW.status_portao IS NOT NULL THEN                                                   +
         RETURN NEW;                                                                         +
     END IF;                                                                                 +
                                                                                             +
     NEW.status_portao := 'EM_ANALISE';                                                      +
     NEW.status_enriquecimento := COALESCE(NEW.status_enriquecimento, 'NAO_INICIADO');       +
     NEW.visivel := false;                                                                   +
     NEW.motivo_invisivel := COALESCE(NULLIF(NEW.motivo_invisivel, ''), 'aguardando_portao');+
     NEW.portao_versao := wins_v2.portao_flag('PORTAO_VERSAO', 'portao-v5.0.0');             +
     NEW.portao_motivo := COALESCE(NEW.portao_motivo, 'nova_captura_aguardando_portao');     +
                                                                                             +
     RETURN NEW;                                                                             +
 END;                                                                                        +
 $function$                                                                                  +
 

