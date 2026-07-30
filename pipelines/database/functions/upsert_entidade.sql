 CREATE OR REPLACE FUNCTION engenharia.upsert_entidade(p_cnpj text, p_nome text, p_tipo text DEFAULT 'JURIDICA'::text)+
  RETURNS uuid                                                                                                        +
  LANGUAGE plpgsql                                                                                                    +
  SET search_path TO 'wins_v2', 'pg_temp'                                                                             +
 AS $function$                                                                                                        +
 DECLARE v_id UUID;                                                                                                   +
 BEGIN                                                                                                                +
     INSERT INTO entidades (cnpj, nome, tipo_pessoa)                                                                  +
     VALUES (p_cnpj, p_nome, p_tipo)                                                                                  +
     ON CONFLICT (cnpj) DO UPDATE SET nome = EXCLUDED.nome                                                            +
     RETURNING id INTO v_id;                                                                                          +
     RETURN v_id;                                                                                                     +
 END $function$                                                                                                       +
 

