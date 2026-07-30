 CREATE OR REPLACE FUNCTION engenharia.fn_enqueue_enrichment()           +
  RETURNS trigger                                                        +
  LANGUAGE plpgsql                                                       +
 AS $function$                                                           +
 BEGIN                                                                   +
   -- Se Portão ativo para novas capturas, só enfileira se APROVADA      +
   IF wins_v2.portao_flag_on('PORTAO_OBRAS_ENABLED')                     +
      AND wins_v2.portao_flag_on('PORTAO_OBRAS_NEW_CAPTURES_ENABLED')    +
   THEN                                                                  +
     IF NEW.status_portao IS DISTINCT FROM 'APROVADA' THEN               +
       RETURN NEW;                                                       +
     END IF;                                                             +
     IF NOT wins_v2.portao_flag_on('AUTO_ENRICH_AFTER_GATE_ENABLED') THEN+
       RETURN NEW;                                                       +
     END IF;                                                             +
   END IF;                                                               +
                                                                         +
   IF COALESCE(NEW.fonte,'') NOT IN ('anm_cfem','ibama_sislic')          +
      AND NEW.motivo_invisivel IS NULL                                   +
   THEN                                                                  +
     INSERT INTO enrichment_queue (obra_id, capex)                       +
     VALUES (NEW.id, COALESCE(NEW.valor_estimado, 0))                    +
     ON CONFLICT (obra_id) DO NOTHING;                                   +
   END IF;                                                               +
   RETURN NEW;                                                           +
 END;                                                                    +
 $function$                                                              +
 

