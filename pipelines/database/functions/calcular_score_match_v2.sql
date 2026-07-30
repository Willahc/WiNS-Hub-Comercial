 CREATE OR REPLACE FUNCTION engenharia.calcular_score_match_v2(p_obra_id uuid, p_cnpj text)                      +
  RETURNS TABLE(score numeric, breakdown jsonb)                                                                  +
  LANGUAGE plpgsql                                                                                               +
  STABLE                                                                                                         +
 AS $function$                                                                                                   +
 DECLARE                                                                                                         +
   v_setor TEXT;                                                                                                 +
   v_fase TEXT;                                                                                                  +
   v_uf_obra TEXT;                                                                                               +
   v_capex NUMERIC;                                                                                              +
   v_tier TEXT;                                                                                                  +
   v_cnae_principal TEXT;                                                                                        +
   v_cnae_secund TEXT[];                                                                                         +
   v_uf_fornec TEXT;                                                                                             +
   v_porte_inf TEXT;                                                                                             +
   v_capital NUMERIC;                                                                                            +
   v_peso_cnae NUMERIC := 0;                                                                                     +
   v_peso_uf NUMERIC := 0;                                                                                       +
   v_peso_capex NUMERIC := 0;                                                                                    +
   v_peso_tier NUMERIC := 0;                                                                                     +
   v_score NUMERIC;                                                                                              +
   v_cnae_used TEXT;                                                                                             +
   v_blacklist TEXT[] := ARRAY['4399103','4930201','4930202','4923001'];                                         +
 BEGIN                                                                                                           +
   -- Obra                                                                                                       +
   SELECT o.setor, o.fase, o.uf, o.valor_estimado, o.classificacao_computed                                      +
     INTO v_setor, v_fase, v_uf_obra, v_capex, v_tier                                                            +
   FROM obras o WHERE o.id = p_obra_id;                                                                          +
   IF NOT FOUND THEN RETURN; END IF;                                                                             +
                                                                                                                 +
   -- Fornecedor                                                                                                 +
   SELECT f.cnae_principal, f.cnae_secundarios, f.uf, f.porte_inferido, f.capital_social                         +
     INTO v_cnae_principal, v_cnae_secund, v_uf_fornec, v_porte_inf, v_capital                                   +
   FROM fornecedores f WHERE f.cnpj = p_cnpj;                                                                    +
   IF NOT FOUND THEN RETURN; END IF;                                                                             +
                                                                                                                 +
   -- F6: blacklist OURO                                                                                         +
   IF v_tier = 'OURO' AND v_cnae_principal = ANY(v_blacklist) THEN RETURN; END IF;                               +
                                                                                                                 +
   -- F2: capex >R$1bi requer porte GRANDE/MEDIA                                                                 +
   IF COALESCE(v_capex, 0) > 1e9 AND COALESCE(v_porte_inf,'MICRO') NOT IN ('GRANDE','MEDIA') THEN RETURN; END IF;+
                                                                                                                 +
   -- F5: capex >R$500mi requer capital_social >= R$1M                                                           +
   IF COALESCE(v_capex, 0) > 500e6 AND COALESCE(v_capital, 0) < 1e6 THEN RETURN; END IF;                         +
                                                                                                                 +
   -- Peso CNAE: maior peso entre principal e secundários (F4)                                                   +
   SELECT MAX(scc.peso), MAX(scc.cnae_codigo)                                                                    +
     INTO v_peso_cnae, v_cnae_used                                                                               +
   FROM setor_cnae_compatibility scc                                                                             +
   WHERE scc.setor_obra = v_setor                                                                                +
     AND (                                                                                                       +
       scc.cnae_codigo = v_cnae_principal                                                                        +
       OR scc.cnae_codigo = ANY(COALESCE(v_cnae_secund, ARRAY[]::TEXT[]))                                        +
     )                                                                                                           +
     -- F1: fase aplicável                                                                                       +
     AND (v_fase IS NULL OR v_fase = ANY(scc.fases_aplicaveis));                                                 +
                                                                                                                 +
   IF COALESCE(v_peso_cnae, 0) = 0 THEN RETURN; END IF;                                                          +
                                                                                                                 +
   -- Peso UF                                                                                                    +
   SELECT up.peso INTO v_peso_uf FROM uf_proximidade up                                                          +
    WHERE up.uf_obra = v_uf_obra AND up.uf_fornec = v_uf_fornec;                                                 +
   IF v_peso_uf IS NULL THEN v_peso_uf := 0.1; END IF;  -- outra UF não-vizinha                                  +
                                                                                                                 +
   -- Peso CAPEX × porte (cross-setor adequado)                                                                  +
   v_peso_capex := CASE                                                                                          +
     WHEN v_capex IS NULL THEN 0.5  -- agnóstico                                                                 +
     WHEN v_capex > 1e9 AND v_porte_inf = 'GRANDE' THEN 1.0                                                      +
     WHEN v_capex > 1e9 AND v_porte_inf = 'MEDIA' THEN 0.7                                                       +
     WHEN v_capex > 100e6 AND v_porte_inf IN ('GRANDE','MEDIA') THEN 1.0                                         +
     WHEN v_capex > 100e6 AND v_porte_inf = 'PEQUENA' THEN 0.5                                                   +
     WHEN v_capex > 10e6 AND v_porte_inf IN ('GRANDE','MEDIA','PEQUENA') THEN 0.9                                +
     WHEN v_capex > 10e6 AND v_porte_inf = 'MICRO' THEN 0.4                                                      +
     WHEN v_capex <= 10e6 THEN 0.8  -- qualquer porte ok pra obras pequenas                                      +
     ELSE 0.5                                                                                                    +
   END;                                                                                                          +
                                                                                                                 +
   -- Peso tier                                                                                                  +
   v_peso_tier := CASE v_tier                                                                                    +
     WHEN 'OURO' THEN 1.0                                                                                        +
     WHEN 'PRATA' THEN 0.7                                                                                       +
     WHEN 'BRONZE' THEN 0.4                                                                                      +
     WHEN 'PIPELINE' THEN 0.2                                                                                    +
     ELSE 0.1                                                                                                    +
   END;                                                                                                          +
                                                                                                                 +
   -- Score final 0-100                                                                                          +
   v_score := (0.40 * v_peso_cnae + 0.25 * v_peso_uf + 0.20 * v_peso_capex + 0.15 * v_peso_tier) * 100;          +
                                                                                                                 +
   RETURN QUERY SELECT                                                                                           +
     ROUND(v_score, 1) AS score,                                                                                 +
     jsonb_build_object(                                                                                         +
       'cnae', ROUND(v_peso_cnae, 2),                                                                            +
       'cnae_codigo', v_cnae_used,                                                                               +
       'uf', ROUND(v_peso_uf, 2),                                                                                +
       'capex', ROUND(v_peso_capex, 2),                                                                          +
       'tier', ROUND(v_peso_tier, 2),                                                                            +
       'final', ROUND(v_score, 1)                                                                                +
     ) AS breakdown;                                                                                             +
 END;                                                                                                            +
 $function$                                                                                                      +
 

