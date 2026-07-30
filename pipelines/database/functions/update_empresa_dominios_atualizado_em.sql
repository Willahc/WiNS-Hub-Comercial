 CREATE OR REPLACE FUNCTION engenharia.update_empresa_dominios_atualizado_em()+
  RETURNS trigger                                                             +
  LANGUAGE plpgsql                                                            +
 AS $function$                                                                +
 BEGIN                                                                        +
     NEW.atualizado_em = NOW();                                               +
     RETURN NEW;                                                              +
 END;                                                                         +
 $function$                                                                   +
 

