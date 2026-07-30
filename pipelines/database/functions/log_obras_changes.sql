 CREATE OR REPLACE FUNCTION engenharia.log_obras_changes()                                                         +
  RETURNS trigger                                                                                                  +
  LANGUAGE plpgsql                                                                                                 +
 AS $function$                                                                                                     +
 BEGIN                                                                                                             +
   IF OLD.uf IS DISTINCT FROM NEW.uf THEN                                                                          +
     INSERT INTO obras_atualizacoes_log (obra_id, id_externo, fonte, campo, valor_anterior, valor_novo)            +
     VALUES (NEW.id, COALESCE(NEW.id_externo, NEW.id::text), NEW.fonte, 'uf', OLD.uf, NEW.uf);                     +
   END IF;                                                                                                         +
   IF OLD.municipio IS DISTINCT FROM NEW.municipio THEN                                                            +
     INSERT INTO obras_atualizacoes_log (obra_id, id_externo, fonte, campo, valor_anterior, valor_novo)            +
     VALUES (NEW.id, COALESCE(NEW.id_externo, NEW.id::text), NEW.fonte, 'municipio', OLD.municipio, NEW.municipio);+
   END IF;                                                                                                         +
   IF OLD.setor IS DISTINCT FROM NEW.setor THEN                                                                    +
     INSERT INTO obras_atualizacoes_log (obra_id, id_externo, fonte, campo, valor_anterior, valor_novo)            +
     VALUES (NEW.id, COALESCE(NEW.id_externo, NEW.id::text), NEW.fonte, 'setor', OLD.setor, NEW.setor);            +
   END IF;                                                                                                         +
   IF OLD.fase IS DISTINCT FROM NEW.fase THEN                                                                      +
     INSERT INTO obras_atualizacoes_log (obra_id, id_externo, fonte, campo, valor_anterior, valor_novo)            +
     VALUES (NEW.id, COALESCE(NEW.id_externo, NEW.id::text), NEW.fonte, 'fase', OLD.fase, NEW.fase);               +
   END IF;                                                                                                         +
   IF OLD.empresa IS DISTINCT FROM NEW.empresa THEN                                                                +
     INSERT INTO obras_atualizacoes_log (obra_id, id_externo, fonte, campo, valor_anterior, valor_novo)            +
     VALUES (NEW.id, COALESCE(NEW.id_externo, NEW.id::text), NEW.fonte, 'empresa', OLD.empresa, NEW.empresa);      +
   END IF;                                                                                                         +
   RETURN NEW;                                                                                                     +
 END;                                                                                                              +
 $function$                                                                                                        +
 

