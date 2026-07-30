 CREATE OR REPLACE FUNCTION engenharia.trg_obras_pipeline_inbox()                              +
  RETURNS trigger                                                                              +
  LANGUAGE plpgsql                                                                             +
  SECURITY DEFINER                                                                             +
  SET search_path TO 'wins_v2', 'public'                                                       +
 AS $function$                                                                                 +
 BEGIN                                                                                         +
     -- Nao processa aqui: apenas enfileira metadados minimos da V1.                           +
     INSERT INTO wins_v2.pipeline_inbox (v1_obra_id, fonte, id_externo, payload_minimo, status)+
     VALUES (                                                                                  +
         NEW.id,                                                                               +
         NEW.fonte,                                                                            +
         NEW.id_externo,                                                                       +
         jsonb_build_object(                                                                   +
             'id', NEW.id,                                                                     +
             'id_externo', NEW.id_externo,                                                     +
             'fonte', NEW.fonte,                                                               +
             'nome', NEW.nome,                                                                 +
             'empresa', NEW.empresa,                                                           +
             'cnpj', NEW.cnpj,                                                                 +
             'municipio', NEW.municipio,                                                       +
             'uf', NEW.uf,                                                                     +
             'setor', NEW.setor,                                                               +
             'valor_estimado', NEW.valor_estimado,                                             +
             'fase', NEW.fase,                                                                 +
             'url_fonte', NEW.url_fonte,                                                       +
             'descricao', NEW.descricao,                                                       +
             'data_anuncio', NEW.data_anuncio,                                                 +
             'criado_em', NEW.criado_em                                                        +
         ),                                                                                    +
         'pendente'                                                                            +
     );                                                                                        +
     RETURN NEW;                                                                               +
 END;                                                                                          +
 $function$                                                                                    +
 

