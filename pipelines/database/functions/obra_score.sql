 CREATE OR REPLACE FUNCTION engenharia.obra_score(o engenharia.obras)                      +
  RETURNS integer                                                                          +
  LANGUAGE sql                                                                             +
  IMMUTABLE                                                                                +
 AS $function$                                                                             +
   SELECT                                                                                  +
     (CASE WHEN COALESCE(o.cnpj,'')  <> '' THEN 25 ELSE 0 END) +                           +
     (CASE WHEN COALESCE(o.uf,'')    <> '' THEN 15 ELSE 0 END) +                           +
     (CASE WHEN o.valor_estimado IS NOT NULL AND o.valor_estimado > 0 THEN 20 ELSE 0 END) ++
     (CASE WHEN COALESCE(o.setor,'') <> '' THEN 10 ELSE 0 END) +                           +
     (CASE WHEN COALESCE(o.fase,'')  <> '' THEN  5 ELSE 0 END) +                           +
     (CASE WHEN COALESCE(o.nome,'')  <> '' THEN  5 ELSE 0 END) +                           +
     (CASE                                                                                 +
         WHEN LENGTH(COALESCE(o.descricao,'')) >= 400 THEN 20                              +
         WHEN LENGTH(COALESCE(o.descricao,'')) >= 200 THEN 15                              +
         WHEN LENGTH(COALESCE(o.descricao,'')) >= 100 THEN 10                              +
         WHEN LENGTH(COALESCE(o.descricao,'')) >=   1 THEN  5                              +
         ELSE 0                                                                            +
      END);                                                                                +
 $function$                                                                                +
 

