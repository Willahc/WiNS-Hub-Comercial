 CREATE OR REPLACE FUNCTION engenharia.portao_flag_on(p_chave text)+
  RETURNS boolean                                                  +
  LANGUAGE sql                                                     +
  STABLE                                                           +
 AS $function$                                                     +
     SELECT lower(wins_v2.portao_flag(p_chave, 'false'))           +
            IN ('1', 'true', 'yes', 'on', 'sim');                  +
 $function$                                                        +
 

