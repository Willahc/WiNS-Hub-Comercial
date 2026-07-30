 CREATE OR REPLACE FUNCTION engenharia.portao_flag(p_chave text, p_default text DEFAULT 'false'::text)+
  RETURNS text                                                                                        +
  LANGUAGE sql                                                                                        +
  STABLE                                                                                              +
 AS $function$                                                                                        +
     SELECT COALESCE(                                                                                 +
         (SELECT valor FROM wins_v2.portao_config WHERE chave = p_chave),                             +
         p_default                                                                                    +
     );                                                                                               +
 $function$                                                                                           +
 

