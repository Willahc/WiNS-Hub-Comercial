 CREATE OR REPLACE FUNCTION engenharia.trg_sync_classificacao()             +
  RETURNS trigger                                                           +
  LANGUAGE plpgsql                                                          +
 AS $function$                                                              +
 BEGIN                                                                      +
   PERFORM recompute_classificacao_obra(COALESCE(NEW.obra_id, OLD.obra_id));+
   RETURN NULL;                                                             +
 END;                                                                       +
 $function$                                                                 +
 

