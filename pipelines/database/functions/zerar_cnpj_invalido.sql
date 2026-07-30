 CREATE OR REPLACE FUNCTION engenharia.zerar_cnpj_invalido()            +
  RETURNS trigger                                                       +
  LANGUAGE plpgsql                                                      +
 AS $function$                                                          +
 BEGIN                                                                  +
   IF NEW.cnpj IS NOT NULL AND NEW.cnpj <> ''                           +
      AND NOT cnpj_valido(NEW.cnpj) THEN                                +
     NEW.cnpj := NULL;                                                  +
     NEW.observacoes_validacao := COALESCE(NEW.observacoes_validacao,'')+
       || ' | cnpj_invalido_zerado_trigger';                            +
   END IF;                                                              +
   RETURN NEW;                                                          +
 END;                                                                   +
 $function$                                                             +
 

