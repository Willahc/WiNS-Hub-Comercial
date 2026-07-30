 CREATE OR REPLACE FUNCTION engenharia.fn_reuso_decisor_preservado()                                                                                    +
  RETURNS trigger                                                                                                                                       +
  LANGUAGE plpgsql                                                                                                                                      +
 AS $function$                                                                                                                                          +
 BEGIN                                                                                                                                                  +
   IF NULLIF(trim(NEW.cnpj),'') IS NOT NULL THEN                                                                                                        +
     INSERT INTO decisores_obra (obra_id, nome, cargo, tipo_cargo, email, telefone, linkedin_url, confianca_match, fonte, registrado_por, registrado_em)+
     SELECT NEW.id, p.nome, p.cargo, p.tipo_cargo,                                                                                                      +
            CASE WHEN p.email IS NOT NULL AND split_part(p.email,'@',1) ~ '[^\x00-\x7F]'                                                                +
                 THEN unaccent(split_part(p.email,'@',1))||'@'||split_part(p.email,'@',2)                                                               +
                 ELSE p.email END,                                                                                                                      +
            p.telefone, p.linkedin_url, p.confianca_match,                                                                                              +
            COALESCE(NULLIF(p.fonte,'')||' ','')||'[reuso_preservado]', 'trigger_reuso_decisor', now()                                                  +
     FROM decisores_preservados p                                                                                                                       +
     WHERE p.cnpj = NEW.cnpj                                                                                                                            +
       AND NULLIF(trim(p.nome),'') IS NOT NULL                                                                                                          +
       AND (p.email IS NULL OR p.email !~ '@.*\.gov\.br$')                                                                                              +
       AND NOT EXISTS (SELECT 1 FROM decisores_obra d WHERE d.obra_id = NEW.id AND lower(trim(d.nome)) = lower(trim(p.nome)));                          +
   END IF;                                                                                                                                              +
   RETURN NULL;                                                                                                                                         +
 END;                                                                                                                                                   +
 $function$                                                                                                                                             +
 

