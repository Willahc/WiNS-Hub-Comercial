 CREATE OR REPLACE FUNCTION engenharia.cargo_decisor_keyword(cargo text)                                                                                     +
  RETURNS boolean                                                                                                                                            +
  LANGUAGE sql                                                                                                                                               +
  IMMUTABLE PARALLEL SAFE                                                                                                                                    +
 AS $function$                                                                                                                                               +
   SELECT cargo IS NOT NULL                                                                                                                                  +
      AND lower(unaccent(cargo)) ~ '(compras|suprimentos|supply|procurement|sourcing|engenh|projetos|obras|manutencao|industrial|coordenador|gerente|gestor)'+
 $function$                                                                                                                                                  +
 

