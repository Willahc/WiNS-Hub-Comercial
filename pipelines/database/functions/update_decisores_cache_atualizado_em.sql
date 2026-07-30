 CREATE OR REPLACE FUNCTION engenharia.update_decisores_cache_atualizado_em()+
  RETURNS trigger                                                            +
  LANGUAGE plpgsql                                                           +
 AS $function$                                                               +
 BEGIN                                                                       +
     NEW.atualizado_em = NOW();                                              +
     RETURN NEW;                                                             +
 END;                                                                        +
 $function$                                                                  +
 

