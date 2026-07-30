 CREATE OR REPLACE FUNCTION engenharia.mapear_tipo_cargo(cargo_raw text)                                                                                                                    +
  RETURNS text                                                                                                                                                                              +
  LANGUAGE plpgsql                                                                                                                                                                          +
  IMMUTABLE                                                                                                                                                                                 +
 AS $function$                                                                                                                                                                              +
 DECLARE                                                                                                                                                                                    +
   c TEXT;                                                                                                                                                                                  +
 BEGIN                                                                                                                                                                                      +
   IF cargo_raw IS NULL OR TRIM(cargo_raw)='' THEN RETURN 'OUTRO'; END IF;                                                                                                                  +
   c := lower(unaccent(cargo_raw));                                                                                                                                                         +
   RETURN CASE                                                                                                                                                                              +
     -- Procurement / Suprimentos / Compras / Supply Chain                                                                                                                                  +
     WHEN c ~ '(suprimento|sourcing|aquisicao|procurement|comprador|buyer)' THEN 'GERENTE_SUPRIMENTOS'                                                                                      +
     WHEN c ~ '(supply[- ]?chain|cadeia[- ]?suprimentos)' THEN 'SUPPLY_CHAIN'                                                                                                               +
     WHEN c ~ 'compras?' THEN 'GERENTE_COMPRAS'                                                                                                                                             +
     -- Engenharia mecânica/civil/elétrica                                                                                                                                                  +
     WHEN c ~ '(engenharia[- ]?mecanic|engenharia[- ]?civil|engenheiro[- ]?mecanic|engenheiro[- ]?civil|engenharia[- ]?eletric|mecanic|eletrotec|eletrici)' THEN 'ENGENHEIRO_MECANICO_CIVIL'+
     -- Engenharia genérica                                                                                                                                                                 +
     WHEN c ~ '(engenharia|engineering|engenheiro)' THEN 'GERENTE_ENGENHARIA'                                                                                                               +
     -- Projetos                                                                                                                                                                            +
     WHEN c ~ '(projetista|drafter)' THEN 'PROJETISTA'                                                                                                                                      +
     WHEN c ~ '(projetos?|project)' THEN 'GERENTE_PROJETOS'                                                                                                                                 +
     -- Operações / Manutenção / Industrial / Obras                                                                                                                                         +
     WHEN c ~ '(manutencao|maintenance)' THEN 'COORDENADOR_MANUTENCAO'                                                                                                                      +
     WHEN c ~ '(industrial|fabril|fabrica|planta\W|plant[- ]?manager)' THEN 'GERENTE_INDUSTRIAL'                                                                                            +
     WHEN c ~ '(obras|construcao|construction)' THEN 'COORDENADOR_OBRAS'                                                                                                                    +
     WHEN c ~ '(operacoes|operations)' THEN 'GERENTE_INDUSTRIAL'                                                                                                                            +
     ELSE 'OUTRO'                                                                                                                                                                           +
   END;                                                                                                                                                                                     +
 END;                                                                                                                                                                                       +
 $function$                                                                                                                                                                                 +
 

