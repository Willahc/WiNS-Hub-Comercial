 CREATE OR REPLACE FUNCTION engenharia.sanitizar_decisor()                                     +
  RETURNS trigger                                                                              +
  LANGUAGE plpgsql                                                                             +
 AS $function$                                                                                 +
 BEGIN                                                                                         +
     IF NEW.cargo ILIKE '%anderson%' OR NEW.cargo ILIKE '%contato %' THEN                      +
         NEW.cargo := '';                                                                      +
     END IF;                                                                                   +
                                                                                               +
     -- Regra anderson cirurgica (patch 01062026): so renomeia se fonte indicar legacy CSV     +
     -- Preserva 889 placeholders historicos; libera Anderson Schaefer e futuros Anderson reais+
     IF NEW.nome NOT ILIKE 'Contato Comercial%' AND                                            +
        (                                                                                      +
          (NEW.nome ILIKE '%anderson%'                                                         +
           AND (COALESCE(NEW.fonte,'') ILIKE '%anderson_csv%'                                  +
                OR COALESCE(NEW.registrado_por,'') = 'anderson_geral'))                        +
          OR NEW.nome = NEW.cargo                                                              +
          OR NEW.nome ILIKE '%contato %'                                                       +
        ) THEN                                                                                 +
         NEW.nome := 'Contato Comercial ' ||                                                   +
                     SUBSTRING(MD5(random()::text || clock_timestamp()::text) FROM 1 FOR 6);   +
     END IF;                                                                                   +
                                                                                               +
     IF NEW.nome IS NULL OR TRIM(NEW.nome) = '' THEN                                           +
         NEW.nome := 'Contato Comercial ' ||                                                   +
                     SUBSTRING(MD5(random()::text || clock_timestamp()::text) FROM 1 FOR 6);   +
     END IF;                                                                                   +
                                                                                               +
     RETURN NEW;                                                                               +
 END;                                                                                          +
 $function$                                                                                    +
 

