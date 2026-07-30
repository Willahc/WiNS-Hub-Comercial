 CREATE OR REPLACE FUNCTION engenharia.fn_autovalidar_oficial()                          +
  RETURNS trigger                                                                        +
  LANGUAGE plpgsql                                                                       +
 AS $function$                                                                           +
 BEGIN                                                                                   +
   IF COALESCE(NEW.fonte_tipo,'OFICIAL')='OFICIAL' AND NEW.validacao_obra_at IS NULL THEN+
     NEW.validacao_obra_at := now();                                                     +
     NEW.validacao_metodo  := COALESCE(NEW.validacao_metodo,'auto:fonte_oficial');       +
   END IF;                                                                               +
   RETURN NEW;                                                                           +
 END;                                                                                    +
 $function$                                                                              +
 

