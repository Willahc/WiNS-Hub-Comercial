 CREATE OR REPLACE FUNCTION engenharia.immutable_unaccent_lower(text)+
  RETURNS text                                                       +
  LANGUAGE sql                                                       +
  IMMUTABLE PARALLEL SAFE STRICT                                     +
 AS $function$                                                       +
   SELECT lower(public.unaccent($1))                                 +
 $function$                                                          +
 

