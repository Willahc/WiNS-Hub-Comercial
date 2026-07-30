 CREATE OR REPLACE FUNCTION engenharia.fn_detectar_cnpj_guarda_chuva()                                                                                                                 +
  RETURNS trigger                                                                                                                                                                      +
  LANGUAGE plpgsql                                                                                                                                                                     +
 AS $function$                                                                                                                                                                         +
 DECLARE                                                                                                                                                                               +
   n_empresas_existentes INTEGER;                                                                                                                                                      +
 BEGIN                                                                                                                                                                                 +
   -- Só roda em INSERT, ou UPDATE quando cnpj mudou                                                                                                                                   +
   IF NEW.cnpj IS NULL OR LENGTH(NEW.cnpj) <> 14 THEN                                                                                                                                  +
     RETURN NEW;                                                                                                                                                                       +
   END IF;                                                                                                                                                                             +
   IF TG_OP = 'UPDATE' AND (OLD.cnpj IS NOT DISTINCT FROM NEW.cnpj) THEN                                                                                                               +
     RETURN NEW;                                                                                                                                                                       +
   END IF;                                                                                                                                                                             +
                                                                                                                                                                                       +
   -- Contar quantas empresas DISTINTAS já usam esse CNPJ                                                                                                                              +
   SELECT COUNT(DISTINCT empresa) INTO n_empresas_existentes                                                                                                                           +
   FROM obras                                                                                                                                                                          +
   WHERE cnpj = NEW.cnpj AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)                                                                                      +
     AND (visivel IS NULL OR visivel=true)                                                                                                                                             +
     AND empresa IS NOT NULL AND empresa <> '';                                                                                                                                        +
                                                                                                                                                                                       +
   -- Se já há 5+ empresas distintas com esse CNPJ E a nova empresa NÃO bate com nenhuma → CNPJ guarda-chuva                                                                           +
   IF n_empresas_existentes >= 5 THEN                                                                                                                                                  +
     IF NOT EXISTS (                                                                                                                                                                   +
       SELECT 1 FROM obras                                                                                                                                                             +
       WHERE cnpj = NEW.cnpj                                                                                                                                                           +
         AND (visivel IS NULL OR visivel=true)                                                                                                                                         +
         AND (                                                                                                                                                                         +
           UPPER(empresa) = UPPER(NEW.empresa) OR                                                                                                                                      +
           UPPER(empresa) LIKE UPPER('%' || SPLIT_PART(COALESCE(NEW.empresa,''), ' ', 1) || '%')                                                                                       +
         )                                                                                                                                                                             +
     ) THEN                                                                                                                                                                            +
       RAISE WARNING 'CNPJ GUARDA-CHUVA DETECTADO: cnpj=% já vinculado a % empresas distintas; empresa nova "%" não bate. Zerando cnpj.', NEW.cnpj, n_empresas_existentes, NEW.empresa;+
       NEW.cnpj := NULL;                                                                                                                                                               +
       NEW.observacoes_validacao := COALESCE(NEW.observacoes_validacao||' | ','')                                                                                                      +
         || 'cnpj_guarda_chuva_detectado_' || TO_CHAR(NOW(),'YYYYMMDD')                                                                                                                +
         || ': cnpj zerado (já vinculado a ' || n_empresas_existentes || ' empresas distintas)';                                                                                       +
     END IF;                                                                                                                                                                           +
   END IF;                                                                                                                                                                             +
                                                                                                                                                                                       +
   RETURN NEW;                                                                                                                                                                         +
 END;                                                                                                                                                                                  +
 $function$                                                                                                                                                                            +
 

