 CREATE OR REPLACE FUNCTION engenharia.immutable_unaccent(text)+
  RETURNS text                                                 +
  LANGUAGE sql                                                 +
  IMMUTABLE PARALLEL SAFE STRICT                               +
 AS $function$                                                 +
     SELECT public.unaccent('public.unaccent', $1)             +
 $function$                                                    +
 

