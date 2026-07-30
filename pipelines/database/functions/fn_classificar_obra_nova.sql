 CREATE OR REPLACE FUNCTION engenharia.fn_classificar_obra_nova()+
  RETURNS trigger                                                +
  LANGUAGE plpgsql                                               +
 AS $function$                                                   +
 BEGIN                                                           +
   PERFORM recompute_classificacao_obra(NEW.id);                 +
   RETURN NULL;                                                  +
 END;                                                            +
 $function$                                                      +
 

