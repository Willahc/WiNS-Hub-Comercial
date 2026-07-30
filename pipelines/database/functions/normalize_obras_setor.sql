 CREATE OR REPLACE FUNCTION engenharia.normalize_obras_setor()                +
  RETURNS trigger                                                             +
  LANGUAGE plpgsql                                                            +
 AS $function$                                                                +
 BEGIN                                                                        +
   IF NEW.setor IS NOT NULL AND NEW.setor != '' THEN                          +
     NEW.setor := UPPER(unaccent(REPLACE(TRIM(NEW.setor), ' ', '_')));        +
     IF NEW.setor = 'PETROLEO_E_GAS' THEN NEW.setor := 'PETROLEO_GAS'; END IF;+
     IF NEW.setor = 'LOGISTICA' THEN NEW.setor := 'LOGISTICO'; END IF;        +
   END IF;                                                                    +
   RETURN NEW;                                                                +
 END;                                                                         +
 $function$                                                                   +
 

