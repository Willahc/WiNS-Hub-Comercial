--
-- PostgreSQL database dump
--

-- Dumped from database version 16.4
-- Dumped by pg_dump version 16.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: engenharia; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA engenharia;


--
-- Name: calcular_confianca_match(uuid); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.calcular_confianca_match(p_dob_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_score INT := 0;
  v_componentes JSONB := '{}'::JSONB;
  v_dob_nome TEXT;
  v_dob_cargo TEXT;
  v_dob_email TEXT;
  v_obra_id UUID;
  v_obra_empresa TEXT;
  v_obra_cnpj TEXT;
  v_obra_descricao TEXT;
  v_radical_empresa TEXT;
  v_radical_empresa_unaccent TEXT;
  v_cargo_sufixo TEXT;
  v_dominio_email TEXT;
  v_resultado JSONB;
BEGIN
  -- Carregar contexto
  SELECT dob.nome, dob.cargo, dob.email, dob.obra_id,
         o.empresa, o.cnpj, o.descricao
  INTO v_dob_nome, v_dob_cargo, v_dob_email, v_obra_id,
       v_obra_empresa, v_obra_cnpj, v_obra_descricao
  FROM decisores_obra dob
  INNER JOIN obras o ON o.id = dob.obra_id
  WHERE dob.id = p_dob_id;

  IF v_dob_nome IS NULL THEN
    RETURN jsonb_build_object('dob_id', p_dob_id, 'erro', 'dob não encontrado');
  END IF;

  -- Radical da empresa: primeira palavra significativa (>=3 chars, ignora "A", "DA", "DE", "DO")
  v_radical_empresa := COALESCE(
    (SELECT word FROM unnest(string_to_array(TRIM(COALESCE(v_obra_empresa,'')), ' ')) AS word
     WHERE LENGTH(word) >= 3 AND UPPER(word) NOT IN ('LTDA','S/A','S.A','S.A.','SA','EIRELI','SAS','SPE','DA','DE','DO','DAS','DOS','OU','E','A','O','-','EMPRESA','GRUPO') LIMIT 1),
    SPLIT_PART(COALESCE(v_obra_empresa,''), ' ', 1)
  );
  v_radical_empresa_unaccent := LOWER(unaccent(COALESCE(v_radical_empresa,'')));

  -- =========================================================================
  -- Critério A: cargo_sufixo_match (-30 / 0 / +30)
  -- Extrai trecho após "na ", "at ", "| ", "@ ", "—" no cargo
  -- =========================================================================
  IF v_dob_cargo IS NOT NULL AND v_obra_empresa IS NOT NULL THEN
    v_cargo_sufixo := LOWER(unaccent(TRIM(
      regexp_replace(
        v_dob_cargo,
        '^.*?(?:\sna\s|\sat\s|\s\|\s|\s@\s|\s—\s|\s-\s+)',
        '',
        'i'
      )
    )));
    -- Se o regex não casou, sufixo == cargo todo. Detectamos isso:
    IF v_cargo_sufixo = LOWER(unaccent(TRIM(v_dob_cargo))) THEN
      -- Sem padrão de sufixo → 0
      v_score := v_score + 0;
      v_componentes := v_componentes || jsonb_build_object('cargo_sufixo_match', 0);
    ELSIF v_radical_empresa_unaccent <> '' AND v_cargo_sufixo LIKE '%' || v_radical_empresa_unaccent || '%' THEN
      v_score := v_score + 30;
      v_componentes := v_componentes || jsonb_build_object('cargo_sufixo_match', 30);
    ELSE
      -- Sufixo cita OUTRA empresa → penalidade
      v_score := v_score - 30;
      v_componentes := v_componentes || jsonb_build_object('cargo_sufixo_match', -30);
    END IF;
  ELSE
    v_componentes := v_componentes || jsonb_build_object('cargo_sufixo_match', 0);
  END IF;

  -- =========================================================================
  -- Critério B: dominio_email_match (+25 / 0)
  -- =========================================================================
  IF v_dob_email IS NOT NULL AND v_dob_email ~ '@' AND v_radical_empresa_unaccent <> '' THEN
    v_dominio_email := LOWER(SPLIT_PART(v_dob_email, '@', 2));
    -- Match se o radical aparece no domínio (ex: "vale@vale.com.br" matches "VALE S.A")
    IF v_dominio_email LIKE '%' || v_radical_empresa_unaccent || '%' THEN
      v_score := v_score + 25;
      v_componentes := v_componentes || jsonb_build_object('dominio_email_match', 25);
    ELSE
      v_componentes := v_componentes || jsonb_build_object('dominio_email_match', 0);
    END IF;
  ELSE
    v_componentes := v_componentes || jsonb_build_object('dominio_email_match', 0);
  END IF;

  -- =========================================================================
  -- Critério C: cargo_cita_empresa (+20 / 0)
  -- Match relaxado: cargo todo contém radical da empresa
  -- =========================================================================
  IF v_dob_cargo IS NOT NULL AND v_radical_empresa_unaccent <> '' THEN
    IF LOWER(unaccent(v_dob_cargo)) LIKE '%' || v_radical_empresa_unaccent || '%' THEN
      v_score := v_score + 20;
      v_componentes := v_componentes || jsonb_build_object('cargo_cita_empresa', 20);
    ELSE
      v_componentes := v_componentes || jsonb_build_object('cargo_cita_empresa', 0);
    END IF;
  ELSE
    v_componentes := v_componentes || jsonb_build_object('cargo_cita_empresa', 0);
  END IF;

  -- =========================================================================
  -- Critério D: cargo_compativel_setor (+15 / 0)
  -- =========================================================================
  IF v_dob_cargo IS NOT NULL AND v_dob_cargo ~* '(suprim|compras|comprador|procurement|sourcing|buyer|engenh|engineer|industri|capex|projetos|projects|operations|operacoe|manuten|maintenance|diretor|director|presidente|chief|gerente|coordenad|head|supply\s*chain)' THEN
    v_score := v_score + 15;
    v_componentes := v_componentes || jsonb_build_object('cargo_compativel_setor', 15);
  ELSE
    v_componentes := v_componentes || jsonb_build_object('cargo_compativel_setor', 0);
  END IF;

  -- =========================================================================
  -- Critério E: citado_em_descricao (+10 / 0)
  -- =========================================================================
  IF v_obra_descricao IS NOT NULL AND v_dob_nome IS NOT NULL
     AND LENGTH(v_obra_descricao) BETWEEN 10 AND 20000 THEN
    IF LOWER(unaccent(v_obra_descricao)) LIKE '%' || LOWER(unaccent(v_dob_nome)) || '%' THEN
      v_score := v_score + 10;
      v_componentes := v_componentes || jsonb_build_object('citado_em_descricao', 10);
    ELSE
      v_componentes := v_componentes || jsonb_build_object('citado_em_descricao', 0);
    END IF;
  ELSE
    v_componentes := v_componentes || jsonb_build_object('citado_em_descricao', 0);
  END IF;

  -- Floor at 0 (não armazenar score negativo, mas componente fica negativo no breakdown)
  IF v_score < 0 THEN
    v_score := 0;
  END IF;

  -- Persistir
  UPDATE decisores_obra
  SET
    confianca_match = v_score,
    confianca_match_componentes = v_componentes,
    confianca_match_calculada_em = NOW()
  WHERE id = p_dob_id;

  v_resultado := jsonb_build_object(
    'dob_id', p_dob_id,
    'score', v_score,
    'componentes', v_componentes,
    'radical_empresa', v_radical_empresa,
    'cargo_sufixo_extraido', v_cargo_sufixo
  );

  RETURN v_resultado;
END;
$$;


--
-- Name: FUNCTION calcular_confianca_match(p_dob_id uuid); Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON FUNCTION engenharia.calcular_confianca_match(p_dob_id uuid) IS 'Calcula score 0-100 de confiança do match decisor↔obra. Adaptado p/ decisores_obra autônoma. Componente A pode ser negativo (-30) se cargo cita OUTRA empresa, mas score persistido tem floor=0. Atualiza decisores_obra in-place.';


--
-- Name: calcular_confianca_match_v2(uuid); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.calcular_confianca_match_v2(p_dob_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_score INT := 0;
  v_componentes JSONB := '{}'::JSONB;
  v_dob_nome TEXT;
  v_dob_cargo TEXT;
  v_dob_email TEXT;
  v_obra_empresa TEXT;
  v_obra_descricao TEXT;
  v_radical_empresa TEXT;
  v_radical_empresa_unaccent TEXT;
  v_cargo_sufixo TEXT;
  v_dominio_email TEXT;
  v_qtd_cnpj_raiz INT;
BEGIN
  -- Carregar contexto
  SELECT dob.nome, dob.cargo, dob.email, o.empresa, o.descricao
  INTO v_dob_nome, v_dob_cargo, v_dob_email, v_obra_empresa, v_obra_descricao
  FROM decisores_obra dob
  INNER JOIN obras o ON o.id = dob.obra_id
  WHERE dob.id = p_dob_id;

  IF v_dob_nome IS NULL THEN
    RETURN jsonb_build_object('dob_id', p_dob_id, 'erro', 'dob não encontrado');
  END IF;

  -- Radical da empresa
  v_radical_empresa := COALESCE(
    (SELECT word FROM unnest(string_to_array(TRIM(COALESCE(v_obra_empresa,'')), ' ')) AS word
     WHERE LENGTH(word) >= 3
       AND UPPER(word) NOT IN ('LTDA','S/A','S.A','S.A.','SA','EIRELI','SAS','SPE','DA','DE','DO','DAS','DOS','OU','E','A','O','-','EMPRESA','GRUPO')
     LIMIT 1),
    SPLIT_PART(COALESCE(v_obra_empresa,''), ' ', 1)
  );
  v_radical_empresa_unaccent := LOWER(unaccent(COALESCE(v_radical_empresa,'')));

  -- A: cargo_sufixo_match (já implementa o critério F do briefing)
  IF v_dob_cargo IS NOT NULL AND v_obra_empresa IS NOT NULL THEN
    v_cargo_sufixo := LOWER(unaccent(TRIM(
      regexp_replace(v_dob_cargo, '^.*?(?:\sna\s|\sat\s|\s\|\s|\s@\s|\s—\s|\s–\s|\s-\s+)', '', 'i')
    )));
    IF v_cargo_sufixo = LOWER(unaccent(TRIM(v_dob_cargo))) THEN
      v_componentes := v_componentes || jsonb_build_object('cargo_sufixo_match', 0);
    ELSIF v_radical_empresa_unaccent <> '' AND v_cargo_sufixo LIKE '%' || v_radical_empresa_unaccent || '%' THEN
      v_score := v_score + 30;
      v_componentes := v_componentes || jsonb_build_object('cargo_sufixo_match', 30);
    ELSE
      v_score := v_score - 30;
      v_componentes := v_componentes || jsonb_build_object('cargo_sufixo_match', -30);
    END IF;
  ELSE
    v_componentes := v_componentes || jsonb_build_object('cargo_sufixo_match', 0);
  END IF;

  -- B: dominio_email_match
  IF v_dob_email IS NOT NULL AND v_dob_email ~ '@' AND v_radical_empresa_unaccent <> '' THEN
    v_dominio_email := LOWER(SPLIT_PART(v_dob_email, '@', 2));
    IF v_dominio_email LIKE '%' || v_radical_empresa_unaccent || '%' THEN
      v_score := v_score + 25;
      v_componentes := v_componentes || jsonb_build_object('dominio_email_match', 25);
    ELSE
      v_componentes := v_componentes || jsonb_build_object('dominio_email_match', 0);
    END IF;
  ELSE
    v_componentes := v_componentes || jsonb_build_object('dominio_email_match', 0);
  END IF;

  -- C: cargo_cita_empresa
  IF v_dob_cargo IS NOT NULL AND v_radical_empresa_unaccent <> '' THEN
    IF LOWER(unaccent(v_dob_cargo)) LIKE '%' || v_radical_empresa_unaccent || '%' THEN
      v_score := v_score + 20;
      v_componentes := v_componentes || jsonb_build_object('cargo_cita_empresa', 20);
    ELSE
      v_componentes := v_componentes || jsonb_build_object('cargo_cita_empresa', 0);
    END IF;
  ELSE
    v_componentes := v_componentes || jsonb_build_object('cargo_cita_empresa', 0);
  END IF;

  -- D: cargo_compativel_setor
  IF v_dob_cargo IS NOT NULL AND v_dob_cargo ~* '(suprim|compras|comprador|procurement|sourcing|buyer|engenh|engineer|industri|capex|projetos|projects|operations|operacoe|manuten|maintenance|diretor|director|presidente|chief|gerente|coordenad|head|supply\s*chain)' THEN
    v_score := v_score + 15;
    v_componentes := v_componentes || jsonb_build_object('cargo_compativel_setor', 15);
  ELSE
    v_componentes := v_componentes || jsonb_build_object('cargo_compativel_setor', 0);
  END IF;

  -- E: citado_em_descricao
  IF v_obra_descricao IS NOT NULL AND v_dob_nome IS NOT NULL
     AND LENGTH(v_obra_descricao) BETWEEN 10 AND 20000 THEN
    IF LOWER(unaccent(v_obra_descricao)) LIKE '%' || LOWER(unaccent(v_dob_nome)) || '%' THEN
      v_score := v_score + 10;
      v_componentes := v_componentes || jsonb_build_object('citado_em_descricao', 10);
    ELSE
      v_componentes := v_componentes || jsonb_build_object('citado_em_descricao', 0);
    END IF;
  ELSE
    v_componentes := v_componentes || jsonb_build_object('citado_em_descricao', 0);
  END IF;

  -- G: consistencia_intragrupo (NOVO v2)
  -- Conta quantos cnpj-raízes distintos esse mesmo nome aparece (entre obras ativas)
  -- 1 raiz = grupo coeso (+15), 2-3 = holding plausível (+5), >5 = wire-in falso (-15)
  SELECT COUNT(DISTINCT SUBSTRING(o2.cnpj FROM 1 FOR 8))
  INTO v_qtd_cnpj_raiz
  FROM decisores_obra dob2
  INNER JOIN obras o2 ON o2.id = dob2.obra_id
  WHERE dob2.nome = v_dob_nome
    AND dob2.excluido_em IS NULL
    AND o2.cnpj IS NOT NULL
    AND LENGTH(o2.cnpj) >= 8;

  IF v_qtd_cnpj_raiz = 1 THEN
    v_score := v_score + 15;
    v_componentes := v_componentes || jsonb_build_object('consistencia_intragrupo', 15);
  ELSIF v_qtd_cnpj_raiz BETWEEN 2 AND 3 THEN
    v_score := v_score + 5;
    v_componentes := v_componentes || jsonb_build_object('consistencia_intragrupo', 5);
  ELSIF v_qtd_cnpj_raiz > 5 THEN
    v_score := v_score - 15;
    v_componentes := v_componentes || jsonb_build_object('consistencia_intragrupo', -15);
  ELSE
    v_componentes := v_componentes || jsonb_build_object('consistencia_intragrupo', 0);
  END IF;

  -- H: email_corporativo (NOVO v2)
  -- Email não-pessoal (não-gmail/hotmail/etc) sinaliza credibilidade
  IF v_dob_email IS NOT NULL
     AND v_dob_email !~* '@(gmail|hotmail|yahoo|outlook|uol|terra|bol|live|icloud|me|mail)\.'
     AND v_dob_email ~ '@' THEN
    v_score := v_score + 10;
    v_componentes := v_componentes || jsonb_build_object('email_corporativo', 10);
  ELSE
    v_componentes := v_componentes || jsonb_build_object('email_corporativo', 0);
  END IF;

  -- Clamp [0, 100]
  v_score := GREATEST(0, LEAST(100, v_score));

  UPDATE decisores_obra
  SET
    confianca_match = v_score,
    confianca_match_componentes = v_componentes,
    confianca_match_calculada_em = NOW()
  WHERE id = p_dob_id;

  RETURN jsonb_build_object(
    'dob_id', p_dob_id,
    'score', v_score,
    'componentes', v_componentes,
    'qtd_cnpj_raiz', v_qtd_cnpj_raiz
  );
END;
$$;


--
-- Name: FUNCTION calcular_confianca_match_v2(p_dob_id uuid); Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON FUNCTION engenharia.calcular_confianca_match_v2(p_dob_id uuid) IS 'Score v2 (Sprint 2): 5 critérios v1 + G consistencia_intragrupo (resolve Eliclea/Felipe pattern) + H email_corporativo. Score 0-100.';


--
-- Name: calcular_score_match_v2(uuid, text); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.calcular_score_match_v2(p_obra_id uuid, p_cnpj text) RETURNS TABLE(score numeric, breakdown jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
  v_setor TEXT;
  v_fase TEXT;
  v_uf_obra TEXT;
  v_capex NUMERIC;
  v_tier TEXT;
  v_cnae_principal TEXT;
  v_cnae_secund TEXT[];
  v_uf_fornec TEXT;
  v_porte_inf TEXT;
  v_capital NUMERIC;
  v_peso_cnae NUMERIC := 0;
  v_peso_uf NUMERIC := 0;
  v_peso_capex NUMERIC := 0;
  v_peso_tier NUMERIC := 0;
  v_score NUMERIC;
  v_cnae_used TEXT;
  v_blacklist TEXT[] := ARRAY['4399103','4930201','4930202','4923001'];
BEGIN
  -- Obra
  SELECT o.setor, o.fase, o.uf, o.valor_estimado, o.classificacao_computed
    INTO v_setor, v_fase, v_uf_obra, v_capex, v_tier
  FROM obras o WHERE o.id = p_obra_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Fornecedor
  SELECT f.cnae_principal, f.cnae_secundarios, f.uf, f.porte_inferido, f.capital_social
    INTO v_cnae_principal, v_cnae_secund, v_uf_fornec, v_porte_inf, v_capital
  FROM fornecedores f WHERE f.cnpj = p_cnpj;
  IF NOT FOUND THEN RETURN; END IF;

  -- F6: blacklist OURO
  IF v_tier = 'OURO' AND v_cnae_principal = ANY(v_blacklist) THEN RETURN; END IF;

  -- F2: capex >R$1bi requer porte GRANDE/MEDIA
  IF COALESCE(v_capex, 0) > 1e9 AND COALESCE(v_porte_inf,'MICRO') NOT IN ('GRANDE','MEDIA') THEN RETURN; END IF;

  -- F5: capex >R$500mi requer capital_social >= R$1M
  IF COALESCE(v_capex, 0) > 500e6 AND COALESCE(v_capital, 0) < 1e6 THEN RETURN; END IF;

  -- Peso CNAE: maior peso entre principal e secundários (F4)
  SELECT MAX(scc.peso), MAX(scc.cnae_codigo)
    INTO v_peso_cnae, v_cnae_used
  FROM setor_cnae_compatibility scc
  WHERE scc.setor_obra = v_setor
    AND (
      scc.cnae_codigo = v_cnae_principal
      OR scc.cnae_codigo = ANY(COALESCE(v_cnae_secund, ARRAY[]::TEXT[]))
    )
    -- F1: fase aplicável
    AND (v_fase IS NULL OR v_fase = ANY(scc.fases_aplicaveis));

  IF COALESCE(v_peso_cnae, 0) = 0 THEN RETURN; END IF;

  -- Peso UF
  SELECT up.peso INTO v_peso_uf FROM uf_proximidade up
   WHERE up.uf_obra = v_uf_obra AND up.uf_fornec = v_uf_fornec;
  IF v_peso_uf IS NULL THEN v_peso_uf := 0.1; END IF;  -- outra UF não-vizinha

  -- Peso CAPEX × porte (cross-setor adequado)
  v_peso_capex := CASE
    WHEN v_capex IS NULL THEN 0.5  -- agnóstico
    WHEN v_capex > 1e9 AND v_porte_inf = 'GRANDE' THEN 1.0
    WHEN v_capex > 1e9 AND v_porte_inf = 'MEDIA' THEN 0.7
    WHEN v_capex > 100e6 AND v_porte_inf IN ('GRANDE','MEDIA') THEN 1.0
    WHEN v_capex > 100e6 AND v_porte_inf = 'PEQUENA' THEN 0.5
    WHEN v_capex > 10e6 AND v_porte_inf IN ('GRANDE','MEDIA','PEQUENA') THEN 0.9
    WHEN v_capex > 10e6 AND v_porte_inf = 'MICRO' THEN 0.4
    WHEN v_capex <= 10e6 THEN 0.8  -- qualquer porte ok pra obras pequenas
    ELSE 0.5
  END;

  -- Peso tier
  v_peso_tier := CASE v_tier
    WHEN 'OURO' THEN 1.0
    WHEN 'PRATA' THEN 0.7
    WHEN 'BRONZE' THEN 0.4
    WHEN 'PIPELINE' THEN 0.2
    ELSE 0.1
  END;

  -- Score final 0-100
  v_score := (0.40 * v_peso_cnae + 0.25 * v_peso_uf + 0.20 * v_peso_capex + 0.15 * v_peso_tier) * 100;

  RETURN QUERY SELECT
    ROUND(v_score, 1) AS score,
    jsonb_build_object(
      'cnae', ROUND(v_peso_cnae, 2),
      'cnae_codigo', v_cnae_used,
      'uf', ROUND(v_peso_uf, 2),
      'capex', ROUND(v_peso_capex, 2),
      'tier', ROUND(v_peso_tier, 2),
      'final', ROUND(v_score, 1)
    ) AS breakdown;
END;
$_$;


--
-- Name: cargo_decisor_keyword(text); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.cargo_decisor_keyword(cargo text) RETURNS boolean
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
  SELECT cargo IS NOT NULL
     AND lower(unaccent(cargo)) ~ '(compras|suprimentos|supply|procurement|sourcing|engenh|projetos|obras|manutencao|industrial|coordenador|gerente|gestor)'
$$;


--
-- Name: cnpj_dv_valido(text); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.cnpj_dv_valido(value text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE STRICT PARALLEL SAFE
    AS $_$
DECLARE
    total INTEGER;
    digit_one INTEGER;
    digit_two INTEGER;
    position INTEGER;
BEGIN
    IF value !~ '^[0-9]{14}$' OR value = repeat(substr(value, 1, 1), 14) THEN
        RETURN FALSE;
    END IF;

    total := 0;
    FOR position IN 1..12 LOOP
        total := total
            + substr(value, position, 1)::INTEGER
            * CASE WHEN position <= 4 THEN 6 - position ELSE 14 - position END;
    END LOOP;
    digit_one := 11 - (total % 11);
    IF digit_one >= 10 THEN
        digit_one := 0;
    END IF;
    IF digit_one <> substr(value, 13, 1)::INTEGER THEN
        RETURN FALSE;
    END IF;

    total := 0;
    FOR position IN 1..13 LOOP
        total := total
            + substr(value, position, 1)::INTEGER
            * CASE WHEN position <= 5 THEN 7 - position ELSE 15 - position END;
    END LOOP;
    digit_two := 11 - (total % 11);
    IF digit_two >= 10 THEN
        digit_two := 0;
    END IF;

    RETURN digit_two = substr(value, 14, 1)::INTEGER;
END;
$_$;


--
-- Name: cnpj_valido(text); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.cnpj_valido(p_cnpj text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $_$
DECLARE
    v_cnpj TEXT;
    v_soma INT;
    v_resto INT;
    v_dv1 INT;
    v_dv2 INT;
    v_pesos1 INT[] := ARRAY[5,4,3,2,9,8,7,6,5,4,3,2];
    v_pesos2 INT[] := ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2];
BEGIN
    v_cnpj := regexp_replace(COALESCE(p_cnpj, ''), '[^0-9]', '', 'g');
    IF length(v_cnpj) != 14 THEN RETURN FALSE; END IF;
    IF v_cnpj ~ '^(\d)\1{13}$' THEN RETURN FALSE; END IF;

    v_soma := 0;
    FOR i IN 1..12 LOOP
        v_soma := v_soma + (substring(v_cnpj from i for 1)::INT * v_pesos1[i]);
    END LOOP;
    v_resto := v_soma % 11;
    v_dv1 := CASE WHEN v_resto < 2 THEN 0 ELSE 11 - v_resto END;
    IF substring(v_cnpj from 13 for 1)::INT != v_dv1 THEN RETURN FALSE; END IF;

    v_soma := 0;
    FOR i IN 1..13 LOOP
        v_soma := v_soma + (substring(v_cnpj from i for 1)::INT * v_pesos2[i]);
    END LOOP;
    v_resto := v_soma % 11;
    v_dv2 := CASE WHEN v_resto < 2 THEN 0 ELSE 11 - v_resto END;
    IF substring(v_cnpj from 14 for 1)::INT != v_dv2 THEN RETURN FALSE; END IF;

    RETURN TRUE;
END;
$_$;


--
-- Name: consolidar_grupo(uuid); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.consolidar_grupo(p_grupo_id uuid) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'wins_v2', 'pg_temp'
    AS $$
DECLARE
    v_count INT := 0;
    v_campo RECORD;
    v_prioridade TEXT[];
    v_valor_mestre TEXT;
    v_fonte_pref INT;
    v_captura_origem UUID;
    v_confianca NUMERIC(3,2);
    v_alternativas JSONB;
    v_valores RECORD;
    v_valores_unicos TEXT[];
    v_first_valor TEXT;
    v_first_fonte INT;
    v_first_captura UUID;
    v_second_valor TEXT;
    v_second_fonte INT;
    v_second_captura UUID;
    v_conflict_id UUID;
    v_tipo_conflito TEXT;
    v_justificativa TEXT;
    v_fonte_nome TEXT;
BEGIN
    PERFORM id FROM grupos_consolidados
    WHERE id = p_grupo_id
    FOR UPDATE;

    FOR v_campo IN
        SELECT DISTINCT vn.campo_canonico_id
        FROM grupo_capturas gc
        JOIN valores_normalizados vn ON vn.captura_bruta_id = gc.captura_bruta_id
        WHERE gc.grupo_id = p_grupo_id
        ORDER BY vn.campo_canonico_id
    LOOP
        SELECT ordem_prioridade INTO v_prioridade
        FROM regras_prioridade_campos
        WHERE campo_canonico_id = v_campo.campo_canonico_id AND ativo = true
        ORDER BY criado_em DESC LIMIT 1;

        v_alternativas := '[]'::jsonb;

        FOR v_valores IN
            SELECT vn.valor_normalizado, vn.fonte_id, vn.captura_bruta_id,
                   vn.confianca, f.nome AS fonte_nome
            FROM grupo_capturas gc
            JOIN valores_normalizados vn ON vn.captura_bruta_id = gc.captura_bruta_id
            LEFT JOIN fontes f ON f.id = vn.fonte_id
            WHERE gc.grupo_id = p_grupo_id
              AND vn.campo_canonico_id = v_campo.campo_canonico_id
              AND vn.valor_normalizado IS NOT NULL
            ORDER BY
                CASE WHEN v_prioridade IS NOT NULL THEN
                    array_position(v_prioridade, f.nome)
                ELSE 999 END NULLS LAST,
                vn.confianca DESC,
                vn.criado_em DESC
        LOOP
            v_alternativas := v_alternativas || jsonb_build_object(
                'valor', v_valores.valor_normalizado,
                'fonte_id', v_valores.fonte_id,
                'fonte_nome', v_valores.fonte_nome,
                'captura_id', v_valores.captura_bruta_id,
                'confianca', v_valores.confianca
            );
        END LOOP;

        IF jsonb_array_length(v_alternativas) = 0 THEN
            CONTINUE;
        END IF;

        v_valor_mestre := v_alternativas->0->>'valor';
        v_fonte_pref := (v_alternativas->0->>'fonte_id')::INT;
        v_captura_origem := (v_alternativas->0->>'captura_id')::UUID;
        v_confianca := (v_alternativas->0->>'confianca')::NUMERIC(3,2);
        v_fonte_nome := v_alternativas->0->>'fonte_nome';

        SELECT array_agg(DISTINCT valor) INTO v_valores_unicos
        FROM jsonb_to_recordset(v_alternativas) AS _(valor TEXT);

        IF array_length(v_valores_unicos, 1) > 1 THEN
            v_tipo_conflito := CASE
                WHEN v_campo.campo_canonico_id LIKE 'CC-0%' THEN 'valor'
                WHEN v_campo.campo_canonico_id LIKE 'CC-02%' THEN 'entidade'
                WHEN v_campo.campo_canonico_id LIKE 'CC-03%' THEN 'localizacao'
                WHEN v_campo.campo_canonico_id LIKE 'CC-04%' THEN 'descricao_tecnica'
                ELSE 'valor'
            END;

            v_first_valor := NULL;
            v_first_fonte := NULL;
            v_first_captura := NULL;
            v_second_valor := NULL;
            v_second_fonte := NULL;
            v_second_captura := NULL;

            FOR v_valores IN
                SELECT DISTINCT ON (alt->>'valor')
                    alt->>'valor' AS valor,
                    (alt->>'fonte_id')::INT AS fonte_id,
                    (alt->>'captura_id')::UUID AS captura_id
                FROM jsonb_array_elements(v_alternativas) alt
                ORDER BY alt->>'valor'
                LIMIT 2
            LOOP
                IF v_first_valor IS NULL THEN
                    v_first_valor := v_valores.valor;
                    v_first_fonte := v_valores.fonte_id;
                    v_first_captura := v_valores.captura_id;
                ELSIF v_second_valor IS NULL AND v_valores.valor <> v_first_valor THEN
                    v_second_valor := v_valores.valor;
                    v_second_fonte := v_valores.fonte_id;
                    v_second_captura := v_valores.captura_id;
                END IF;
            END LOOP;

            IF v_second_valor IS NOT NULL THEN
                BEGIN
                    v_conflict_id := detectar_conflito(
                        p_grupo_id,
                        v_campo.campo_canonico_id,
                        v_first_valor,
                        v_second_valor,
                        v_first_fonte,
                        v_second_fonte,
                        v_first_captura,
                        v_second_captura,
                        NULL
                    );
                EXCEPTION
                    WHEN OTHERS THEN
                        NULL;
                END;
            END IF;
        END IF;

        v_justificativa := 'Selecionado por prioridade de fonte';
        IF v_fonte_nome IS NOT NULL THEN
            v_justificativa := v_justificativa || ' (' || v_fonte_nome || ')';
        END IF;

        INSERT INTO valores_mestre (grupo_id, campo_canonico_id, valor_mestre,
                                    fonte_preferencial, captura_origem_id, confianca,
                                    justificativa, alternativas)
        VALUES (p_grupo_id, v_campo.campo_canonico_id, v_valor_mestre,
                v_fonte_pref, v_captura_origem, v_confianca,
                v_justificativa, v_alternativas)
        ON CONFLICT (grupo_id, campo_canonico_id) DO UPDATE
            SET valor_mestre = EXCLUDED.valor_mestre,
                fonte_preferencial = EXCLUDED.fonte_preferencial,
                captura_origem_id = EXCLUDED.captura_origem_id,
                confianca = EXCLUDED.confianca,
                alternativas = EXCLUDED.alternativas,
                justificativa = EXCLUDED.justificativa,
                atualizado_em = now();

        v_count := v_count + 1;
    END LOOP;

    INSERT INTO auditoria_consolidacao (grupo_id, acao, detalhes)
    VALUES (p_grupo_id, 'consolidacao_finalizada',
            jsonb_build_object('campos_consolidados', v_count));

    RETURN v_count;
END;
$$;


--
-- Name: detectar_conflito(uuid, text, text, text, integer, integer, uuid, uuid, text); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.detectar_conflito(p_grupo_id uuid, p_campo_canonico_id text, p_valor_a text, p_valor_b text, p_fonte_a_id integer DEFAULT NULL::integer, p_fonte_b_id integer DEFAULT NULL::integer, p_captura_a_id uuid DEFAULT NULL::uuid, p_captura_b_id uuid DEFAULT NULL::uuid, p_tipo_conflito text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'wins_v2', 'pg_temp'
    AS $$
DECLARE
    v_conflito_id UUID;
    v_tipo_conflito TEXT;
    v_categoria TEXT;
BEGIN
    IF p_tipo_conflito IS NOT NULL THEN
        v_tipo_conflito := p_tipo_conflito;
    ELSE
        SELECT cc.categoria INTO v_categoria
        FROM campos_canonicos cc
        WHERE cc.id = p_campo_canonico_id;

        v_tipo_conflito := CASE
            WHEN v_categoria IS NOT NULL AND v_categoria IN (
                'identificacao', 'localizacao', 'entidade', 'valor',
                'descricao', 'data', 'papel', 'fase'
            ) THEN
                CASE v_categoria
                    WHEN 'identificacao' THEN 'identificador'
                    WHEN 'localizacao' THEN 'localizacao'
                    WHEN 'entidade' THEN 'entidade'
                    WHEN 'valor' THEN 'valor'
                    WHEN 'descricao' THEN 'descricao_tecnica'
                    WHEN 'data' THEN 'data'
                    WHEN 'papel' THEN 'papel'
                    WHEN 'fase' THEN 'fase'
                END
            WHEN p_campo_canonico_id LIKE 'CC-0%' THEN 'valor'
            WHEN p_campo_canonico_id LIKE 'CC-01%' THEN 'valor'
            WHEN p_campo_canonico_id LIKE 'CC-02%' THEN 'entidade'
            WHEN p_campo_canonico_id LIKE 'CC-03%' THEN 'localizacao'
            WHEN p_campo_canonico_id LIKE 'CC-04%' THEN 'descricao_tecnica'
            ELSE 'valor'
        END;
    END IF;

    IF semanticamente_compativel(p_campo_canonico_id, p_valor_a, p_valor_b) THEN
        INSERT INTO auditoria_consolidacao (grupo_id, campo_canonico_id, acao, detalhes)
        VALUES (p_grupo_id, p_campo_canonico_id, 'conflito_ignorado',
                jsonb_build_object(
                    'motivo', 'valores_semanticamente_compativeis',
                    'valor_a', p_valor_a,
                    'valor_b', p_valor_b,
                    'tipo', v_tipo_conflito
                ));
        RETURN NULL;
    END IF;

    SELECT fc.id INTO v_conflito_id
    FROM conflitos_campos fc
    WHERE fc.grupo_id = p_grupo_id
      AND fc.campo_canonico_id = p_campo_canonico_id
      AND (
        (fc.valor_a = p_valor_a AND fc.valor_b = p_valor_b) OR
        (fc.valor_a = p_valor_b AND fc.valor_b = p_valor_a)
      )
      AND fc.estado = 'ABERTO'
    LIMIT 1;

    IF v_conflito_id IS NOT NULL THEN
        RETURN v_conflito_id;
    END IF;

    INSERT INTO conflitos_campos (grupo_id, campo_canonico_id, valor_a, valor_b,
                                   fonte_a_id, fonte_b_id, captura_a_id, captura_b_id,
                                   tipo_conflito)
    VALUES (p_grupo_id, p_campo_canonico_id, p_valor_a, p_valor_b,
            p_fonte_a_id, p_fonte_b_id, p_captura_a_id, p_captura_b_id,
            v_tipo_conflito)
    RETURNING id INTO v_conflito_id;

    INSERT INTO auditoria_consolidacao (grupo_id, campo_canonico_id, acao, detalhes)
    VALUES (p_grupo_id, p_campo_canonico_id, 'conflito_detectado',
            jsonb_build_object(
                'conflito_id', v_conflito_id,
                'tipo', v_tipo_conflito,
                'valor_a', p_valor_a,
                'valor_b', p_valor_b
            ));

    RETURN v_conflito_id;
END;
$$;


--
-- Name: fn_autovalidar_oficial(); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.fn_autovalidar_oficial() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF COALESCE(NEW.fonte_tipo,'OFICIAL')='OFICIAL' AND NEW.validacao_obra_at IS NULL THEN
    NEW.validacao_obra_at := now();
    NEW.validacao_metodo  := COALESCE(NEW.validacao_metodo,'auto:fonte_oficial');
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: fn_classificar_obra_nova(); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.fn_classificar_obra_nova() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM recompute_classificacao_obra(NEW.id);
  RETURN NULL;
END;
$$;


--
-- Name: fn_detectar_cnpj_guarda_chuva(); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.fn_detectar_cnpj_guarda_chuva() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  n_empresas_existentes INTEGER;
BEGIN
  -- Só roda em INSERT, ou UPDATE quando cnpj mudou
  IF NEW.cnpj IS NULL OR LENGTH(NEW.cnpj) <> 14 THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND (OLD.cnpj IS NOT DISTINCT FROM NEW.cnpj) THEN
    RETURN NEW;
  END IF;

  -- Contar quantas empresas DISTINTAS já usam esse CNPJ
  SELECT COUNT(DISTINCT empresa) INTO n_empresas_existentes
  FROM obras 
  WHERE cnpj = NEW.cnpj AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND (visivel IS NULL OR visivel=true)
    AND empresa IS NOT NULL AND empresa <> '';

  -- Se já há 5+ empresas distintas com esse CNPJ E a nova empresa NÃO bate com nenhuma → CNPJ guarda-chuva
  IF n_empresas_existentes >= 5 THEN
    IF NOT EXISTS (
      SELECT 1 FROM obras 
      WHERE cnpj = NEW.cnpj 
        AND (visivel IS NULL OR visivel=true)
        AND (
          UPPER(empresa) = UPPER(NEW.empresa) OR
          UPPER(empresa) LIKE UPPER('%' || SPLIT_PART(COALESCE(NEW.empresa,''), ' ', 1) || '%')
        )
    ) THEN
      RAISE WARNING 'CNPJ GUARDA-CHUVA DETECTADO: cnpj=% já vinculado a % empresas distintas; empresa nova "%" não bate. Zerando cnpj.', NEW.cnpj, n_empresas_existentes, NEW.empresa;
      NEW.cnpj := NULL;
      NEW.observacoes_validacao := COALESCE(NEW.observacoes_validacao||' | ','') 
        || 'cnpj_guarda_chuva_detectado_' || TO_CHAR(NOW(),'YYYYMMDD') 
        || ': cnpj zerado (já vinculado a ' || n_empresas_existentes || ' empresas distintas)';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: fn_enqueue_enrichment(); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.fn_enqueue_enrichment() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Se Portão ativo para novas capturas, só enfileira se APROVADA
  IF wins_v2.portao_flag_on('PORTAO_OBRAS_ENABLED')
     AND wins_v2.portao_flag_on('PORTAO_OBRAS_NEW_CAPTURES_ENABLED')
  THEN
    IF NEW.status_portao IS DISTINCT FROM 'APROVADA' THEN
      RETURN NEW;
    END IF;
    IF NOT wins_v2.portao_flag_on('AUTO_ENRICH_AFTER_GATE_ENABLED') THEN
      RETURN NEW;
    END IF;
  END IF;

  IF COALESCE(NEW.fonte,'') NOT IN ('anm_cfem','ibama_sislic')
     AND NEW.motivo_invisivel IS NULL
  THEN
    INSERT INTO enrichment_queue (obra_id, capex)
    VALUES (NEW.id, COALESCE(NEW.valor_estimado, 0))
    ON CONFLICT (obra_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION fn_enqueue_enrichment(); Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON FUNCTION engenharia.fn_enqueue_enrichment() IS 'AFTER INSERT em obras: enfileira em enrichment_queue. Pula fontes anm_cfem/ibama_sislic (royalty/licenca, nao sao obras). Pula motivo_invisivel preenchido. ON CONFLICT no-op (idempotente).';


--
-- Name: fn_flip_noticia_to_manual_pos_enrich(); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.fn_flip_noticia_to_manual_pos_enrich() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_obra obras%ROWTYPE;
BEGIN
  -- Só roda se o decisor inserido/atualizado não está excluído
  IF NEW.excluido_em IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_obra FROM obras WHERE id = NEW.obra_id;

  -- Condições: NOTICIA + cnpj válido + agora tem ao menos 1 decisor ativo
  IF v_obra.fonte_tipo = 'NOTICIA' 
     AND v_obra.cnpj IS NOT NULL AND LENGTH(v_obra.cnpj) = 14
     AND (v_obra.visivel IS NULL OR v_obra.visivel = TRUE) THEN
    UPDATE obras 
    SET fonte_tipo = 'MANUAL',
        validacao_obra_at = COALESCE(validacao_obra_at, NOW()),
        observacoes_validacao = COALESCE(observacoes_validacao||' | ','') 
          || 'auto_flip_noticia_manual_' || TO_CHAR(NOW(),'YYYYMMDD') 
          || ': decisor+cnpj enrichados (drain_queue/manual)'
    WHERE id = NEW.obra_id;
    -- Recompute em chamada subsequente (não pode chamar aqui — trigger em decisores triggera trigger em obras)
    PERFORM recompute_classificacao_obra(NEW.obra_id);
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: fn_portao_enfileirar(); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.fn_portao_enfileirar() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'wins_v2'
    AS $$
BEGIN
    IF NEW.status_portao = 'EM_ANALISE'
       AND wins_v2.portao_flag_on('PORTAO_OBRAS_ENABLED')
       AND wins_v2.portao_flag_on('PORTAO_OBRAS_NEW_CAPTURES_ENABLED')
    THEN
        IF NOT EXISTS (
            SELECT 1 FROM wins_v2.portao_fila
             WHERE obra_id = NEW.id
               AND status IN ('pendente', 'processando')
        ) THEN
            INSERT INTO wins_v2.portao_fila (obra_id, captura_id, status)
            VALUES (NEW.id, NEW.id, 'pendente');
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: fn_portao_nova_captura(); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.fn_portao_nova_captura() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'wins_v2'
    AS $$
DECLARE
    v_enabled boolean;
    v_new_cap boolean;
BEGIN
    BEGIN
        v_enabled := wins_v2.portao_flag_on('PORTAO_OBRAS_ENABLED');
        v_new_cap := wins_v2.portao_flag_on('PORTAO_OBRAS_NEW_CAPTURES_ENABLED');
    EXCEPTION WHEN OTHERS THEN
        RETURN NEW;
    END;

    IF NOT (v_enabled AND v_new_cap) THEN
        RETURN NEW;
    END IF;

    -- Não sobrescrever decisão manual/existente
    IF NEW.status_portao IS NOT NULL THEN
        RETURN NEW;
    END IF;

    NEW.status_portao := 'EM_ANALISE';
    NEW.status_enriquecimento := COALESCE(NEW.status_enriquecimento, 'NAO_INICIADO');
    NEW.visivel := false;
    NEW.motivo_invisivel := COALESCE(NULLIF(NEW.motivo_invisivel, ''), 'aguardando_portao');
    NEW.portao_versao := wins_v2.portao_flag('PORTAO_VERSAO', 'portao-v5.0.0');
    NEW.portao_motivo := COALESCE(NEW.portao_motivo, 'nova_captura_aguardando_portao');

    RETURN NEW;
END;
$$;


--
-- Name: fn_reuso_decisor_preservado(); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.fn_reuso_decisor_preservado() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
BEGIN
  IF NULLIF(trim(NEW.cnpj),'') IS NOT NULL THEN
    INSERT INTO decisores_obra (obra_id, nome, cargo, tipo_cargo, email, telefone, linkedin_url, confianca_match, fonte, registrado_por, registrado_em)
    SELECT NEW.id, p.nome, p.cargo, p.tipo_cargo,
           CASE WHEN p.email IS NOT NULL AND split_part(p.email,'@',1) ~ '[^\x00-\x7F]'
                THEN unaccent(split_part(p.email,'@',1))||'@'||split_part(p.email,'@',2)
                ELSE p.email END,
           p.telefone, p.linkedin_url, p.confianca_match,
           COALESCE(NULLIF(p.fonte,'')||' ','')||'[reuso_preservado]', 'trigger_reuso_decisor', now()
    FROM decisores_preservados p
    WHERE p.cnpj = NEW.cnpj
      AND NULLIF(trim(p.nome),'') IS NOT NULL
      AND (p.email IS NULL OR p.email !~ '@.*\.gov\.br$')
      AND NOT EXISTS (SELECT 1 FROM decisores_obra d WHERE d.obra_id = NEW.id AND lower(trim(d.nome)) = lower(trim(p.nome)));
  END IF;
  RETURN NULL;
END;
$_$;


--
-- Name: immutable_unaccent(text); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.immutable_unaccent(text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $_$
    SELECT public.unaccent('public.unaccent', $1)
$_$;


--
-- Name: immutable_unaccent_lower(text); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.immutable_unaccent_lower(text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $_$
  SELECT lower(public.unaccent($1))
$_$;


--
-- Name: log_obras_changes(); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.log_obras_changes() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF OLD.uf IS DISTINCT FROM NEW.uf THEN
    INSERT INTO obras_atualizacoes_log (obra_id, id_externo, fonte, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, COALESCE(NEW.id_externo, NEW.id::text), NEW.fonte, 'uf', OLD.uf, NEW.uf);
  END IF;
  IF OLD.municipio IS DISTINCT FROM NEW.municipio THEN
    INSERT INTO obras_atualizacoes_log (obra_id, id_externo, fonte, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, COALESCE(NEW.id_externo, NEW.id::text), NEW.fonte, 'municipio', OLD.municipio, NEW.municipio);
  END IF;
  IF OLD.setor IS DISTINCT FROM NEW.setor THEN
    INSERT INTO obras_atualizacoes_log (obra_id, id_externo, fonte, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, COALESCE(NEW.id_externo, NEW.id::text), NEW.fonte, 'setor', OLD.setor, NEW.setor);
  END IF;
  IF OLD.fase IS DISTINCT FROM NEW.fase THEN
    INSERT INTO obras_atualizacoes_log (obra_id, id_externo, fonte, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, COALESCE(NEW.id_externo, NEW.id::text), NEW.fonte, 'fase', OLD.fase, NEW.fase);
  END IF;
  IF OLD.empresa IS DISTINCT FROM NEW.empresa THEN
    INSERT INTO obras_atualizacoes_log (obra_id, id_externo, fonte, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, COALESCE(NEW.id_externo, NEW.id::text), NEW.fonte, 'empresa', OLD.empresa, NEW.empresa);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: mapear_tipo_cargo(text); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.mapear_tipo_cargo(cargo_raw text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
  c TEXT;
BEGIN
  IF cargo_raw IS NULL OR TRIM(cargo_raw)='' THEN RETURN 'OUTRO'; END IF;
  c := lower(unaccent(cargo_raw));
  RETURN CASE
    -- Procurement / Suprimentos / Compras / Supply Chain
    WHEN c ~ '(suprimento|sourcing|aquisicao|procurement|comprador|buyer)' THEN 'GERENTE_SUPRIMENTOS'
    WHEN c ~ '(supply[- ]?chain|cadeia[- ]?suprimentos)' THEN 'SUPPLY_CHAIN'
    WHEN c ~ 'compras?' THEN 'GERENTE_COMPRAS'
    -- Engenharia mecânica/civil/elétrica
    WHEN c ~ '(engenharia[- ]?mecanic|engenharia[- ]?civil|engenheiro[- ]?mecanic|engenheiro[- ]?civil|engenharia[- ]?eletric|mecanic|eletrotec|eletrici)' THEN 'ENGENHEIRO_MECANICO_CIVIL'
    -- Engenharia genérica
    WHEN c ~ '(engenharia|engineering|engenheiro)' THEN 'GERENTE_ENGENHARIA'
    -- Projetos
    WHEN c ~ '(projetista|drafter)' THEN 'PROJETISTA'
    WHEN c ~ '(projetos?|project)' THEN 'GERENTE_PROJETOS'
    -- Operações / Manutenção / Industrial / Obras
    WHEN c ~ '(manutencao|maintenance)' THEN 'COORDENADOR_MANUTENCAO'
    WHEN c ~ '(industrial|fabril|fabrica|planta\W|plant[- ]?manager)' THEN 'GERENTE_INDUSTRIAL'
    WHEN c ~ '(obras|construcao|construction)' THEN 'COORDENADOR_OBRAS'
    WHEN c ~ '(operacoes|operations)' THEN 'GERENTE_INDUSTRIAL'
    ELSE 'OUTRO'
  END;
END;
$$;


--
-- Name: normalize_obras_setor(); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.normalize_obras_setor() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.setor IS NOT NULL AND NEW.setor != '' THEN
    NEW.setor := UPPER(unaccent(REPLACE(TRIM(NEW.setor), ' ', '_')));
    IF NEW.setor = 'PETROLEO_E_GAS' THEN NEW.setor := 'PETROLEO_GAS'; END IF;
    IF NEW.setor = 'LOGISTICA' THEN NEW.setor := 'LOGISTICO'; END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: obra_janela_score(text, date, text, numeric); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.obra_janela_score(p_fase text, p_data_publicacao date, p_status_licenca text, p_valor_estimado numeric) RETURNS integer
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    score INT := 50;
    dias_desde_pub INT;
    is_renovacao BOOLEAN;
BEGIN
    dias_desde_pub := COALESCE(CURRENT_DATE - p_data_publicacao, 180);
    is_renovacao := COALESCE(p_status_licenca ILIKE '%renova%' OR 
                             p_status_licenca ILIKE '%prorrog%', false);

    score := CASE p_fase
        WHEN 'LICENCA_INSTALACAO' THEN
            CASE WHEN dias_desde_pub <= 60  THEN 95
                 WHEN dias_desde_pub <= 180 THEN 80
                 WHEN dias_desde_pub <= 365 THEN 65
                 ELSE 45 END
        WHEN 'LICENCA_PREVIA' THEN
            CASE WHEN dias_desde_pub <= 90  THEN 85
                 WHEN dias_desde_pub <= 365 THEN 65
                 ELSE 50 END
        WHEN 'EM_EXECUCAO' THEN
            CASE WHEN dias_desde_pub <= 30  THEN 80
                 WHEN dias_desde_pub <= 180 THEN 60
                 WHEN dias_desde_pub <= 365 THEN 40
                 ELSE 25 END
        WHEN 'PLANEJAMENTO' THEN
            CASE WHEN dias_desde_pub <= 180 THEN 60
                 WHEN dias_desde_pub <= 365 THEN 50
                 ELSE 35 END
        WHEN 'LICITACAO_ABERTA' THEN 90
        WHEN 'PROJETO'          THEN 55
        ELSE 40
    END;

    IF is_renovacao THEN score := score - 15; END IF;
    IF p_valor_estimado >= 5000000000 THEN score := score + 5; END IF;

    RETURN GREATEST(0, LEAST(100, score));
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: obras; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.obras (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    id_externo text,
    nome text NOT NULL,
    empresa text,
    cnpj text,
    setor text,
    municipio text,
    uf text,
    valor_estimado numeric,
    valor_formatado text,
    fase text,
    status_licenca text,
    urgencia integer DEFAULT 3,
    lead_score integer DEFAULT 50,
    necessidades text[],
    descricao text,
    fonte text,
    url_fonte text,
    data_publicacao date,
    nivel1_nome text,
    nivel1_cargo text,
    nivel1_email text,
    nivel1_linkedin text,
    criado_em timestamp with time zone DEFAULT now(),
    visivel boolean DEFAULT true,
    descricao_sintetica boolean DEFAULT false NOT NULL,
    fonte_tipo text,
    canal_cadastro_url character varying(500),
    familias_fornecimento text,
    fornecedor_principal character varying(255),
    valor_atualizado_em timestamp without time zone,
    fonte_atualizacao text,
    observacoes_validacao text,
    validacao_data date,
    validacao_metodo character varying(50) DEFAULT NULL::character varying,
    cnpj_status character varying(30) DEFAULT 'ok'::character varying,
    notificado_em timestamp with time zone,
    status text,
    data_anuncio date,
    confianca_extracao numeric(3,2),
    nivel1_email_smtp_verified boolean,
    nivel1_email_score integer,
    nivel1_email_status text,
    nivel1_email_verified_at timestamp with time zone,
    nivel1_telefone text,
    nivel1_origem_enrichment text,
    nivel1_enrichment_data timestamp with time zone,
    classificacao_computed text,
    decisor_status text,
    obra_listada_na_fonte boolean,
    obra_dados_mudaram_at timestamp with time zone,
    validacao_obra_at timestamp with time zone,
    validacao_manual_status text,
    obra_fase_fonte text,
    nivel1_telefone_e164 text,
    nivel1_telefone_status text,
    motivo_invisivel text,
    descricao_publica text,
    descricao_publica_gerada_em timestamp with time zone,
    descricao_publica_fonte text,
    score_prospeccao_cached smallint,
    tem_decisor_externo_cached boolean,
    is_ouro_decisor_cached boolean,
    decisor_replicado_fp_cached boolean,
    ultimo_enrichment_status text,
    ultimo_enrichment_at timestamp with time zone,
    ultimo_enrichment_skip_motivo text,
    observacoes_enrichment text,
    empresa_executora text,
    cnpj_executora text,
    dominio_executora text,
    executora_status text,
    executora_fonte text,
    executora_atualizada_em timestamp with time zone,
    capex_fonte text,
    status_portao text,
    status_enriquecimento text,
    fase_real_obra text,
    portao_confianca numeric(5,4),
    portao_motivo text,
    portao_versao text,
    portao_decidido_em timestamp with time zone,
    portao_criterios jsonb,
    portao_evidencias jsonb,
    CONSTRAINT obras_fase_real_obra_ck CHECK (((fase_real_obra IS NULL) OR (fase_real_obra = ANY (ARRAY['PLANEJAMENTO'::text, 'LICENCIAMENTO'::text, 'LICITACAO'::text, 'CONTRATACAO'::text, 'EM_EXECUCAO'::text, 'PARALISADA'::text, 'CONCLUIDA'::text, 'DESCONHECIDA'::text])))),
    CONSTRAINT obras_fonte_tipo_check CHECK (((fonte_tipo IS NULL) OR (fonte_tipo = ANY (ARRAY['OFICIAL'::text, 'NOTICIA'::text, 'MANUAL'::text])))),
    CONSTRAINT obras_status_check CHECK (((status IS NULL) OR (status = ANY (ARRAY['rumor'::text, 'anunciado'::text, 'licenciado'::text, 'em_obra'::text, 'operacional'::text])))),
    CONSTRAINT obras_status_enriquecimento_ck CHECK (((status_enriquecimento IS NULL) OR (status_enriquecimento = ANY (ARRAY['NAO_INICIADO'::text, 'EM_PROCESSAMENTO'::text, 'COMPLETO'::text, 'PARCIAL'::text, 'INSUFICIENTE'::text, 'FALHA'::text])))),
    CONSTRAINT obras_status_portao_ck CHECK (((status_portao IS NULL) OR (status_portao = ANY (ARRAY['EM_ANALISE'::text, 'EM_ANALISE_MANUAL'::text, 'APROVADA'::text, 'REJEITADA'::text, 'ERRO_PORTAO'::text]))))
);


--
-- Name: COLUMN obras.fonte_tipo; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.obras.fonte_tipo IS 'Tipo da fonte: OFICIAL (BNDES/ANM/ANEEL/etc — alta confiabilidade) | NOTICIA (RSS/portal — texto livre, baixa estrutura) | MANUAL (CSV Anderson, web research). Obras NOTICIA são excluídas de is_ouro até validação.';


--
-- Name: COLUMN obras.capex_fonte; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.obras.capex_fonte IS 'Procedencia do valor_estimado. ESTIMATIVA_TIPOLOGIA = placeholder por tipologia (ex.: ibama_sislic), NAO somar como CAPEX confirmado. NULL = valor real/confirmado.';


--
-- Name: obra_score(engenharia.obras); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.obra_score(o engenharia.obras) RETURNS integer
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT
    (CASE WHEN COALESCE(o.cnpj,'')  <> '' THEN 25 ELSE 0 END) +
    (CASE WHEN COALESCE(o.uf,'')    <> '' THEN 15 ELSE 0 END) +
    (CASE WHEN o.valor_estimado IS NOT NULL AND o.valor_estimado > 0 THEN 20 ELSE 0 END) +
    (CASE WHEN COALESCE(o.setor,'') <> '' THEN 10 ELSE 0 END) +
    (CASE WHEN COALESCE(o.fase,'')  <> '' THEN  5 ELSE 0 END) +
    (CASE WHEN COALESCE(o.nome,'')  <> '' THEN  5 ELSE 0 END) +
    (CASE
        WHEN LENGTH(COALESCE(o.descricao,'')) >= 400 THEN 20
        WHEN LENGTH(COALESCE(o.descricao,'')) >= 200 THEN 15
        WHEN LENGTH(COALESCE(o.descricao,'')) >= 100 THEN 10
        WHEN LENGTH(COALESCE(o.descricao,'')) >=   1 THEN  5
        ELSE 0
     END);
$$;


--
-- Name: portao_flag(text, text); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.portao_flag(p_chave text, p_default text DEFAULT 'false'::text) RETURNS text
    LANGUAGE sql STABLE
    AS $$
    SELECT COALESCE(
        (SELECT valor FROM wins_v2.portao_config WHERE chave = p_chave),
        p_default
    );
$$;


--
-- Name: portao_flag_on(text); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.portao_flag_on(p_chave text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
    SELECT lower(wins_v2.portao_flag(p_chave, 'false'))
           IN ('1', 'true', 'yes', 'on', 'sim');
$$;


--
-- Name: recompute_classificacao_full(uuid); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.recompute_classificacao_full(p_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE obras SET classificacao_computed = CASE
    WHEN COALESCE(fonte_tipo,'OFICIAL') = 'NOTICIA' THEN classificacao_computed
    -- OURO live: decisor canônico vale mesmo em fonte asset
    WHEN EXISTS (
      SELECT 1 FROM decisores_obra d
      WHERE d.obra_id=obras.id AND d.excluido_em IS NULL
        AND d.tipo_cargo IS NOT NULL AND d.tipo_cargo <> 'OUTRO'
        AND (NULLIF(d.email,'') IS NOT NULL OR NULLIF(d.linkedin_url,'') IS NOT NULL)
    ) THEN 'OURO'
    -- PRATA: tem nivel1_nome
    WHEN obras.nivel1_nome IS NOT NULL AND obras.nivel1_nome <> '' THEN 'PRATA'
    -- Asset fontes sem OURO/PRATA → NULL (não viram PIPELINE nem BRONZE)
    WHEN fonte IN ('anm_cfem','mapa_sif','abiove_processadoras','unica_usinas') THEN NULL
    -- BRONZE (NOVO 17/05/2026): validada + capex>=50M + OFICIAL/MANUAL + sem nivel1
    WHEN obras.valor_estimado >= 50000000
      AND obras.validacao_obra_at IS NOT NULL
      AND COALESCE(fonte_tipo,'OFICIAL') IN ('OFICIAL','MANUAL')
      AND COALESCE(nivel1_nome,'') = ''
    THEN 'BRONZE'
    -- PIPELINE: pré-operação com capex menor (>=10M, sem validacao)
    WHEN fase IN ('EM_EXECUCAO','PLANEJAMENTO','LICENCA_INSTALACAO','LICENCA_PREVIA','LICITACAO_ABERTA','PROJETO')
      AND valor_estimado IS NOT NULL AND valor_estimado >= 10000000
      AND COALESCE(nivel1_nome,'') = ''
      AND COALESCE(fonte_tipo,'OFICIAL') <> 'NOTICIA'
    THEN 'PIPELINE'
    ELSE NULL
  END
  WHERE id = p_id;
END;
$$;


--
-- Name: recompute_classificacao_obra(uuid); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.recompute_classificacao_obra(p_obra_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_max_score INT;
  v_has_email_max_score BOOLEAN;
  v_valor NUMERIC;
  v_validada BOOLEAN;
  v_fonte_tipo TEXT;
  v_classificacao_atual TEXT;
  v_smtp_verified BOOLEAN;
  v_has_real_decisor BOOLEAN;
  v_nova TEXT;
BEGIN
  SELECT
    o.valor_estimado, (o.validacao_obra_at IS NOT NULL),
    COALESCE(o.fonte_tipo, 'OFICIAL'), o.classificacao_computed,
    COALESCE(o.nivel1_email_smtp_verified, false)
  INTO v_valor, v_validada, v_fonte_tipo, v_classificacao_atual, v_smtp_verified
  FROM obras o WHERE o.id = p_obra_id;

  IF v_fonte_tipo = 'NOTICIA' THEN RETURN; END IF;

  -- v2.1: ignora decisores REPLICADO no MAX
  SELECT COALESCE(MAX(confianca_match), 0)
  INTO v_max_score
  FROM decisores_obra dob
  WHERE dob.obra_id = p_obra_id
    AND dob.excluido_em IS NULL
    AND COALESCE(dob.hipotese_replicacao,'') <> 'REPLICADO_PROVAVEL_FALSO_POSITIVO';

  SELECT EXISTS (
    SELECT 1 FROM decisores_obra dob
    LEFT JOIN obras o2 ON o2.id = dob.obra_id
    WHERE dob.obra_id = p_obra_id AND dob.excluido_em IS NULL
      AND COALESCE(dob.hipotese_replicacao,'') <> 'REPLICADO_PROVAVEL_FALSO_POSITIVO'
      AND dob.confianca_match >= 70
      AND (NULLIF(dob.email,'') IS NOT NULL OR NULLIF(dob.linkedin_url,'') IS NOT NULL OR NULLIF(o2.nivel1_email,'') IS NOT NULL)
  ) INTO v_has_email_max_score;

  -- v2.2 (PRATA condicional): existe ao menos 1 decisor real nao-replicado?
  SELECT EXISTS (
    SELECT 1 FROM decisores_obra dob
    WHERE dob.obra_id = p_obra_id
      AND dob.excluido_em IS NULL
      AND COALESCE(dob.hipotese_replicacao,'') <> 'REPLICADO_PROVAVEL_FALSO_POSITIVO'
  ) INTO v_has_real_decisor;

  v_nova := CASE
    WHEN v_max_score >= 70 AND v_has_email_max_score THEN 'OURO'
    WHEN v_max_score >= 50 THEN 'PRATA'
    -- PRATA condicional: confiança baixa mas email SMTP verificado + decisor real não-replicado.
    -- Threshold 30 (não 0) evita promover lixo de baixíssima confiança.
    WHEN v_max_score >= 30 AND v_smtp_verified AND v_has_real_decisor THEN 'PRATA'
    WHEN v_validada AND v_valor >= 50e6 AND v_fonte_tipo IN ('OFICIAL','MANUAL') THEN 'BRONZE'
    WHEN v_validada AND v_valor >= 10e6 AND v_fonte_tipo IN ('OFICIAL','MANUAL') THEN 'PIPELINE'
    WHEN v_classificacao_atual IN ('OURO','PRATA','BRONZE','PIPELINE') THEN 'PIPELINE'
    ELSE v_classificacao_atual
  END;

  UPDATE obras SET classificacao_computed = v_nova WHERE id = p_obra_id;
END;
$$;


--
-- Name: recompute_classificacao_obra_v1_pre_sprint2(uuid); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.recompute_classificacao_obra_v1_pre_sprint2(p_obra_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE obras SET classificacao_computed = CASE
    -- Preserva NOTICIA (regra original)
    WHEN COALESCE(fonte_tipo,'OFICIAL') = 'NOTICIA' THEN classificacao_computed
    -- OURO: decisor formal com email/linkedin (regra original)
    WHEN EXISTS (
      SELECT 1 FROM decisores_obra d
      WHERE d.obra_id = obras.id AND d.excluido_em IS NULL
        AND d.tipo_cargo IS NOT NULL AND d.tipo_cargo <> 'OUTRO'
        AND (NULLIF(d.email,'') IS NOT NULL OR NULLIF(d.linkedin_url,'') IS NOT NULL)
    ) THEN 'OURO'
    -- PRATA: tem nivel1_nome (regra original)
    WHEN obras.nivel1_nome IS NOT NULL AND obras.nivel1_nome <> '' THEN 'PRATA'
    -- BRONZE: capex >= 50M + validada + OFICIAL/MANUAL (NOVA — 17/05/2026)
    WHEN obras.valor_estimado >= 50e6
      AND obras.validacao_obra_at IS NOT NULL
      AND obras.fonte_tipo IN ('OFICIAL','MANUAL')
    THEN 'BRONZE'
    -- Preserva atual (PIPELINE/NULL/REJEITADO existentes)
    ELSE classificacao_computed
  END
  WHERE id = p_obra_id;
END;
$$;


--
-- Name: recompute_classificacao_obra_v2_pre_v21(uuid); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.recompute_classificacao_obra_v2_pre_v21(p_obra_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_max_score INT;
  v_has_email_max_score BOOLEAN;
  v_valor NUMERIC;
  v_validada BOOLEAN;
  v_fonte_tipo TEXT;
  v_classificacao_atual TEXT;
  v_nova TEXT;
BEGIN
  SELECT
    o.valor_estimado, (o.validacao_obra_at IS NOT NULL),
    COALESCE(o.fonte_tipo, 'OFICIAL'), o.classificacao_computed
  INTO v_valor, v_validada, v_fonte_tipo, v_classificacao_atual
  FROM obras o WHERE o.id = p_obra_id;

  IF v_fonte_tipo = 'NOTICIA' THEN
    RETURN;
  END IF;

  SELECT COALESCE(MAX(confianca_match), 0)
  INTO v_max_score
  FROM decisores_obra dob
  WHERE dob.obra_id = p_obra_id AND dob.excluido_em IS NULL;

  SELECT EXISTS (
    SELECT 1 FROM decisores_obra dob
    LEFT JOIN obras o2 ON o2.id = dob.obra_id
    WHERE dob.obra_id = p_obra_id AND dob.excluido_em IS NULL
      AND dob.confianca_match >= 70
      AND (NULLIF(dob.email,'') IS NOT NULL OR NULLIF(dob.linkedin_url,'') IS NOT NULL OR NULLIF(o2.nivel1_email,'') IS NOT NULL)
  ) INTO v_has_email_max_score;

  v_nova := CASE
    WHEN v_max_score >= 70 AND v_has_email_max_score THEN 'OURO'
    WHEN v_max_score >= 50 THEN 'PRATA'
    WHEN v_validada AND v_valor >= 50e6 AND v_fonte_tipo IN ('OFICIAL','MANUAL') THEN 'BRONZE'
    WHEN v_validada AND v_valor >= 10e6 AND v_fonte_tipo IN ('OFICIAL','MANUAL') THEN 'PIPELINE'
    -- Downgrade OURO/PRATA/BRONZE/PIPELINE antigos que não qualificam → PIPELINE (mantém visíveis)
    WHEN v_classificacao_atual IN ('OURO','PRATA','BRONZE','PIPELINE') THEN 'PIPELINE'
    -- Preserva REJEITADO, LICITACAO_ABERTA, NULL
    ELSE v_classificacao_atual
  END;

  UPDATE obras SET classificacao_computed = v_nova WHERE id = p_obra_id;
END;
$$;


--
-- Name: FUNCTION recompute_classificacao_obra_v2_pre_v21(p_obra_id uuid); Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON FUNCTION engenharia.recompute_classificacao_obra_v2_pre_v21(p_obra_id uuid) IS 'Trigger v2 (Sprint 2 20260520): OURO ≥70 + email, PRATA ≥50, BRONZE capex ≥50M validado, PIPELINE capex ≥10M validado. Preserva NOTICIA e tiers não-mapeados.';


--
-- Name: regenerar_matches_v2_para_prestador(uuid, numeric); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.regenerar_matches_v2_para_prestador(p_prestador_id uuid, p_threshold numeric DEFAULT 30) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_inseridos INTEGER := 0;
  v_cnpj TEXT;
BEGIN
  -- Pega CNPJs vinculados ao prestador
  FOR v_cnpj IN SELECT cnpj FROM prestador_empresas WHERE prestador_id = p_prestador_id AND ativo LOOP
    -- Remove matches antigos desse cnpj
    DELETE FROM matches_v2 WHERE cnpj = v_cnpj;
    -- Calcula novos
    WITH novos AS (
      SELECT o.id AS obra_id, v_cnpj AS cnpj, scc.score, scc.breakdown
      FROM obras o
      CROSS JOIN LATERAL (SELECT * FROM calcular_score_match_v2(o.id, v_cnpj)) scc
      WHERE o.classificacao_computed IN ('OURO','PRATA','BRONZE','PIPELINE')
        AND (o.visivel IS NULL OR o.visivel = true)
        AND COALESCE(o.fonte_tipo,'OFICIAL') != 'NOTICIA'
        AND scc.score IS NOT NULL
        AND scc.score >= p_threshold
    )
    INSERT INTO matches_v2 (obra_id, cnpj, score, score_breakdown)
    SELECT obra_id, cnpj, score, breakdown FROM novos
    ON CONFLICT (obra_id, cnpj) DO UPDATE SET
      score = EXCLUDED.score,
      score_breakdown = EXCLUDED.score_breakdown,
      gerado_em = NOW();
    GET DIAGNOSTICS v_inseridos = ROW_COUNT;
  END LOOP;
  RETURN v_inseridos;
END;
$$;


--
-- Name: registrar_captura(text, text, jsonb, text, text, text); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.registrar_captura(p_captador_nome text, p_fonte_nome text, p_payload jsonb, p_id_externo text DEFAULT NULL::text, p_url_origem text DEFAULT NULL::text, p_versao_captador text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'wins_v2', 'pg_temp'
    AS $$
DECLARE
    v_captador_id INT;
    v_fonte_id    INT;
    v_hash        TEXT;
    v_captura_id  UUID;
BEGIN
    SELECT id INTO v_captador_id FROM captadores WHERE nome = p_captador_nome;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Captador nao encontrado: %', p_captador_nome;
    END IF;

    SELECT id INTO v_fonte_id FROM fontes WHERE nome = p_fonte_nome;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Fonte nao encontrada: %', p_fonte_nome;
    END IF;

    v_hash := encode(sha256(p_payload::text::bytea), 'hex');

    INSERT INTO capturas_brutas (captador_id, fonte_id, payload, id_externo, url_origem, hash_conteudo, versao_captador)
    VALUES (v_captador_id, v_fonte_id, p_payload, p_id_externo, p_url_origem, v_hash, p_versao_captador)
    ON CONFLICT (captador_id, hash_conteudo) DO UPDATE
        SET processado_em = now(),
            status = 'bruto'
    RETURNING id INTO v_captura_id;

    RETURN v_captura_id;
END;
$$;


--
-- Name: sanitizar_decisor(); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.sanitizar_decisor() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.cargo ILIKE '%anderson%' OR NEW.cargo ILIKE '%contato %' THEN
        NEW.cargo := '';
    END IF;

    -- Regra anderson cirurgica (patch 01062026): so renomeia se fonte indicar legacy CSV
    -- Preserva 889 placeholders historicos; libera Anderson Schaefer e futuros Anderson reais
    IF NEW.nome NOT ILIKE 'Contato Comercial%' AND
       (
         (NEW.nome ILIKE '%anderson%'
          AND (COALESCE(NEW.fonte,'') ILIKE '%anderson_csv%'
               OR COALESCE(NEW.registrado_por,'') = 'anderson_geral'))
         OR NEW.nome = NEW.cargo
         OR NEW.nome ILIKE '%contato %'
       ) THEN
        NEW.nome := 'Contato Comercial ' ||
                    SUBSTRING(MD5(random()::text || clock_timestamp()::text) FROM 1 FOR 6);
    END IF;

    IF NEW.nome IS NULL OR TRIM(NEW.nome) = '' THEN
        NEW.nome := 'Contato Comercial ' ||
                    SUBSTRING(MD5(random()::text || clock_timestamp()::text) FROM 1 FOR 6);
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: FUNCTION sanitizar_decisor(); Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON FUNCTION engenharia.sanitizar_decisor() IS 'Patched 01062026: regra anderson agora cirurgica (so ativa se fonte=anderson_csv ou registrado_por=anderson_geral). Versao anterior renomeava qualquer nome contendo "anderson" -> Contato Comercial XXX, bloqueando Anderson Schaefer CEO Carolina Soil.';


--
-- Name: semanticamente_compativel(text, text, text); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.semanticamente_compativel(p_campo_canonico_id text, p_valor_a text, p_valor_b text) RETURNS boolean
    LANGUAGE plpgsql STABLE
    SET search_path TO 'wins_v2', 'pg_temp'
    AS $_$
BEGIN
    IF (p_valor_a = 'valor_financiado' AND p_valor_b = 'valor_contratado') OR
       (p_valor_a = 'valor_contratado' AND p_valor_b = 'valor_financiado') THEN
        RETURN TRUE;
    END IF;

    IF (p_valor_a = 'CAPEX' AND p_valor_b = 'estimativa') OR
       (p_valor_a = 'estimativa' AND p_valor_b = 'CAPEX') THEN
        RETURN TRUE;
    END IF;

    IF (p_valor_a = 'CONTRATANTE' AND p_valor_b = 'EXECUTORA') OR
       (p_valor_a = 'EXECUTORA' AND p_valor_b = 'CONTRATANTE') THEN
        RETURN TRUE;
    END IF;

    IF p_valor_a ~ '^\d{2}/\d{2}/\d{4}$' AND p_valor_b ~ '^\d{2}/\d{4}$' THEN
        RETURN TRUE;
    END IF;
    IF p_valor_a ~ '^\d{2}/\d{4}$' AND p_valor_b ~ '^\d{2}/\d{2}/\d{4}$' THEN
        RETURN TRUE;
    END IF;
    IF p_valor_a ~ '^\d{4}-\d{2}-\d{2}$' AND p_valor_b ~ '^\d{2}/\d{2}/\d{4}$' THEN
        RETURN TRUE;
    END IF;
    IF p_valor_a ~ '^\d{2}/\d{2}/\d{4}$' AND p_valor_b ~ '^\d{4}-\d{2}-\d{2}$' THEN
        RETURN TRUE;
    END IF;
    IF p_valor_a ~ '^\d{4}-\d{2}-\d{2}$' AND p_valor_b ~ '^\d{2}/\d{4}$' THEN
        RETURN TRUE;
    END IF;
    IF p_valor_a ~ '^\d{2}/\d{4}$' AND p_valor_b ~ '^\d{4}-\d{2}-\d{2}$' THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$_$;


--
-- Name: trg_audita_plano_sem_pagamento(); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.trg_audita_plano_sem_pagamento() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF COALESCE(NEW.plano, 'GRATUITO') <> 'GRATUITO'
       AND NEW.plano IS DISTINCT FROM OLD.plano
       AND NOT EXISTS (
           SELECT 1 FROM pagamentos p
           WHERE p.prestador_id = NEW.id
             AND p.tipo = 'plano'
             AND p.status_local = 'aprovado'
       )
    THEN
        INSERT INTO plano_alteracoes_suspeitas (prestador_id, plano_antigo, plano_novo, contexto)
        VALUES (NEW.id, OLD.plano, NEW.plano, TG_OP || ' em prestadores.plano sem pagamento aprovado');
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: trg_empresa_decisores_cache_atualizado_em(); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.trg_empresa_decisores_cache_atualizado_em() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: trg_obras_pipeline_inbox(); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.trg_obras_pipeline_inbox() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'wins_v2', 'public'
    AS $$
BEGIN
    -- Nao processa aqui: apenas enfileira metadados minimos da V1.
    INSERT INTO wins_v2.pipeline_inbox (v1_obra_id, fonte, id_externo, payload_minimo, status)
    VALUES (
        NEW.id,
        NEW.fonte,
        NEW.id_externo,
        jsonb_build_object(
            'id', NEW.id,
            'id_externo', NEW.id_externo,
            'fonte', NEW.fonte,
            'nome', NEW.nome,
            'empresa', NEW.empresa,
            'cnpj', NEW.cnpj,
            'municipio', NEW.municipio,
            'uf', NEW.uf,
            'setor', NEW.setor,
            'valor_estimado', NEW.valor_estimado,
            'fase', NEW.fase,
            'url_fonte', NEW.url_fonte,
            'descricao', NEW.descricao,
            'data_anuncio', NEW.data_anuncio,
            'criado_em', NEW.criado_em
        ),
        'pendente'
    );
    RETURN NEW;
END;
$$;


--
-- Name: trg_preservar_decisor(); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.trg_preservar_decisor() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE v_cnpj text; v_empresa text; v_obra_nome text;
BEGIN
  IF COALESCE(NEW.confianca_match,0) >= 50 AND NEW.excluido_em IS NULL AND NULLIF(trim(NEW.nome),'') IS NOT NULL THEN
    SELECT o.cnpj, o.empresa, left(o.nome,200) INTO v_cnpj, v_empresa, v_obra_nome FROM obras o WHERE o.id = NEW.obra_id;
    INSERT INTO decisores_preservados (cnpj, empresa, nome, cargo, tipo_cargo, email, telefone, linkedin_url, confianca_match, fonte, origem_obra_id, origem_obra_nome)
    VALUES (NULLIF(v_cnpj,''), NULLIF(v_empresa,''), NEW.nome, NEW.cargo, NEW.tipo_cargo, NULLIF(NEW.email,''), NULLIF(NEW.telefone,''), NULLIF(NEW.linkedin_url,''), NEW.confianca_match, NEW.fonte, NEW.obra_id, v_obra_nome)
    ON CONFLICT (COALESCE(cnpj,''), lower(trim(nome))) DO UPDATE SET
      email        = COALESCE(decisores_preservados.email, EXCLUDED.email),
      telefone     = COALESCE(decisores_preservados.telefone, EXCLUDED.telefone),
      linkedin_url = COALESCE(decisores_preservados.linkedin_url, EXCLUDED.linkedin_url),
      cargo        = COALESCE(decisores_preservados.cargo, EXCLUDED.cargo),
      confianca_match = GREATEST(COALESCE(decisores_preservados.confianca_match,0), EXCLUDED.confianca_match),
      atualizado_em = now();
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: trg_sync_classificacao(); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.trg_sync_classificacao() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM recompute_classificacao_obra(COALESCE(NEW.obra_id, OLD.obra_id));
  RETURN NULL;
END;
$$;


--
-- Name: update_decisores_cache_atualizado_em(); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.update_decisores_cache_atualizado_em() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_empresa_dominios_atualizado_em(); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.update_empresa_dominios_atualizado_em() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: upsert_entidade(text, text, text); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.upsert_entidade(p_cnpj text, p_nome text, p_tipo text DEFAULT 'JURIDICA'::text) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'wins_v2', 'pg_temp'
    AS $$
DECLARE v_id UUID;
BEGIN
    INSERT INTO entidades (cnpj, nome, tipo_pessoa)
    VALUES (p_cnpj, p_nome, p_tipo)
    ON CONFLICT (cnpj) DO UPDATE SET nome = EXCLUDED.nome
    RETURNING id INTO v_id;
    RETURN v_id;
END $$;


--
-- Name: upsert_entidade_lookup_minimo(text, text, text, text, text, text, text, text); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.upsert_entidade_lookup_minimo(p_cnpj text, p_razao_social text DEFAULT NULL::text, p_nome_fantasia text DEFAULT NULL::text, p_natureza text DEFAULT NULL::text, p_municipio text DEFAULT NULL::text, p_uf text DEFAULT NULL::text, p_fonte text DEFAULT NULL::text, p_captador text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'wins_v2', 'public'
    AS $_$
DECLARE
    v_cnpj text := regexp_replace(COALESCE(p_cnpj, ''), '\D', '', 'g');
    v_id   uuid;
    v_uf   text;
BEGIN
    IF v_cnpj IS NULL OR length(v_cnpj) <> 14 THEN
        RETURN NULL;
    END IF;
    IF NOT wins_v2.cnpj_dv_valido(v_cnpj) THEN
        RETURN NULL;
    END IF;

    v_uf := NULLIF(upper(btrim(COALESCE(p_uf, ''))), '');
    IF v_uf IS NOT NULL AND v_uf !~ '^[A-Z]{2}$' THEN
        v_uf := NULL;
    END IF;

    INSERT INTO wins_v2.entidades_lookup (
        entidade_id,
        cnpj_normalizado,
        razao_social,
        nome_fantasia,
        natureza_entidade,
        municipio,
        uf,
        fontes,
        captadores,
        quantidade_ocorrencias,
        completude,
        confianca,
        necessita_enriquecimento_externo,
        importado_em
    ) VALUES (
        gen_random_uuid(),
        v_cnpj,
        NULLIF(btrim(COALESCE(p_razao_social, '')), ''),
        NULLIF(btrim(COALESCE(p_nome_fantasia, '')), ''),
        NULLIF(btrim(COALESCE(p_natureza, '')), ''),
        NULLIF(btrim(COALESCE(p_municipio, '')), ''),
        v_uf,
        NULLIF(btrim(COALESCE(p_fonte, '')), ''),
        NULLIF(btrim(COALESCE(p_captador, '')), ''),
        1,
        'pipeline',
        '0.80',
        'SIM',
        now()
    )
    ON CONFLICT (cnpj_normalizado) DO UPDATE SET
        razao_social = COALESCE(NULLIF(btrim(EXCLUDED.razao_social), ''), wins_v2.entidades_lookup.razao_social),
        nome_fantasia = COALESCE(NULLIF(btrim(EXCLUDED.nome_fantasia), ''), wins_v2.entidades_lookup.nome_fantasia),
        natureza_entidade = COALESCE(NULLIF(btrim(EXCLUDED.natureza_entidade), ''), wins_v2.entidades_lookup.natureza_entidade),
        municipio = COALESCE(NULLIF(btrim(EXCLUDED.municipio), ''), wins_v2.entidades_lookup.municipio),
        uf = COALESCE(EXCLUDED.uf, wins_v2.entidades_lookup.uf),
        fontes = CASE
            WHEN wins_v2.entidades_lookup.fontes IS NULL OR wins_v2.entidades_lookup.fontes = '' THEN EXCLUDED.fontes
            WHEN EXCLUDED.fontes IS NULL OR position(EXCLUDED.fontes in wins_v2.entidades_lookup.fontes) > 0
                THEN wins_v2.entidades_lookup.fontes
            ELSE wins_v2.entidades_lookup.fontes || '|' || EXCLUDED.fontes
        END,
        captadores = CASE
            WHEN wins_v2.entidades_lookup.captadores IS NULL OR wins_v2.entidades_lookup.captadores = '' THEN EXCLUDED.captadores
            WHEN EXCLUDED.captadores IS NULL OR position(EXCLUDED.captadores in wins_v2.entidades_lookup.captadores) > 0
                THEN wins_v2.entidades_lookup.captadores
            ELSE wins_v2.entidades_lookup.captadores || '|' || EXCLUDED.captadores
        END,
        quantidade_ocorrencias = COALESCE(wins_v2.entidades_lookup.quantidade_ocorrencias, 0) + 1,
        importado_em = now()
    RETURNING entidade_id INTO v_id;

    RETURN v_id;
END;
$_$;


--
-- Name: zerar_cnpj_invalido(); Type: FUNCTION; Schema: engenharia; Owner: -
--

CREATE FUNCTION engenharia.zerar_cnpj_invalido() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.cnpj IS NOT NULL AND NEW.cnpj <> ''
     AND NOT cnpj_valido(NEW.cnpj) THEN
    NEW.cnpj := NULL;
    NEW.observacoes_validacao := COALESCE(NEW.observacoes_validacao,'')
      || ' | cnpj_invalido_zerado_trigger';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: _stg_historico_empresa; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia._stg_historico_empresa (
    batch_id text,
    cliente_chave text,
    cliente text,
    cpf_cnpj_mascarado text,
    cnpj_fragmento_digitos text,
    nome_normalizado text,
    quantidade_operacoes bigint,
    valor_total_operacoes double precision,
    valor_total_desembolsado double precision,
    primeira_operacao date,
    ultima_operacao date,
    quantidade_municipios bigint,
    ufs text,
    setores_bndes text,
    subsetores_bndes text,
    portes_registrados text,
    instituicoes_financeiras text,
    situacoes text,
    operacoes_ativas bigint,
    operacoes_desde_2025 bigint
);


--
-- Name: acessos_log; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.acessos_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    prestador_id uuid,
    email text,
    ip text,
    user_agent text,
    sucesso boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_audit_log; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.admin_audit_log (
    id bigint NOT NULL,
    ts timestamp with time zone DEFAULT now(),
    method text NOT NULL,
    path text NOT NULL,
    query text,
    ip text,
    user_agent text,
    body_summary text,
    status_code smallint,
    duration_ms integer
);


--
-- Name: admin_audit_log_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.admin_audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admin_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.admin_audit_log_id_seq OWNED BY engenharia.admin_audit_log.id;


--
-- Name: alertas_enviados; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.alertas_enviados (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prestador_id uuid NOT NULL,
    canal character varying(20) NOT NULL,
    obras_ids uuid[] NOT NULL,
    obras_count integer NOT NULL,
    enviado_em timestamp with time zone DEFAULT now(),
    CONSTRAINT alertas_enviados_canal_check CHECK (((canal)::text = ANY (ARRAY[('email'::character varying)::text, ('inapp'::character varying)::text])))
);


--
-- Name: alertas_preferencias; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.alertas_preferencias (
    prestador_id uuid NOT NULL,
    ativo boolean DEFAULT true,
    frequencia character varying(20) DEFAULT 'semanal'::character varying,
    score_minimo integer DEFAULT 50,
    atualizado_em timestamp with time zone DEFAULT now(),
    CONSTRAINT alertas_preferencias_frequencia_check CHECK (((frequencia)::text = ANY (ARRAY[('semanal'::character varying)::text, ('quinzenal'::character varying)::text, ('nunca'::character varying)::text])))
);


--
-- Name: audit_updates; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.audit_updates (
    id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    actor text,
    operation text,
    criteria text,
    rows_affected integer,
    csv_path text,
    details jsonb
);


--
-- Name: audit_updates_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.audit_updates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_updates_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.audit_updates_id_seq OWNED BY engenharia.audit_updates.id;


--
-- Name: auditoria_consolidacao; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.auditoria_consolidacao (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    grupo_id uuid NOT NULL,
    campo_canonico_id text,
    acao text NOT NULL,
    detalhes jsonb,
    versao_regra text,
    executado_por text,
    criado_em timestamp with time zone DEFAULT now(),
    CONSTRAINT auditoria_consolidacao_acao_check CHECK ((acao = ANY (ARRAY['inicio_consolidacao'::text, 'captura_adicionada'::text, 'captura_removida'::text, 'correspondencia_avaliada'::text, 'correspondencia_confirmada'::text, 'conflito_detectado'::text, 'conflito_resolvido'::text, 'valor_mestre_selecionado'::text, 'valor_mestre_atualizado'::text, 'complementacao_realizada'::text, 'consolidacao_finalizada'::text, 'revisao_humana_solicitada'::text, 'rollback_executado'::text])))
);


--
-- Name: TABLE auditoria_consolidacao; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.auditoria_consolidacao IS 'Auditoria completa do processo de consolidacao';


--
-- Name: auditoria_portao; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.auditoria_portao (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    grupo_id uuid,
    candidato_projeto_id uuid,
    decisao text NOT NULL,
    motivo text,
    versao_regras text,
    evidencias jsonb,
    scores jsonb,
    criado_em timestamp with time zone DEFAULT now(),
    CONSTRAINT auditoria_portao_decisao_check CHECK ((decisao = ANY (ARRAY['ACEITAR'::text, 'REJEITAR'::text, 'INCONCLUSIVO'::text, 'REVISAO_CAPEX'::text])))
);


--
-- Name: TABLE auditoria_portao; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.auditoria_portao IS 'Livro imutavel de decisoes do portao';


--
-- Name: COLUMN auditoria_portao.scores; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.auditoria_portao.scores IS 'Scores calculados (lead_score, urgencia, confianca)';


--
-- Name: auto_match_buscas; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.auto_match_buscas (
    id bigint NOT NULL,
    prestador_id uuid,
    cnpj_prestador character varying(14),
    criterios_input jsonb,
    resultados_output jsonb,
    custo_centavos integer DEFAULT 1000 NOT NULL,
    debitado_em timestamp with time zone DEFAULT now(),
    ip_origem inet,
    user_agent text
);


--
-- Name: auto_match_buscas_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.auto_match_buscas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auto_match_buscas_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.auto_match_buscas_id_seq OWNED BY engenharia.auto_match_buscas.id;


--
-- Name: brasilapi_cache; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.brasilapi_cache (
    cnpj text NOT NULL,
    razao_social text,
    nome_fantasia text,
    cnae_principal text,
    uf text,
    municipio text,
    porte text,
    capital_social numeric,
    data_consulta timestamp with time zone DEFAULT now(),
    fonte_api text
);


--
-- Name: bronze_enrich_audit; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.bronze_enrich_audit (
    id bigint NOT NULL,
    obra_id uuid NOT NULL,
    classificacao_anterior text,
    classificacao_nova text,
    campos_enriquecidos jsonb,
    valores_anteriores jsonb,
    valores_novos jsonb,
    fontes jsonb,
    confianca numeric,
    regra_aplicada text,
    motivo_promocao text,
    agente text DEFAULT 'bronze_enrich_v1'::text,
    lote text,
    criado_em timestamp with time zone DEFAULT now()
);


--
-- Name: bronze_enrich_audit_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.bronze_enrich_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bronze_enrich_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.bronze_enrich_audit_id_seq OWNED BY engenharia.bronze_enrich_audit.id;


--
-- Name: bronze_enrich_rollback; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.bronze_enrich_rollback (
    obra_id uuid NOT NULL,
    classificacao_computed text,
    empresa text,
    cnpj text,
    nivel1_nome text,
    nivel1_cargo text,
    nivel1_email text,
    nivel1_telefone text,
    nivel1_linkedin text,
    nivel1_email_status text,
    nivel1_telefone_status text,
    nivel1_origem_enrichment text,
    status_enriquecimento text,
    snapshot_em timestamp with time zone DEFAULT now()
);


--
-- Name: bronze_enrich_snapshot; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.bronze_enrich_snapshot (
    obra_id uuid NOT NULL,
    classificacao_computed text,
    empresa text,
    cnpj text,
    empresa_executora text,
    cnpj_executora text,
    nivel1_nome text,
    nivel1_cargo text,
    nivel1_email text,
    nivel1_telefone text,
    nivel1_linkedin text,
    nivel1_email_status text,
    nivel1_telefone_status text,
    status_enriquecimento text,
    visivel boolean,
    capturado_em timestamp with time zone DEFAULT now()
);


--
-- Name: cache_brasilapi; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.cache_brasilapi (
    cnpj text NOT NULL,
    payload jsonb NOT NULL,
    consultado_em timestamp with time zone DEFAULT now(),
    expira_em timestamp with time zone DEFAULT (now() + '30 days'::interval)
);


--
-- Name: campos_canonicos; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.campos_canonicos (
    id text NOT NULL,
    nome text NOT NULL,
    nome_amigavel text,
    categoria text NOT NULL,
    descricao text,
    dominio text,
    tipo_dado text,
    formato text,
    sensibilidade text DEFAULT 'publico'::text,
    regra_normalizacao text,
    regra_validacao text,
    fontes_preferenciais text[],
    fontes_fallback text[],
    politica_conflito text,
    ativo boolean DEFAULT true,
    versao text DEFAULT '1.0'::text NOT NULL,
    criado_em timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE campos_canonicos; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.campos_canonicos IS '57 campos canonicos do modelo V2';


--
-- Name: COLUMN campos_canonicos.sensibilidade; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.campos_canonicos.sensibilidade IS 'publico, interno, sensivel, restrito (CPF mascarado em visoes publicas)';


--
-- Name: COLUMN campos_canonicos.politica_conflito; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.campos_canonicos.politica_conflito IS 'regra de resolucao de conflito para este campo';


--
-- Name: canais_cadastro_empresa; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.canais_cadastro_empresa (
    id integer NOT NULL,
    empresa_nome character varying(255) NOT NULL,
    empresa_cnpj character varying(14),
    canal_url character varying(500) NOT NULL,
    nome_canal character varying(100),
    familias_disponiveis text,
    requer_pre_qualificacao boolean DEFAULT false,
    requer_crc boolean DEFAULT false,
    aceita_estrangeiros boolean DEFAULT true,
    ativo boolean DEFAULT true,
    criado_em timestamp without time zone DEFAULT now(),
    atualizado_em timestamp without time zone DEFAULT now(),
    notas text
);


--
-- Name: canais_cadastro_empresa_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.canais_cadastro_empresa_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: canais_cadastro_empresa_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.canais_cadastro_empresa_id_seq OWNED BY engenharia.canais_cadastro_empresa.id;


--
-- Name: candidatos_industrial; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.candidatos_industrial (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text,
    snippet text,
    url text,
    link_hash text,
    empresa_extraida text,
    setor_inferido text,
    setor_alvo text,
    capex_mencionado_mi numeric,
    uf_inferida character varying(2),
    query_origem text,
    status character varying(20) DEFAULT 'novo'::character varying,
    motivo_rejeicao text,
    obra_id uuid,
    criado_em timestamp without time zone DEFAULT now(),
    flags text
);


--
-- Name: candidatos_projeto; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.candidatos_projeto (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    descricao text,
    fonte_primaria_id integer,
    status text DEFAULT 'candidato'::text,
    visivel boolean DEFAULT false,
    metadados jsonb,
    criado_em timestamp with time zone DEFAULT now(),
    atualizado_em timestamp with time zone DEFAULT now(),
    CONSTRAINT candidatos_projeto_status_check CHECK ((status = ANY (ARRAY['candidato'::text, 'em_analise'::text, 'correspondendo'::text, 'consolidando'::text, 'promovido'::text, 'arquivado'::text, 'inconclusivo'::text])))
);


--
-- Name: TABLE candidatos_projeto; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.candidatos_projeto IS 'Projetos candidatos. Nao sao obra validada ate passarem pelo portao.';


--
-- Name: COLUMN candidatos_projeto.visivel; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.candidatos_projeto.visivel IS 'Nunca true por padrao';


--
-- Name: captadores; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.captadores (
    id integer NOT NULL,
    nome text NOT NULL,
    fonte_id integer,
    script_path text,
    versao text DEFAULT '0.0.0'::text NOT NULL,
    hash_script text,
    ativo boolean DEFAULT true,
    criado_em timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE captadores; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.captadores IS 'Registro de scripts captadores';


--
-- Name: COLUMN captadores.versao; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.captadores.versao IS 'Versao do script (obrigatorio)';


--
-- Name: COLUMN captadores.hash_script; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.captadores.hash_script IS 'SHA256 do script para auditoria';


--
-- Name: captadores_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.captadores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: captadores_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.captadores_id_seq OWNED BY engenharia.captadores.id;


--
-- Name: captura_entidades; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.captura_entidades (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    captura_bruta_id uuid NOT NULL,
    entidade_id uuid NOT NULL,
    papel text NOT NULL,
    campo_origem text,
    confianca numeric(3,2) DEFAULT 1.00,
    evidencia jsonb,
    ativo boolean DEFAULT true,
    criado_em timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE captura_entidades; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.captura_entidades IS 'Vinculo captura x entidade com papel';


--
-- Name: COLUMN captura_entidades.papel; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.captura_entidades.papel IS 'CONTRATANTE, EXECUTORA, CONTRATADA, BENEFICIARIA, PROPRIETARIA, REQUERENTE, CONCESSIONARIA, FORNECEDORA, UNIDADE_GESTORA, ORGAO_RESPONSAVEL, DESCONHECIDO';


--
-- Name: capturas_brutas; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.capturas_brutas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    captador_id integer NOT NULL,
    fonte_id integer NOT NULL,
    payload jsonb NOT NULL,
    id_externo text,
    url_origem text,
    hash_conteudo text,
    capturado_em timestamp with time zone DEFAULT now() NOT NULL,
    processado_em timestamp with time zone,
    versao_captador text,
    status text DEFAULT 'bruto'::text,
    erro text,
    metadados jsonb,
    namespace text DEFAULT 'default'::text NOT NULL,
    origem_marcador text DEFAULT 'CAPTURA_NOVA'::text NOT NULL,
    v1_obra_id uuid,
    campos_canonicos jsonb,
    versao integer DEFAULT 1 NOT NULL,
    CONSTRAINT capturas_brutas_origem_marcador_ck CHECK ((origem_marcador = ANY (ARRAY['HISTORICO_IMPORTADO'::text, 'CAPTURA_NOVA'::text, 'REPROCESSAMENTO'::text]))),
    CONSTRAINT capturas_brutas_status_check CHECK ((status = ANY (ARRAY['bruto'::text, 'normalizando'::text, 'normalizado'::text, 'erro'::text])))
);


--
-- Name: TABLE capturas_brutas; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.capturas_brutas IS 'Dado bruto original da fonte. NUNCA e obra.';


--
-- Name: COLUMN capturas_brutas.payload; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.capturas_brutas.payload IS 'JSON original completo. NUNCA modificado apos insercao.';


--
-- Name: COLUMN capturas_brutas.hash_conteudo; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.capturas_brutas.hash_conteudo IS 'SHA256 do payload para dedup';


--
-- Name: COLUMN capturas_brutas.metadados; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.capturas_brutas.metadados IS 'Metadados da captura (headers HTTP, tamanho, etc)';


--
-- Name: capturas_versoes; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.capturas_versoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    captura_bruta_id uuid NOT NULL,
    payload_anterior jsonb,
    payload_novo jsonb,
    hash_anterior text,
    hash_novo text,
    motivo text,
    capturado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE capturas_versoes; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.capturas_versoes IS 'Historico de versoes — toda alteracao no payload original gera nova versao';


--
-- Name: categorias_servico; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.categorias_servico (
    id integer NOT NULL,
    codigo text NOT NULL,
    nome text NOT NULL,
    descricao text,
    cnaes text[] NOT NULL,
    icone text,
    ordem integer DEFAULT 100,
    essencial boolean DEFAULT true,
    ativo boolean DEFAULT true,
    criado_em timestamp with time zone DEFAULT now()
);


--
-- Name: categorias_servico_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.categorias_servico_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categorias_servico_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.categorias_servico_id_seq OWNED BY engenharia.categorias_servico.id;


--
-- Name: cnae_oficial; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.cnae_oficial (
    codigo character varying(7) NOT NULL,
    descricao text NOT NULL
);


--
-- Name: cnaes_interesse; Type: MATERIALIZED VIEW; Schema: engenharia; Owner: -
--

CREATE MATERIALIZED VIEW engenharia.cnaes_interesse AS
 SELECT DISTINCT unnest(cnaes) AS cnae
   FROM engenharia.categorias_servico
  WHERE (ativo = true)
  WITH NO DATA;


--
-- Name: MATERIALIZED VIEW cnaes_interesse; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON MATERIALIZED VIEW engenharia.cnaes_interesse IS 'Lista deduplicada de CNAEs cobertos pelas categorias_servico ativas. Usada pra filtrar a importacao da Receita Federal. Atualizar com REFRESH MATERIALIZED VIEW quando categorias mudarem.';


--
-- Name: cnpj_grupo; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.cnpj_grupo (
    cnpj text NOT NULL,
    grupo_id uuid NOT NULL,
    papel text NOT NULL,
    participacao_pct numeric(5,2),
    nome_fantasia text,
    fonte_cadastro text,
    observacoes text,
    criado_em timestamp with time zone DEFAULT now(),
    CONSTRAINT cnpj_grupo_papel_check CHECK ((papel = ANY (ARRAY['CONSORCIO_LIDER'::text, 'CONSORCIO_MEMBRO'::text, 'HOLDING_PAI'::text, 'GRUPO_OPERACIONAL'::text, 'AMBOS'::text])))
);


--
-- Name: comissoes; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.comissoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    representante_id uuid,
    lead_outbound_id uuid,
    prestador_id uuid,
    tipo character varying(20),
    valor_base_centavos integer,
    pct_aplicado integer,
    valor_comissao_centavos integer,
    referente_a date,
    pago boolean DEFAULT false,
    pago_em timestamp with time zone,
    criado_em timestamp with time zone DEFAULT now(),
    status character varying(20) DEFAULT 'pendente'::character varying,
    disponivel_em timestamp with time zone,
    pago_via character varying(50),
    recorrencia_mes integer,
    observacoes text
);


--
-- Name: conflitos; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.conflitos (
    id bigint NOT NULL,
    batch_id text NOT NULL,
    cliente_chave text,
    tipo text NOT NULL,
    detalhe jsonb NOT NULL,
    status text DEFAULT 'ABERTO'::text NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conflitos_status_check CHECK ((status = ANY (ARRAY['ABERTO'::text, 'RESOLVIDO'::text, 'DESCARTADO'::text])))
);


--
-- Name: conflitos_campos; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.conflitos_campos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    grupo_id uuid NOT NULL,
    campo_canonico_id text NOT NULL,
    valor_a text,
    valor_b text,
    fonte_a_id integer,
    fonte_b_id integer,
    captura_a_id uuid,
    captura_b_id uuid,
    tipo_conflito text NOT NULL,
    estado text DEFAULT 'ABERTO'::text,
    justificativa text,
    resolvido_em timestamp with time zone,
    resolvido_por text,
    criado_em timestamp with time zone DEFAULT now(),
    CONSTRAINT conflitos_campos_estado_check CHECK ((estado = ANY (ARRAY['ABERTO'::text, 'RESOLVIDO_POR_REGRA'::text, 'RESOLVIDO_MANUALMENTE'::text, 'MANTER_MULTIPLOS'::text, 'DESCARTADO_COM_JUSTIFICATIVA'::text]))),
    CONSTRAINT conflitos_campos_tipo_conflito_check CHECK ((tipo_conflito = ANY (ARRAY['entidade'::text, 'papel'::text, 'localizacao'::text, 'fase'::text, 'valor'::text, 'data'::text, 'identificador'::text, 'ativo'::text, 'descricao_tecnica'::text])))
);


--
-- Name: TABLE conflitos_campos; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.conflitos_campos IS 'Conflitos entre fontes. Nenhum conflito resolvido silenciosamente.';


--
-- Name: COLUMN conflitos_campos.tipo_conflito; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.conflitos_campos.tipo_conflito IS 'entidade, papel, localizacao, fase, valor, data, identificador, ativo, descricao_tecnica';


--
-- Name: COLUMN conflitos_campos.estado; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.conflitos_campos.estado IS 'ABERTO, RESOLVIDO_POR_REGRA, RESOLVIDO_MANUALMENTE, MANTER_MULTIPLOS, DESCARTADO_COM_JUSTIFICATIVA';


--
-- Name: conflitos_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.conflitos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: conflitos_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.conflitos_id_seq OWNED BY engenharia.conflitos.id;


--
-- Name: contatos_alternativos; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.contatos_alternativos (
    id integer NOT NULL,
    cnpj text,
    empresa_dominio text,
    email text,
    nome text,
    cargo text,
    departamento text,
    linkedin_url text,
    hunter_score integer,
    hunter_status text,
    origem text DEFAULT 'E3_domain_search'::text,
    descoberto_em timestamp with time zone DEFAULT now()
);


--
-- Name: contatos_alternativos_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.contatos_alternativos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contatos_alternativos_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.contatos_alternativos_id_seq OWNED BY engenharia.contatos_alternativos.id;


--
-- Name: contatos_log; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.contatos_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    cnpj_destino text NOT NULL,
    obra_id uuid,
    canal text NOT NULL,
    assunto text,
    corpo_preview text,
    enviado_em timestamp with time zone DEFAULT now(),
    enviado_por text,
    resposta_em timestamp with time zone,
    resposta_tipo text,
    observacoes text,
    prestador_id uuid,
    confirmado_pelo_decisor boolean DEFAULT false,
    status_obra_reportado character varying(50),
    tipo_contato character varying(30) DEFAULT 'ligacao'::character varying,
    confirmado_em timestamp with time zone,
    proximo_followup_em timestamp with time zone,
    followup_count integer DEFAULT 0,
    notas text
);


--
-- Name: TABLE contatos_log; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.contatos_log IS 'Log de outreach manual feito pelo time WiNS. Fundamental pra compliance LGPD e pra não contatar a mesma empresa 2x no mesmo mês.';


--
-- Name: correspondencias_capturas; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.correspondencias_capturas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    captura_a_id uuid NOT NULL,
    captura_b_id uuid NOT NULL,
    nivel text NOT NULL,
    regra_aplicada text NOT NULL,
    score numeric(5,2) NOT NULL,
    evidencias jsonb NOT NULL,
    decisao text DEFAULT 'pendente'::text,
    versao_regra text DEFAULT '1.0'::text NOT NULL,
    revisao_humana boolean DEFAULT false,
    revisado_em timestamp with time zone,
    revisado_por text,
    criado_em timestamp with time zone DEFAULT now(),
    CONSTRAINT correspondencias_capturas_check CHECK ((captura_a_id <> captura_b_id)),
    CONSTRAINT correspondencias_capturas_decisao_check CHECK ((decisao = ANY (ARRAY['pendente'::text, 'confirmada'::text, 'rejeitada'::text, 'revisao_humana'::text]))),
    CONSTRAINT correspondencias_capturas_nivel_check CHECK ((nivel = ANY (ARRAY['ALTA'::text, 'MEDIA'::text, 'BAIXA'::text]))),
    CONSTRAINT correspondencias_capturas_score_check CHECK (((score >= (0)::numeric) AND (score <= (100)::numeric)))
);


--
-- Name: TABLE correspondencias_capturas; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.correspondencias_capturas IS 'Correspondencia entre capturas';


--
-- Name: COLUMN correspondencias_capturas.nivel; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.correspondencias_capturas.nivel IS 'ALTA, MEDIA, BAIXA';


--
-- Name: COLUMN correspondencias_capturas.regra_aplicada; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.correspondencias_capturas.regra_aplicada IS 'Regra de correspondencia aplicada (id, processo, contrato, etc)';


--
-- Name: COLUMN correspondencias_capturas.score; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.correspondencias_capturas.score IS 'Score de confianca 0-100. BAIXAS (<50) nunca consolidam automaticamente.';


--
-- Name: COLUMN correspondencias_capturas.decisao; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.correspondencias_capturas.decisao IS 'pendente, confirmada, rejeitada, revisao_humana';


--
-- Name: COLUMN correspondencias_capturas.versao_regra; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.correspondencias_capturas.versao_regra IS 'Versao da regra usada';


--
-- Name: decisor_jobs; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.decisor_jobs (
    job_id uuid NOT NULL,
    user_id uuid NOT NULL,
    obra_id uuid,
    cnpj text,
    etapa text DEFAULT 'iniciado'::text NOT NULL,
    progresso integer DEFAULT 5 NOT NULL,
    mensagem text DEFAULT 'Iniciando...'::text NOT NULL,
    decisores_count integer DEFAULT 0 NOT NULL,
    decisores jsonb,
    erro text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: decisores; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.decisores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entidade_id uuid,
    nome_completo text NOT NULL,
    cargo text,
    email text,
    telefone text,
    linkedin_url text,
    confianca integer DEFAULT 50,
    status text DEFAULT 'suspeito'::text,
    evidencia jsonb,
    ultima_validacao_em timestamp with time zone,
    criado_em timestamp with time zone DEFAULT now(),
    CONSTRAINT decisores_confianca_check CHECK (((confianca >= 0) AND (confianca <= 100))),
    CONSTRAINT decisores_status_check CHECK ((status = ANY (ARRAY['suspeito'::text, 'provavel'::text, 'confirmado'::text, 'desatualizado'::text, 'duplicado'::text, 'sem_empresa'::text])))
);


--
-- Name: TABLE decisores; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.decisores IS 'Tomadores de decisao. Pertencem a entidade, nao a obra.';


--
-- Name: decisores_cache; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.decisores_cache (
    id integer NOT NULL,
    cnpj character varying(14) NOT NULL,
    empresa_nome character varying(255),
    socios jsonb,
    razao_social character varying(255),
    nome_fantasia character varying(255),
    status_cnpj character varying(50),
    cnpj_atualizado_em timestamp without time zone,
    cnpj_erro text,
    dominio character varying(255),
    emails jsonb,
    hunter_atualizado_em timestamp without time zone,
    hunter_creditos_usados integer DEFAULT 0,
    hunter_erro text,
    expira_em timestamp without time zone DEFAULT (now() + '1 year'::interval) NOT NULL,
    forcado_refresh boolean DEFAULT false,
    criado_em timestamp without time zone DEFAULT now(),
    atualizado_em timestamp without time zone DEFAULT now(),
    dominio_status character varying(30) DEFAULT 'ok'::character varying
);


--
-- Name: decisores_cache_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.decisores_cache_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: decisores_cache_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.decisores_cache_id_seq OWNED BY engenharia.decisores_cache.id;


--
-- Name: decisores_empresa_alvo; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.decisores_empresa_alvo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_nome character varying(200) NOT NULL,
    setor character varying(100),
    nivel1_nome character varying(200),
    nivel1_cargo character varying(200),
    nivel1_linkedin character varying(300),
    nivel1_fonte character varying(100) DEFAULT 'site_linkedin_serper'::character varying,
    nivel1_email character varying(200),
    nivel1_email_smtp_verified boolean DEFAULT false,
    validado_manualmente boolean DEFAULT false,
    criado_em timestamp without time zone DEFAULT now(),
    atualizado_em timestamp without time zone DEFAULT now()
);


--
-- Name: decisores_obra; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.decisores_obra (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    obra_id uuid NOT NULL,
    nome text NOT NULL,
    cargo text NOT NULL,
    linkedin_url text,
    email text,
    telefone text,
    fonte text NOT NULL,
    registrado_em timestamp with time zone DEFAULT now(),
    registrado_por text,
    excluido_em timestamp with time zone,
    observacoes text,
    tipo_cargo text,
    confianca_match integer,
    confianca_match_componentes jsonb,
    confianca_match_calculada_em timestamp with time zone,
    hipotese_replicacao text,
    confianca_match_v1 integer,
    telefone_fonte text,
    whatsapp_enviado timestamp with time zone,
    whatsapp_respondeu timestamp with time zone,
    whatsapp_status text,
    email_status text,
    email_verify_result text,
    email_verificado_em timestamp with time zone,
    email_smtp_status text,
    email_smtp_em timestamp with time zone,
    qualidade_lead text GENERATED ALWAYS AS (
CASE
    WHEN ((email_status = 'valid'::text) OR (COALESCE(linkedin_url, ''::text) <> ''::text) OR (COALESCE(telefone, ''::text) <> ''::text)) THEN 'verde'::text
    WHEN (((email_status = 'invalid'::text) OR (COALESCE(email, ''::text) = ''::text)) AND (COALESCE(linkedin_url, ''::text) = ''::text) AND (COALESCE(telefone, ''::text) = ''::text)) THEN 'vermelho'::text
    ELSE 'amarelo'::text
END) STORED,
    CONSTRAINT decisores_tipo_cargo_check CHECK (((tipo_cargo IS NULL) OR (tipo_cargo = ANY (ARRAY['GERENTE_SUPRIMENTOS'::text, 'GERENTE_COMPRAS'::text, 'SUPPLY_CHAIN'::text, 'ENGENHEIRO_MECANICO_CIVIL'::text, 'GERENTE_ENGENHARIA'::text, 'PROJETISTA'::text, 'COORDENADOR_MANUTENCAO'::text, 'GERENTE_INDUSTRIAL'::text, 'COORDENADOR_OBRAS'::text, 'GERENTE_PROJETOS'::text, 'OUTRO'::text]))))
);


--
-- Name: TABLE decisores_obra; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.decisores_obra IS 'Decisores encontrados MANUALMENTE via busca pública. Nunca coleta automatizada.';


--
-- Name: COLUMN decisores_obra.confianca_match; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.decisores_obra.confianca_match IS 'Score 0-100; Sprint Auditoria 20260520';


--
-- Name: COLUMN decisores_obra.confianca_match_componentes; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.decisores_obra.confianca_match_componentes IS 'JSONB breakdown adaptado';


--
-- Name: COLUMN decisores_obra.hipotese_replicacao; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.decisores_obra.hipotese_replicacao IS 'OK | GRUPO_LEGITIMO_OU_SPE | SUSPEITO_INVESTIGAR | BAIXA_CONFIANCA_REVISAR | REPLICADO_PROVAVEL_FALSO_POSITIVO';


--
-- Name: decisores_preservados; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.decisores_preservados (
    id bigint NOT NULL,
    cnpj text,
    empresa text,
    nome text NOT NULL,
    cargo text,
    tipo_cargo text,
    email text,
    telefone text,
    linkedin_url text,
    confianca_match numeric,
    fonte text,
    origem_obra_id uuid,
    origem_obra_nome text,
    preservado_em timestamp with time zone DEFAULT now(),
    atualizado_em timestamp with time zone DEFAULT now()
);


--
-- Name: decisores_preservados_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.decisores_preservados_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: decisores_preservados_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.decisores_preservados_id_seq OWNED BY engenharia.decisores_preservados.id;


--
-- Name: desbloqueios; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.desbloqueios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prestador_id uuid,
    obra_id uuid,
    cnpj_empresa text NOT NULL,
    faixa_valor text NOT NULL,
    valor_cobrado integer NOT NULL,
    mp_payment_id text,
    pitch_gerado text,
    criado_em timestamp with time zone DEFAULT now()
);


--
-- Name: desbloqueios_plano; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.desbloqueios_plano (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prestador_id uuid,
    mes_ref text NOT NULL,
    usados integer DEFAULT 0,
    limite integer NOT NULL
);


--
-- Name: documentos; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.documentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    captura_bruta_id uuid,
    tipo_documento text,
    url_documento text,
    hash_documento text,
    metadados jsonb,
    baixado_em timestamp with time zone DEFAULT now(),
    criado_em timestamp with time zone DEFAULT now(),
    CONSTRAINT documentos_tipo_documento_check CHECK ((tipo_documento = ANY (ARRAY['edital'::text, 'contrato'::text, 'licenca'::text, 'ato_publicacao'::text, 'outros'::text])))
);


--
-- Name: TABLE documentos; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.documentos IS 'Documentos comprobatorios baixados';


--
-- Name: email_validacao_cache; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.email_validacao_cache (
    email text NOT NULL,
    status character varying(30) NOT NULL,
    sintaxe_ok boolean DEFAULT false NOT NULL,
    mx_record text,
    smtp_response_code integer,
    smtp_response_msg text,
    catch_all boolean DEFAULT false NOT NULL,
    fonte_validacao character varying(40) NOT NULL,
    confianca character varying(10) NOT NULL,
    validated_at timestamp with time zone DEFAULT now() NOT NULL,
    proxima_revalidacao date DEFAULT (CURRENT_DATE + '30 days'::interval),
    CONSTRAINT email_validacao_cache_confianca_check CHECK (((confianca)::text = ANY (ARRAY[('alta'::character varying)::text, ('media'::character varying)::text, ('baixa'::character varying)::text]))),
    CONSTRAINT email_validacao_cache_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('inferred_pattern'::character varying)::text, ('verified_mx'::character varying)::text, ('verified_smtp'::character varying)::text, ('invalid'::character varying)::text, ('bounce'::character varying)::text, ('catch_all'::character varying)::text, ('greylisted'::character varying)::text])))
);


--
-- Name: TABLE email_validacao_cache; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.email_validacao_cache IS 'Camada 4 STACK PROPRIO. Cache de validacoes SMTP/Hunter por email. TTL curto (30 dias) porque emails podem virar invalidos. status alinhado com check de empresa_decisores_cache.email_status (8 valores).';


--
-- Name: email_validation_cache; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.email_validation_cache (
    email text NOT NULL,
    status text NOT NULL,
    ferramenta text,
    detalhes jsonb,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: empresa_decisores_cache; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.empresa_decisores_cache (
    id integer NOT NULL,
    cnpj character varying(14) NOT NULL,
    nome_pessoa text NOT NULL,
    cargo_raw text NOT NULL,
    cargo_normalizado text,
    cargo_idioma character varying(5),
    cargo_nivel character varying(20),
    tipo_cargo text,
    confianca character varying(10) NOT NULL,
    fonte_descoberta character varying(30) NOT NULL,
    fonte_secundaria character varying(30),
    snippet_origem text,
    url_origem text,
    linkedin_slug text,
    email text,
    email_status character varying(30),
    score_relevancia numeric(3,2) DEFAULT 0.0,
    descoberto_em timestamp with time zone DEFAULT now(),
    atualizado_em timestamp with time zone DEFAULT now(),
    revalidacao date DEFAULT (CURRENT_DATE + '180 days'::interval),
    ultimo_contato timestamp with time zone,
    excluido_em timestamp with time zone,
    trabalha_atualmente boolean,
    filtro_llm_em timestamp with time zone,
    filtro_llm_confianca character varying(10),
    CONSTRAINT empresa_decisores_cache_cargo_idioma_check CHECK ((((cargo_idioma)::text = ANY (ARRAY[('pt-br'::character varying)::text, ('en'::character varying)::text])) OR (cargo_idioma IS NULL))),
    CONSTRAINT empresa_decisores_cache_cargo_nivel_check CHECK ((((cargo_nivel)::text = ANY (ARRAY[('estrategico'::character varying)::text, ('tatico'::character varying)::text, ('operacional'::character varying)::text])) OR (cargo_nivel IS NULL))),
    CONSTRAINT empresa_decisores_cache_confianca_check CHECK (((confianca)::text = ANY (ARRAY[('alta'::character varying)::text, ('media'::character varying)::text, ('baixa'::character varying)::text]))),
    CONSTRAINT empresa_decisores_cache_email_status_check CHECK ((((email_status)::text = ANY (ARRAY[('pending'::character varying)::text, ('inferred_pattern'::character varying)::text, ('verified_mx'::character varying)::text, ('verified_smtp'::character varying)::text, ('invalid'::character varying)::text, ('bounce'::character varying)::text])) OR (email_status IS NULL))),
    CONSTRAINT empresa_decisores_cache_filtro_llm_confianca_check CHECK ((((filtro_llm_confianca)::text = ANY (ARRAY[('alta'::character varying)::text, ('media'::character varying)::text, ('baixa'::character varying)::text])) OR (filtro_llm_confianca IS NULL))),
    CONSTRAINT empresa_decisores_cache_score_relevancia_check CHECK (((score_relevancia >= 0.0) AND (score_relevancia <= 1.0))),
    CONSTRAINT empresa_decisores_cache_tipo_cargo_check CHECK ((tipo_cargo = ANY (ARRAY['GERENTE_SUPRIMENTOS'::text, 'GERENTE_COMPRAS'::text, 'SUPPLY_CHAIN'::text, 'GERENTE_PROJETOS'::text, 'GERENTE_ENGENHARIA'::text, 'GERENTE_INDUSTRIAL'::text, 'COORDENADOR_OBRAS'::text, 'COORDENADOR_MANUTENCAO'::text, 'ENGENHEIRO_MECANICO_CIVIL'::text, 'PROJETISTA'::text, 'OUTRO'::text])))
);


--
-- Name: TABLE empresa_decisores_cache; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.empresa_decisores_cache IS 'Camada 3 STACK PRÓPRIO. 1 CNPJ = N decisores. Busca ampla (48 termos PT+EN), storage canônico (11 valores tipo_cargo). Substitui Hunter pra descoberta. Cache 180 dias. Decisor médio fica 18-24 meses no mesmo cargo.';


--
-- Name: empresa_decisores_cache_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.empresa_decisores_cache_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: empresa_decisores_cache_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.empresa_decisores_cache_id_seq OWNED BY engenharia.empresa_decisores_cache.id;


--
-- Name: empresa_dominios; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.empresa_dominios (
    cnpj character varying(14) NOT NULL,
    empresa_nome character varying(255) NOT NULL,
    dominio character varying(255),
    holding_cnpj character varying(14),
    holding_nome character varying(255),
    holding_dominio character varying(255),
    fonte character varying(50) DEFAULT 'manual'::character varying,
    confianca smallint,
    observacoes text,
    criado_em timestamp without time zone DEFAULT now(),
    atualizado_em timestamp without time zone DEFAULT now(),
    dominio_status character varying(30) DEFAULT 'ok'::character varying,
    dominios_alternativos text[],
    decisor_tipo character varying(50) DEFAULT 'privado'::character varying,
    validacao_metodo character varying(100) DEFAULT NULL::character varying,
    validacao_data date,
    holding_mae character varying(255) DEFAULT NULL::character varying,
    CONSTRAINT empresa_dominios_confianca_check CHECK (((confianca >= 1) AND (confianca <= 5)))
);


--
-- Name: empresa_dominios_backup_20260508; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.empresa_dominios_backup_20260508 (
    cnpj character varying(14),
    empresa_nome character varying(255),
    dominio character varying(255),
    holding_cnpj character varying(14),
    holding_nome character varying(255),
    holding_dominio character varying(255),
    fonte character varying(50),
    confianca smallint,
    observacoes text,
    criado_em timestamp without time zone,
    atualizado_em timestamp without time zone,
    dominio_status character varying(30)
);


--
-- Name: empresa_dossier_cache; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.empresa_dossier_cache (
    cnpj character varying(14) NOT NULL,
    payload jsonb NOT NULL,
    coletado_em timestamp with time zone DEFAULT now() NOT NULL,
    proxima_revalidacao date
);


--
-- Name: TABLE empresa_dossier_cache; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.empresa_dossier_cache IS 'Cache do dossier completo da empresa (Camada 1 sales_intelligence). Payload contem EmpresaDossier serializado. Default 30 dias de validade.';


--
-- Name: empresa_email_pattern_cache; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.empresa_email_pattern_cache (
    dominio text NOT NULL,
    padrao text NOT NULL,
    confianca character varying(10) NOT NULL,
    exemplos jsonb NOT NULL,
    amostra_total integer NOT NULL,
    detectado_em timestamp with time zone DEFAULT now() NOT NULL,
    proxima_revalidacao date,
    pessoas_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT empresa_email_pattern_cache_confianca_check CHECK (((confianca)::text = ANY (ARRAY[('alta'::character varying)::text, ('media'::character varying)::text, ('baixa'::character varying)::text])))
);


--
-- Name: TABLE empresa_email_pattern_cache; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.empresa_email_pattern_cache IS 'Cache do padrao de email por dominio (Camada 2 sales_intelligence). Validade padrao 180 dias - padroes corporativos mudam menos que cadastrais.';


--
-- Name: empresa_intel; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.empresa_intel (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    cnpj text NOT NULL,
    empresa text,
    dominio text NOT NULL,
    subdominios text[] DEFAULT ARRAY[]::text[],
    tags text[] DEFAULT ARRAY[]::text[],
    fonte text NOT NULL,
    coletado_em timestamp with time zone DEFAULT now(),
    erro text
);


--
-- Name: TABLE empresa_intel; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.empresa_intel IS 'Inteligência comercial coletada por empresa (subdomínios → tags acionáveis pro pitch). Atualizado pelo orchestrator semanal.';


--
-- Name: empresas_clientes; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.empresas_clientes (
    cnpj text NOT NULL,
    razao_social text,
    nome_fantasia text,
    cnae_principal text,
    cnae_descricao text,
    logradouro text,
    numero text,
    complemento text,
    bairro text,
    cep text,
    municipio_nome text,
    uf text,
    telefone_1 text,
    telefone_2 text,
    email text,
    situacao text,
    porte text,
    capital_social numeric,
    data_abertura date,
    natureza_juridica text,
    qsa jsonb,
    fonte text DEFAULT 'receita_federal'::text,
    importado_em timestamp with time zone DEFAULT now(),
    atualizado_em timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE empresas_clientes; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.empresas_clientes IS 'Dados enriquecidos dos DONOS DE OBRA (clientes). Separado de empresas_receita pra não interferir com matchmaking.';


--
-- Name: enrichment_gap_audit; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.enrichment_gap_audit (
    id bigint NOT NULL,
    obra_id uuid NOT NULL,
    fase text,
    acao text,
    campo text,
    valor_antes text,
    valor_depois text,
    fonte text,
    confianca numeric,
    evidencia text,
    tier_antes text,
    tier_depois text,
    resultado text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: enrichment_gap_audit_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.enrichment_gap_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: enrichment_gap_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.enrichment_gap_audit_id_seq OWNED BY engenharia.enrichment_gap_audit.id;


--
-- Name: enrichment_gap_matrix; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.enrichment_gap_matrix (
    obra_id uuid NOT NULL,
    tier_atual text,
    empresa_presente boolean DEFAULT false,
    papel_empresa_confirmado boolean DEFAULT false,
    cnpj_valido boolean DEFAULT false,
    dominio_confirmado boolean DEFAULT false,
    capex_valido boolean DEFAULT false,
    decisor_presente boolean DEFAULT false,
    cargo_presente boolean DEFAULT false,
    cargo_compativel boolean DEFAULT false,
    linkedin_presente boolean DEFAULT false,
    linkedin_confirmado boolean DEFAULT false,
    email_presente boolean DEFAULT false,
    email_nominal boolean DEFAULT false,
    email_corporativo boolean DEFAULT false,
    email_validado boolean DEFAULT false,
    telefone_presente boolean DEFAULT false,
    campos_faltantes text[],
    proxima_acao text,
    prioridade integer DEFAULT 100,
    fontes_internas_candidatas text[],
    precisa_externo boolean DEFAULT false,
    completeness_score numeric(5,2) DEFAULT 0,
    ultima_tentativa timestamp with time zone,
    num_tentativas integer DEFAULT 0,
    resultado_ultima text,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: enrichment_gap_snapshot; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.enrichment_gap_snapshot (
    obra_id uuid NOT NULL,
    tier text,
    empresa text,
    cnpj text,
    dominio text,
    capex numeric,
    decisor text,
    cargo text,
    linkedin text,
    email text,
    email_status text,
    telefone text,
    snapshot_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: enrichment_lookup_log; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.enrichment_lookup_log (
    id integer NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now(),
    cnpj_normalizado character varying(14),
    contexto text,
    origem_da_solicitacao text,
    status_lookup character varying(50),
    campos_solicitados text,
    campos_encontrados text,
    campos_ausentes text,
    provedor_externo character varying(100),
    chamada_externa_executada boolean DEFAULT false,
    chamada_externa_evitada boolean DEFAULT false,
    motivo text,
    custo_estimado_evitado numeric(10,4) DEFAULT 0.0,
    tempo_lookup_ms numeric(10,2) DEFAULT 0.0,
    erro text,
    request_id uuid DEFAULT gen_random_uuid() NOT NULL,
    CONSTRAINT enrichment_lookup_log_cnpj_formato_ck CHECK (((cnpj_normalizado IS NULL) OR ((cnpj_normalizado)::text ~ '^[0-9]{14}$'::text))),
    CONSTRAINT enrichment_lookup_log_external_flags_ck CHECK ((NOT (chamada_externa_executada AND chamada_externa_evitada))),
    CONSTRAINT enrichment_lookup_log_status_ck CHECK (((status_lookup)::text = ANY (ARRAY[('FULL_HIT'::character varying)::text, ('PARTIAL_HIT'::character varying)::text, ('MISS'::character varying)::text, ('INVALID'::character varying)::text, ('SEM_CNPJ'::character varying)::text, ('CPF_NAO_APLICAVEL'::character varying)::text]))),
    CONSTRAINT enrichment_lookup_log_tempo_ck CHECK ((tempo_lookup_ms >= (0)::numeric)),
    CONSTRAINT enrichment_lookup_log_terminal_external_ck CHECK ((((status_lookup)::text <> ALL (ARRAY[('INVALID'::character varying)::text, ('SEM_CNPJ'::character varying)::text, ('CPF_NAO_APLICAVEL'::character varying)::text])) OR ((NOT chamada_externa_executada) AND (NOT chamada_externa_evitada))))
);


--
-- Name: COLUMN enrichment_lookup_log.request_id; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.enrichment_lookup_log.request_id IS 'UUID obrigatorio que correlaciona decisao inicial e eventos de provedores.';


--
-- Name: enrichment_lookup_log_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.enrichment_lookup_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: enrichment_lookup_log_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.enrichment_lookup_log_id_seq OWNED BY engenharia.enrichment_lookup_log.id;


--
-- Name: enrichment_queue; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.enrichment_queue (
    id integer NOT NULL,
    obra_id uuid NOT NULL,
    capex numeric DEFAULT 0,
    status character varying(20) DEFAULT 'pending'::character varying,
    tentativas integer DEFAULT 0,
    max_tentativas integer DEFAULT 3,
    erro_msg text,
    criado_em timestamp with time zone DEFAULT now(),
    processado_em timestamp with time zone,
    CONSTRAINT enrichment_queue_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('running'::character varying)::text, ('done'::character varying)::text, ('error'::character varying)::text, ('skip'::character varying)::text])))
);


--
-- Name: TABLE enrichment_queue; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.enrichment_queue IS 'Fila evento-driven de enriquecimento. Populada por trg_enqueue_enrichment AFTER INSERT em obras. Drenada por /app/scripts/drain_queue.py via cron */5min.';


--
-- Name: enrichment_queue_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.enrichment_queue_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: enrichment_queue_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.enrichment_queue_id_seq OWNED BY engenharia.enrichment_queue.id;


--
-- Name: enriquecimento_log; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.enriquecimento_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    obra_id uuid NOT NULL,
    decisor_id uuid,
    decisor_nome text,
    campo text NOT NULL,
    valor_anterior text,
    valor_novo text,
    fonte text NOT NULL,
    criado_em timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE enriquecimento_log; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.enriquecimento_log IS 'Auditoria de enriquecimento automatizado de decisores (LinkedIn/email). Cada UPDATE em obras.nivel1_* ou decisores_obra via /api/admin/decisores/enriquecer registra 1 linha por campo alterado.';


--
-- Name: entidade_decisores; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.entidade_decisores (
    entidade_id uuid NOT NULL,
    decisor_id uuid NOT NULL,
    papel text,
    vinculo_evidencia text,
    criado_em timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE entidade_decisores; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.entidade_decisores IS 'Vinculo N:N entre entidades e decisores';


--
-- Name: entidades; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.entidades (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cnpj character varying(14),
    cpf character varying(11),
    nome text NOT NULL,
    nome_original text,
    tipo_pessoa text,
    cnae_principal text,
    porte text,
    natureza_juridica text,
    uf_sede character varying(2),
    municipio_sede text,
    dominio_oficial text,
    ativo boolean DEFAULT true,
    criado_em timestamp with time zone DEFAULT now(),
    CONSTRAINT entidades_check CHECK (((cnpj IS NOT NULL) OR (cpf IS NOT NULL))),
    CONSTRAINT entidades_tipo_pessoa_check CHECK ((tipo_pessoa = ANY (ARRAY['FISICA'::text, 'JURIDICA'::text, 'NAO_INFORMADO'::text])))
);


--
-- Name: TABLE entidades; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.entidades IS 'Entidades independentes (empresas, orgaos, pessoas)';


--
-- Name: COLUMN entidades.cnpj; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.entidades.cnpj IS 'CNPJ normalizado 14 digitos. Texto.';


--
-- Name: COLUMN entidades.cpf; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.entidades.cpf IS 'CPF normalizado 11 digitos. Mascarado em visoes publicas.';


--
-- Name: entidades_lookup; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.entidades_lookup (
    entidade_id uuid NOT NULL,
    cnpj_normalizado character varying(14) NOT NULL,
    razao_social text,
    nome_fantasia text,
    natureza_entidade text,
    situacao text,
    endereco text,
    municipio text,
    uf character varying(2),
    completude character varying(50),
    confianca character varying(50),
    fontes text,
    captadores text,
    primeira_observacao timestamp with time zone,
    ultima_observacao timestamp with time zone,
    campos_ausentes text,
    importado_em timestamp with time zone DEFAULT now(),
    versao_base character varying(100),
    hash_origem character varying(64),
    quantidade_ocorrencias integer,
    necessita_enriquecimento_externo text,
    CONSTRAINT entidades_lookup_cnpj_dv_ck CHECK (engenharia.cnpj_dv_valido((cnpj_normalizado)::text)),
    CONSTRAINT entidades_lookup_enriquecimento_ck CHECK (((necessita_enriquecimento_externo IS NULL) OR (upper(btrim(necessita_enriquecimento_externo)) = ANY (ARRAY['SIM'::text, 'NAO'::text])))),
    CONSTRAINT entidades_lookup_hash_origem_ck CHECK (((hash_origem IS NULL) OR ((hash_origem)::text ~ '^[0-9a-f]{64}$'::text))),
    CONSTRAINT entidades_lookup_quantidade_ck CHECK (((quantidade_ocorrencias IS NULL) OR (quantidade_ocorrencias >= 0))),
    CONSTRAINT entidades_lookup_uf_ck CHECK (((uf IS NULL) OR ((uf)::text ~ '^[A-Z]{2}$'::text)))
);


--
-- Name: TABLE entidades_lookup; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.entidades_lookup IS 'Cadastro Mestre interno, uma entidade por CNPJ valido normalizado.';


--
-- Name: COLUMN entidades_lookup.versao_base; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.entidades_lookup.versao_base IS 'SHA-256 do conteudo canonico das 18 colunas da linha importada.';


--
-- Name: COLUMN entidades_lookup.hash_origem; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.entidades_lookup.hash_origem IS 'SHA-256 da Planilha Mestre oficial validada antes da importacao.';


--
-- Name: eventos_pipeline; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.eventos_pipeline (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo_evento text NOT NULL,
    entidade_id uuid,
    captura_bruta_id uuid,
    grupo_id uuid,
    obra_id uuid,
    payload jsonb,
    status text DEFAULT 'pendente'::text,
    erro text,
    criado_em timestamp with time zone DEFAULT now(),
    processado_em timestamp with time zone
);


--
-- Name: TABLE eventos_pipeline; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.eventos_pipeline IS 'Eventos do pipeline de processamento';


--
-- Name: evidencias; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.evidencias (
    id bigint NOT NULL,
    batch_id text NOT NULL,
    match_id bigint,
    obra_id uuid,
    entidade_id uuid,
    cnpj_conhecido text,
    cliente_bndes text,
    campo text NOT NULL,
    valor text,
    fonte text DEFAULT 'HISTORICO_EMPRESA_BNDES'::text NOT NULL,
    arquivo text,
    chave_agregada text,
    data_ref date,
    confianca numeric(5,4),
    metodo text,
    evidencia_hash text NOT NULL,
    metadados jsonb DEFAULT '{}'::jsonb NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: evidencias_campos; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.evidencias_campos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    captura_bruta_id uuid NOT NULL,
    campo_canonico_id text NOT NULL,
    valor_extraido text,
    caminho_origem text NOT NULL,
    transformacao text,
    tipo_origem text,
    confianca numeric(3,2) DEFAULT 1.00,
    fonte_id integer,
    metadados jsonb,
    criado_em timestamp with time zone DEFAULT now(),
    CONSTRAINT evidencias_campos_tipo_origem_check CHECK ((tipo_origem = ANY (ARRAY['nativo'::text, 'inferido'::text, 'enriquecido'::text, 'artificial'::text])))
);


--
-- Name: TABLE evidencias_campos; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.evidencias_campos IS 'Trilha de evidencias por campo — nenhuma origem perdida';


--
-- Name: evidencias_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.evidencias_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: evidencias_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.evidencias_id_seq OWNED BY engenharia.evidencias.id;


--
-- Name: fila_prospeccao; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.fila_prospeccao (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fornecedor_cnpj text NOT NULL,
    obra_id uuid,
    setor text,
    score_match numeric,
    cnpj_ativo boolean,
    razao_social text,
    site_url text,
    site_ativo boolean,
    linkedin_url text,
    email_generico text,
    status_digital character varying(20),
    enriquecido_em timestamp with time zone,
    rep_atribuido text,
    atribuido_em timestamp with time zone,
    lote integer,
    status character varying(20) DEFAULT 'PENDENTE'::character varying,
    contatado_em timestamp with time zone,
    resultado character varying(30),
    observacoes text,
    criado_em timestamp with time zone DEFAULT now(),
    CONSTRAINT fila_status_check CHECK (((status)::text = ANY (ARRAY[('PENDENTE'::character varying)::text, ('EM_CONTATO'::character varying)::text, ('RESPONDEU'::character varying)::text, ('NAO_ATENDE'::character varying)::text, ('INVALIDO'::character varying)::text, ('CONVERTIDO'::character varying)::text, ('PULADO'::character varying)::text]))),
    CONSTRAINT fila_status_digital_check CHECK (((status_digital IS NULL) OR ((status_digital)::text = ANY (ARRAY[('ATIVO'::character varying)::text, ('SEM_SITE'::character varying)::text, ('SEM_LINKEDIN'::character varying)::text, ('INVALIDO'::character varying)::text, ('INATIVO'::character varying)::text, ('PENDENTE'::character varying)::text]))))
);


--
-- Name: fontes; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.fontes (
    id integer NOT NULL,
    nome text NOT NULL,
    nome_curto text,
    tipo text,
    categoria text,
    url_base text,
    documentacao text,
    frequencia text,
    ativo boolean DEFAULT true,
    criado_em timestamp with time zone DEFAULT now(),
    CONSTRAINT fontes_categoria_check CHECK ((categoria = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'D'::text, 'E'::text]))),
    CONSTRAINT fontes_tipo_check CHECK ((tipo = ANY (ARRAY['API'::text, 'CSV'::text, 'PDF'::text, 'RSS'::text, 'Manual'::text, 'Outro'::text])))
);


--
-- Name: TABLE fontes; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.fontes IS 'Registro de todas as fontes de dados';


--
-- Name: COLUMN fontes.nome_curto; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.fontes.nome_curto IS 'Nome curto usado como prefixo nos identificadores (ex: PNCP, IBAMA)';


--
-- Name: COLUMN fontes.categoria; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.fontes.categoria IS 'Categoria A-E conforme matriz de acao V2';


--
-- Name: fontes_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.fontes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fontes_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.fontes_id_seq OWNED BY engenharia.fontes.id;


--
-- Name: fornecedor_matches_summary; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.fornecedor_matches_summary (
    cnpj text,
    qtd integer,
    score_medio integer
);


--
-- Name: fornecedor_meta; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.fornecedor_meta (
    cnpj text NOT NULL,
    papel_wins_hub text DEFAULT 'FORNECEDOR'::text NOT NULL,
    grupo_id uuid,
    observacoes text,
    atualizado_em timestamp with time zone DEFAULT now(),
    dominio_email text,
    dominio_email_fonte text,
    padrao_email text,
    CONSTRAINT fornecedor_meta_papel_wins_hub_check CHECK ((papel_wins_hub = ANY (ARRAY['FORNECEDOR'::text, 'CLIENTE'::text, 'AMBOS'::text])))
);


--
-- Name: fornecedor_setores; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.fornecedor_setores (
    cnpj text,
    setor text
);


--
-- Name: fornecedores; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.fornecedores (
    cnpj text NOT NULL,
    razao_social text,
    nome_fantasia text,
    cnae_principal text,
    cnae_secundarios text[],
    logradouro text,
    numero text,
    complemento text,
    bairro text,
    cep text,
    municipio_ibge integer,
    municipio_nome text,
    uf text,
    telefone_1 text,
    telefone_2 text,
    email text,
    situacao text,
    porte text,
    capital_social numeric,
    data_abertura date,
    importado_em timestamp with time zone DEFAULT now(),
    atualizado_em timestamp with time zone DEFAULT now(),
    municipio_rfb text,
    divisao_cnae character(2),
    anos_ativos numeric(5,1),
    cnae_descricao text,
    porte_descricao character varying(50),
    data_situacao_cadastral date,
    tipo_estabelecimento character varying(10),
    fonte_dump_rfb character varying(20),
    situacao_cadastral character(2),
    cnae_fiscal_secundaria text,
    endereco_completo text,
    cadastrado boolean DEFAULT false NOT NULL,
    cadastrado_em timestamp with time zone,
    plano character varying(20),
    usuario_id uuid,
    porte_inferido text,
    matches_count integer DEFAULT 0 NOT NULL,
    status text
);


--
-- Name: TABLE fornecedores; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.fornecedores IS 'Base fria importada do dump público da Receita Federal. Contém apenas dados corporativos.';


--
-- Name: grupo; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.grupo (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    nome text NOT NULL,
    tipo text,
    ativo boolean DEFAULT true,
    observacoes text,
    criado_em timestamp with time zone DEFAULT now(),
    CONSTRAINT grupo_tipo_check CHECK ((tipo = ANY (ARRAY['CONSORCIO'::text, 'GRUPO_EMPRESARIAL'::text, 'HOLDING'::text, 'SPE'::text])))
);


--
-- Name: grupo_capturas; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.grupo_capturas (
    grupo_id uuid NOT NULL,
    captura_bruta_id uuid NOT NULL,
    correspondencia_id uuid,
    incluido_em timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE grupo_capturas; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.grupo_capturas IS 'N:N grupos x capturas';


--
-- Name: grupos_consolidados; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.grupos_consolidados (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidato_projeto_id uuid,
    titulo_sugerido text,
    criado_em timestamp with time zone DEFAULT now(),
    atualizado_em timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE grupos_consolidados; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.grupos_consolidados IS 'Grupos de capturas correspondentes para consolidacao';


--
-- Name: historico_empresa; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.historico_empresa (
    id bigint NOT NULL,
    batch_id text NOT NULL,
    cliente_chave text NOT NULL,
    cliente text NOT NULL,
    cpf_cnpj_mascarado text,
    cnpj_fragmento_digitos text,
    nome_normalizado text,
    nome_sem_natureza text,
    nome_sem_acentos text,
    quantidade_operacoes bigint,
    valor_total_operacoes double precision,
    valor_total_desembolsado double precision,
    primeira_operacao date,
    ultima_operacao date,
    quantidade_municipios bigint,
    ufs text,
    setores_bndes text,
    subsetores_bndes text,
    portes_registrados text,
    instituicoes_financeiras text,
    situacoes text,
    operacoes_ativas bigint,
    operacoes_desde_2025 bigint,
    valor_operacoes_desde_2025 double precision,
    valor_desembolsado_desde_2025 double precision,
    anos_com_operacao integer,
    ultima_operacao_anos numeric(8,2),
    recorrencia_investimento text,
    tendencia_recente text,
    importado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: historico_empresa_ano; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.historico_empresa_ano (
    id bigint NOT NULL,
    batch_id text NOT NULL,
    cliente_chave text NOT NULL,
    cliente text,
    cpf_cnpj_mascarado text,
    ano integer NOT NULL,
    quantidade_operacoes bigint,
    valor_total_operacoes double precision,
    valor_total_desembolsado double precision,
    operacoes_ativas bigint,
    importado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: historico_empresa_ano_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.historico_empresa_ano_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: historico_empresa_ano_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.historico_empresa_ano_id_seq OWNED BY engenharia.historico_empresa_ano.id;


--
-- Name: historico_empresa_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.historico_empresa_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: historico_empresa_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.historico_empresa_id_seq OWNED BY engenharia.historico_empresa.id;


--
-- Name: identificadores; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.identificadores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    captura_bruta_id uuid NOT NULL,
    namespace text NOT NULL,
    valor text NOT NULL,
    tipo text,
    confianca numeric(3,2) DEFAULT 1.00,
    evidencia jsonb,
    criado_em timestamp with time zone DEFAULT now(),
    CONSTRAINT identificadores_tipo_check CHECK ((tipo = ANY (ARRAY['processo'::text, 'contrato'::text, 'licenca'::text, 'codigo_ativo'::text, 'codigo_empreendimento'::text, 'alvara'::text, 'patente'::text, 'outro'::text])))
);


--
-- Name: TABLE identificadores; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.identificadores IS 'Identificadores oficiais com namespace';


--
-- Name: COLUMN identificadores.namespace; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.identificadores.namespace IS 'Namespace do identificador (ex: PNCP, IBAMA, BNDES, ANEEL, OBRASGOV)';


--
-- Name: COLUMN identificadores.valor; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.identificadores.valor IS 'Valor do identificador';


--
-- Name: COLUMN identificadores.tipo; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.identificadores.tipo IS 'Tipo do identificador';


--
-- Name: import_audit; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.import_audit (
    id bigint NOT NULL,
    batch_id text NOT NULL,
    etapa text NOT NULL,
    detalhe jsonb,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: import_audit_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.import_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: import_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.import_audit_id_seq OWNED BY engenharia.import_audit.id;


--
-- Name: importacoes; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.importacoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id text NOT NULL,
    iniciado_em timestamp with time zone DEFAULT now() NOT NULL,
    finalizado_em timestamp with time zone,
    status text DEFAULT 'EM_ANDAMENTO'::text NOT NULL,
    arquivos jsonb DEFAULT '{}'::jsonb NOT NULL,
    contagens jsonb DEFAULT '{}'::jsonb NOT NULL,
    hashes_sha256 jsonb DEFAULT '{}'::jsonb NOT NULL,
    notas text,
    created_by text DEFAULT 'bndes_intelligence'::text,
    CONSTRAINT importacoes_status_check CHECK ((status = ANY (ARRAY['EM_ANDAMENTO'::text, 'OK'::text, 'FALHA'::text, 'PARCIAL'::text])))
);


--
-- Name: interacoes; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.interacoes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    obra_id uuid,
    prestador_id uuid,
    tipo text,
    plano_momento text,
    valor_cobrado numeric,
    score_match integer,
    criado_em timestamp with time zone DEFAULT now()
);


--
-- Name: leads_outbound; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.leads_outbound (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    representante_id uuid,
    empresa_nome character varying(200) NOT NULL,
    cnpj character varying(14),
    cnae character varying(10),
    setor character varying(50),
    uf character varying(2),
    pdf_token character varying(40),
    pdf_gerado_em timestamp with time zone DEFAULT now(),
    contato_nome character varying(150),
    contato_email character varying(150),
    contato_linkedin character varying(200),
    contato_confirmado_em timestamp with time zone,
    pdf_acessado_em timestamp with time zone,
    pdf_acessos integer DEFAULT 0,
    cadastrou_em timestamp with time zone,
    prestador_id uuid,
    assinou_em timestamp with time zone,
    plano_assinado character varying(20),
    valor_pago_centavos integer,
    status character varying(30) DEFAULT 'PDF_GERADO'::character varying,
    notas text,
    criado_em timestamp with time zone DEFAULT now()
);


--
-- Name: localizacoes; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.localizacoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    captura_bruta_id uuid NOT NULL,
    tipo_localizacao text NOT NULL,
    municipio text,
    uf character varying(2),
    municipios_abrangidos text[],
    coordenadas point,
    confianca numeric(3,2) DEFAULT 1.00,
    evidencia jsonb,
    criado_em timestamp with time zone DEFAULT now(),
    CONSTRAINT localizacoes_tipo_localizacao_check CHECK ((tipo_localizacao = ANY (ARRAY['LOCAL_OBRA'::text, 'SEDE_EMPRESA'::text, 'SEDE_ORGAO'::text, 'ABRANGENCIA'::text, 'INFERIDA'::text])))
);


--
-- Name: TABLE localizacoes; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.localizacoes IS 'Localizacoes com tipo semantico';


--
-- Name: COLUMN localizacoes.tipo_localizacao; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.localizacoes.tipo_localizacao IS 'LOCAL_OBRA, SEDE_EMPRESA, SEDE_ORGAO, ABRANGENCIA, INFERIDA';


--
-- Name: log_captacao; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.log_captacao (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    fonte text,
    status text,
    buscados integer DEFAULT 0,
    novos integer DEFAULT 0,
    erro text,
    duracao_ms integer,
    criado_em timestamp with time zone DEFAULT now()
);


--
-- Name: mapeamentos_campos; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.mapeamentos_campos (
    id integer NOT NULL,
    captador_origem text NOT NULL,
    caminho_original text NOT NULL,
    campo_canonico_id text NOT NULL,
    transformacao text,
    semantica text,
    entidade_papel text,
    tipo_origem text,
    preenchimento text,
    qualidade text,
    versao text DEFAULT '1.0'::text NOT NULL,
    justificativa text,
    ativo boolean DEFAULT true,
    criado_em timestamp with time zone DEFAULT now(),
    CONSTRAINT mapeamentos_campos_preenchimento_check CHECK ((preenchimento = ANY (ARRAY['obrigatorio'::text, 'frequente'::text, 'eventual'::text, 'ausente'::text]))),
    CONSTRAINT mapeamentos_campos_qualidade_check CHECK ((qualidade = ANY (ARRAY['ALTA'::text, 'MEDIA'::text, 'BAIXA'::text, '—'::text]))),
    CONSTRAINT mapeamentos_campos_tipo_origem_check CHECK ((tipo_origem = ANY (ARRAY['nativo'::text, 'inferido'::text, 'enriquecido'::text, 'artificial'::text, 'descartado'::text])))
);


--
-- Name: TABLE mapeamentos_campos; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.mapeamentos_campos IS 'Mapeamento campo_original x campo_canonico';


--
-- Name: COLUMN mapeamentos_campos.tipo_origem; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.mapeamentos_campos.tipo_origem IS 'nativo: vem direto da fonte; inferido: calculado; enriquecido: API externa; artificial: estimativa winshub; descartado: nao mapeado';


--
-- Name: COLUMN mapeamentos_campos.versao; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.mapeamentos_campos.versao IS 'Obrigatorio — toda versao de mapeamento deve ser registrada';


--
-- Name: COLUMN mapeamentos_campos.justificativa; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.mapeamentos_campos.justificativa IS 'Justificativa para descarte ou transformacao';


--
-- Name: mapeamentos_campos_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.mapeamentos_campos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mapeamentos_campos_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.mapeamentos_campos_id_seq OWNED BY engenharia.mapeamentos_campos.id;


--
-- Name: matches_cadeia_fornecedor; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.matches_cadeia_fornecedor (
    id bigint NOT NULL,
    obra_id uuid,
    cnae_insumo_div character varying(2),
    demanda_div_mi numeric(14,1),
    fornecedor_cnpj character varying(14),
    fornecedor_razao text,
    fornecedor_uf character varying(2),
    mesmo_uf boolean,
    capital_social numeric,
    tem_decisor boolean,
    score integer,
    gerado_em timestamp with time zone DEFAULT now()
);


--
-- Name: matches_cadeia_fornecedor_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.matches_cadeia_fornecedor_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: matches_cadeia_fornecedor_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.matches_cadeia_fornecedor_id_seq OWNED BY engenharia.matches_cadeia_fornecedor.id;


--
-- Name: matches_cadeia_obra; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.matches_cadeia_obra (
    id bigint NOT NULL,
    obra_id uuid,
    cnae_insumo_div character varying(2),
    setor_insumo_nome text,
    coeficiente_leontief numeric(8,5),
    demanda_estimada_mi numeric(14,1),
    fornecedores_na_base integer,
    fornecedores_no_uf integer,
    com_decisor integer,
    gerado_em timestamp with time zone DEFAULT now()
);


--
-- Name: matches_cadeia_obra_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.matches_cadeia_obra_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: matches_cadeia_obra_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.matches_cadeia_obra_id_seq OWNED BY engenharia.matches_cadeia_obra.id;


--
-- Name: matches_empresa; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.matches_empresa (
    id bigint NOT NULL,
    batch_id text NOT NULL,
    cliente_chave text NOT NULL,
    cliente_bndes text NOT NULL,
    cpf_cnpj_mascarado text,
    cnpj_fragmento_digitos text,
    target_tipo text NOT NULL,
    obra_id uuid,
    entidade_id uuid,
    cnpj_conhecido text,
    empresa_wins text,
    uf_wins text,
    municipio_wins text,
    nivel text NOT NULL,
    confianca numeric(5,4) DEFAULT 0 NOT NULL,
    metodo text NOT NULL,
    criterios jsonb DEFAULT '[]'::jsonb NOT NULL,
    conflito boolean DEFAULT false NOT NULL,
    conflito_motivo text,
    revisao_manual boolean DEFAULT false NOT NULL,
    publicado boolean DEFAULT false NOT NULL,
    score_auxiliar smallint,
    rotulo_sinal text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT matches_empresa_nivel_check CHECK ((nivel = ANY (ARRAY['MATCH_EXATO'::text, 'MATCH_FORTE'::text, 'MATCH_PROVAVEL'::text, 'REVISAR'::text, 'SEM_MATCH'::text]))),
    CONSTRAINT matches_empresa_target_tipo_check CHECK ((target_tipo = ANY (ARRAY['OBRA_EMPRESA'::text, 'ENTIDADE'::text, 'LOOKUP'::text, 'FORNECEDOR'::text])))
);


--
-- Name: matches_empresa_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.matches_empresa_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: matches_empresa_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.matches_empresa_id_seq OWNED BY engenharia.matches_empresa.id;


--
-- Name: matches_necessidade_fornecedor; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.matches_necessidade_fornecedor (
    id bigint NOT NULL,
    obra_id uuid,
    necessidade text,
    cnae_prefixos text,
    fornecedor_cnpj character varying(14),
    fornecedor_razao text,
    fornecedor_uf character varying(2),
    mesmo_uf boolean,
    capital_social numeric,
    tem_decisor boolean,
    decisor_nome text,
    score integer,
    gerado_em timestamp with time zone DEFAULT now()
);


--
-- Name: matches_necessidade_fornecedor_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.matches_necessidade_fornecedor_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: matches_necessidade_fornecedor_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.matches_necessidade_fornecedor_id_seq OWNED BY engenharia.matches_necessidade_fornecedor.id;


--
-- Name: matches_v2; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.matches_v2 (
    obra_id uuid NOT NULL,
    cnpj text NOT NULL,
    score numeric NOT NULL,
    score_breakdown jsonb,
    gerado_em timestamp with time zone DEFAULT now()
);


--
-- Name: matches_obra_prestador; Type: VIEW; Schema: engenharia; Owner: -
--

CREATE VIEW engenharia.matches_obra_prestador AS
 SELECT (md5((((m.obra_id)::text || m.cnpj) || (c.id)::text)))::uuid AS id,
    m.obra_id,
    m.cnpj,
    c.id AS categoria_id,
    (row_number() OVER (PARTITION BY m.obra_id, c.id ORDER BY m.score DESC))::integer AS ranking,
    'estado'::text AS nivel_proximidade,
    NULL::numeric AS distancia_km,
    m.score,
    m.gerado_em,
    'regional'::character varying(20) AS escopo
   FROM ((engenharia.matches_v2 m
     JOIN engenharia.obras o ON ((o.id = m.obra_id)))
     JOIN engenharia.categorias_servico c ON (((m.score_breakdown ->> 'cnae_codigo'::text) = ANY (c.cnaes))));


--
-- Name: matchmaker_jobs; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.matchmaker_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    iniciado_por text,
    iniciado_em timestamp with time zone DEFAULT now(),
    finalizado_em timestamp with time zone,
    status character varying(20) DEFAULT 'RODANDO'::character varying,
    obras_alvo integer,
    obras_processadas integer DEFAULT 0,
    matches_criados integer DEFAULT 0,
    pid integer,
    ultimo_obra_id uuid,
    erro text,
    heartbeat timestamp with time zone,
    modo character varying(20) DEFAULT 'incremental'::character varying,
    CONSTRAINT matchmaker_status_check CHECK (((status)::text = ANY (ARRAY[('RODANDO'::character varying)::text, ('PAUSADO'::character varying)::text, ('CONCLUIDO'::character varying)::text, ('ERRO'::character varying)::text, ('ZOMBIE'::character varying)::text])))
);


--
-- Name: municipios_ibge; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.municipios_ibge (
    codigo_ibge integer NOT NULL,
    nome text NOT NULL,
    uf text NOT NULL,
    uf_nome text,
    regiao text,
    latitude numeric(9,6),
    longitude numeric(9,6),
    populacao integer
);


--
-- Name: municipios_rfb; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.municipios_rfb (
    codigo_rfb text NOT NULL,
    nome text NOT NULL,
    codigo_ibge integer
);


--
-- Name: mv_fornecedores_facetas_global; Type: MATERIALIZED VIEW; Schema: engenharia; Owner: -
--

CREATE MATERIALIZED VIEW engenharia.mv_fornecedores_facetas_global AS
 SELECT 'uf'::text AS tipo,
    e.uf AS valor,
    (count(DISTINCT e.cnpj))::integer AS qtd
   FROM engenharia.fornecedores e
  WHERE (e.uf IS NOT NULL)
  GROUP BY e.uf
UNION ALL
 SELECT 'porte'::text AS tipo,
    e.porte AS valor,
    (count(DISTINCT e.cnpj))::integer AS qtd
   FROM engenharia.fornecedores e
  WHERE (e.porte = ANY (ARRAY['ME'::text, 'EPP'::text, 'DEMAIS'::text]))
  GROUP BY e.porte
UNION ALL
 SELECT 'setor'::text AS tipo,
    o.setor AS valor,
    (count(DISTINCT e.cnpj))::integer AS qtd
   FROM ((engenharia.fornecedores e
     JOIN engenharia.matches_v2 mp ON ((mp.cnpj = e.cnpj)))
     JOIN engenharia.obras o ON ((o.id = mp.obra_id)))
  WHERE (COALESCE(o.setor, ''::text) <> ''::text)
  GROUP BY o.setor
  WITH NO DATA;


--
-- Name: mv_fornecedores_lista_global; Type: MATERIALIZED VIEW; Schema: engenharia; Owner: -
--

CREATE MATERIALIZED VIEW engenharia.mv_fornecedores_lista_global AS
 SELECT e.cnpj,
    e.razao_social,
    e.nome_fantasia,
    e.uf,
    e.municipio_nome,
    e.porte,
    e.porte_descricao,
    e.cnae_principal,
    e.cnae_descricao,
    e.email,
    e.telefone_1,
    e.capital_social,
    e.data_abertura,
    e.cadastrado,
    e.cadastrado AS _cadastrado_sort,
    COALESCE(m.qtd, 0) AS matches_count,
    COALESCE((round((m.score_medio)::numeric, 0))::integer, 0) AS score
   FROM (engenharia.fornecedores e
     LEFT JOIN engenharia.fornecedor_matches_summary m ON ((m.cnpj = e.cnpj)))
  ORDER BY COALESCE(m.qtd, 0) DESC, e.cadastrado DESC, e.razao_social
 LIMIT 5000
  WITH NO DATA;


--
-- Name: mv_fornecedores_score_bands_global; Type: MATERIALIZED VIEW; Schema: engenharia; Owner: -
--

CREATE MATERIALIZED VIEW engenharia.mv_fornecedores_score_bands_global AS
 SELECT (count(DISTINCT e.cnpj) FILTER (WHERE (m.score_medio >= 60)))::integer AS ge60,
    (count(DISTINCT e.cnpj) FILTER (WHERE (m.score_medio >= 70)))::integer AS ge70,
    (count(DISTINCT e.cnpj) FILTER (WHERE (m.score_medio >= 80)))::integer AS ge80,
    (count(DISTINCT e.cnpj) FILTER (WHERE (m.score_medio >= 90)))::integer AS ge90,
    (count(DISTINCT e.cnpj))::integer AS total
   FROM (engenharia.fornecedores e
     LEFT JOIN engenharia.fornecedor_matches_summary m ON ((m.cnpj = e.cnpj)))
  WITH NO DATA;


--
-- Name: newsletter_subscribers; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.newsletter_subscribers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email text NOT NULL,
    nome text,
    token_confirmacao text NOT NULL,
    confirmado_em timestamp with time zone,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    cancelado_em timestamp with time zone,
    ip text,
    origem text
);


--
-- Name: TABLE newsletter_subscribers; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.newsletter_subscribers IS 'Inscritos da newsletter pública (não-prestadores). Double opt-in: confirmado_em populado após clique no email.';


--
-- Name: COLUMN newsletter_subscribers.origem; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.newsletter_subscribers.origem IS 'Local do form que originou a inscrição: footer, hero, api, import.';


--
-- Name: noticias_backlog_manual; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.noticias_backlog_manual (
    id integer NOT NULL,
    fonte_nome text NOT NULL,
    url text,
    titulo text,
    descricao text,
    status text DEFAULT 'pending_url'::text,
    criado_em timestamp with time zone DEFAULT now(),
    processado_em timestamp with time zone,
    sonnet_analysis jsonb,
    sonnet_confidence text,
    sonnet_tier_recomendado text,
    motivo_rejeicao text
);


--
-- Name: noticias_backlog_manual_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.noticias_backlog_manual_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: noticias_backlog_manual_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.noticias_backlog_manual_id_seq OWNED BY engenharia.noticias_backlog_manual.id;


--
-- Name: noticias_processadas; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.noticias_processadas (
    hash text NOT NULL,
    fonte text NOT NULL,
    url text NOT NULL,
    title text,
    pubdate timestamp without time zone,
    processado_em timestamp without time zone DEFAULT now(),
    virou_obra boolean DEFAULT false,
    obra_id uuid,
    motivo_skip text,
    raw_haiku_response jsonb
);


--
-- Name: obra_checks; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.obra_checks (
    id integer NOT NULL,
    obra_id uuid,
    nome text,
    municipio text,
    uf text,
    valor_estimado numeric,
    status text,
    evidence jsonb,
    checked_at timestamp with time zone
);


--
-- Name: obra_checks_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.obra_checks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: obra_checks_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.obra_checks_id_seq OWNED BY engenharia.obra_checks.id;


--
-- Name: obra_decisores; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.obra_decisores (
    obra_id uuid NOT NULL,
    decisor_id uuid NOT NULL,
    papel text,
    vinculo_evidencia text,
    criado_em timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE obra_decisores; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.obra_decisores IS 'Vinculo N:N entre obras validadas e decisores';


--
-- Name: obras_atualizacoes_log; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.obras_atualizacoes_log (
    id integer NOT NULL,
    obra_id uuid,
    id_externo text NOT NULL,
    fonte text NOT NULL,
    campo text NOT NULL,
    valor_anterior text,
    valor_novo text,
    atualizado_em timestamp with time zone DEFAULT now()
);


--
-- Name: obras_atualizacoes_log_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.obras_atualizacoes_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: obras_atualizacoes_log_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.obras_atualizacoes_log_id_seq OWNED BY engenharia.obras_atualizacoes_log.id;


--
-- Name: obras_impacto_economico; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.obras_impacto_economico (
    obra_id uuid NOT NULL,
    setor_ibge text,
    atividade_nome text,
    multiplicador numeric(6,3),
    capex_bi numeric(14,3),
    producao_gerada_bi numeric(14,3),
    pib_va_bi numeric(14,3),
    empregos_estimados integer,
    gerado_em timestamp with time zone DEFAULT now()
);


--
-- Name: obras_sem_capex_backup; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.obras_sem_capex_backup (
    id uuid,
    id_externo text,
    nome text,
    empresa text,
    cnpj text,
    setor text,
    municipio text,
    uf text,
    valor_estimado numeric,
    valor_formatado text,
    fase text,
    status_licenca text,
    urgencia integer,
    lead_score integer,
    necessidades text[],
    descricao text,
    fonte text,
    url_fonte text,
    data_publicacao date,
    nivel1_nome text,
    nivel1_cargo text,
    nivel1_email text,
    nivel1_linkedin text,
    criado_em timestamp with time zone,
    visivel boolean,
    descricao_sintetica boolean,
    fonte_tipo text,
    canal_cadastro_url character varying(500),
    familias_fornecimento text,
    fornecedor_principal character varying(255),
    valor_atualizado_em timestamp without time zone,
    fonte_atualizacao text,
    observacoes_validacao text,
    validacao_data date,
    validacao_metodo character varying(50),
    cnpj_status character varying(30),
    notificado_em timestamp with time zone,
    status text,
    data_anuncio date,
    confianca_extracao numeric(3,2),
    nivel1_email_smtp_verified boolean,
    nivel1_email_score integer,
    nivel1_email_status text,
    nivel1_email_verified_at timestamp with time zone,
    nivel1_telefone text,
    nivel1_origem_enrichment text,
    nivel1_enrichment_data timestamp with time zone,
    classificacao_computed text,
    decisor_status text,
    obra_listada_na_fonte boolean,
    obra_dados_mudaram_at timestamp with time zone,
    validacao_obra_at timestamp with time zone,
    validacao_manual_status text,
    obra_fase_fonte text,
    nivel1_telefone_e164 text,
    nivel1_telefone_status text,
    motivo_invisivel text,
    descricao_publica text,
    descricao_publica_gerada_em timestamp with time zone,
    descricao_publica_fonte text,
    score_prospeccao_cached smallint,
    tem_decisor_externo_cached boolean,
    is_ouro_decisor_cached boolean,
    decisor_replicado_fp_cached boolean,
    ultimo_enrichment_status text,
    ultimo_enrichment_at timestamp with time zone,
    ultimo_enrichment_skip_motivo text,
    observacoes_enrichment text,
    empresa_executora text,
    cnpj_executora text,
    dominio_executora text,
    executora_status text,
    executora_fonte text,
    executora_atualizada_em timestamp with time zone,
    capex_fonte text
);


--
-- Name: obras_validadas; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.obras_validadas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    grupo_id uuid NOT NULL,
    candidato_projeto_id uuid,
    titulo text NOT NULL,
    descricao text,
    status text DEFAULT 'validada'::text,
    visivel boolean DEFAULT false,
    fontes_encontradas text[],
    quantidade_fontes integer,
    campos_complementados integer,
    conflitos_abertos integer DEFAULT 0,
    completude numeric(5,2),
    confianca_consolidacao numeric(3,2),
    portao_decisao text,
    portao_versao text,
    validada_em timestamp with time zone DEFAULT now(),
    criado_em timestamp with time zone DEFAULT now(),
    atualizado_em timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE obras_validadas; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.obras_validadas IS 'Obras validadas apos decisao ACEITAR no portao';


--
-- Name: COLUMN obras_validadas.visivel; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.obras_validadas.visivel IS 'Nunca true por padrao. Enriquecimento comercial somente apos ACEITAR.';


--
-- Name: COLUMN obras_validadas.fontes_encontradas; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.obras_validadas.fontes_encontradas IS 'Lista de fontes que contribuiram para esta obra';


--
-- Name: COLUMN obras_validadas.completude; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.obras_validadas.completude IS 'Percentual de campos canonicos preenchidos 0-100';


--
-- Name: COLUMN obras_validadas.confianca_consolidacao; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.obras_validadas.confianca_consolidacao IS 'Confianca geral da consolidacao';


--
-- Name: operacoes_recentes; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.operacoes_recentes (
    id bigint NOT NULL,
    batch_id text NOT NULL,
    cliente_chave text NOT NULL,
    cliente text NOT NULL,
    cpf_cnpj_mascarado text,
    cnpj_fragmento_digitos text,
    qtd_operacoes bigint,
    valor_total_operacoes double precision,
    valor_total_desembolsado double precision,
    valor_desembolsado_informado boolean DEFAULT false NOT NULL,
    primeira_operacao date,
    ultima_operacao date,
    operacoes_ativas bigint,
    ufs text,
    municipios text,
    setores_bndes text,
    subsetores_bndes text,
    produtos text,
    instrumentos text,
    agentes_financeiros text,
    cnpjs_agentes text,
    situacoes text,
    importado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: operacoes_recentes_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.operacoes_recentes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: operacoes_recentes_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.operacoes_recentes_id_seq OWNED BY engenharia.operacoes_recentes.id;


--
-- Name: ouro_enrichment_quality_audit; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.ouro_enrichment_quality_audit (
    id bigint NOT NULL,
    obra_id uuid NOT NULL,
    tier_anterior text,
    tier_novo text,
    origem_promocao text,
    criterios jsonb,
    cnpj text,
    dominio text,
    capex numeric,
    decisor text,
    cargo text,
    linkedin text,
    email text,
    email_status text,
    email_fonte_class text,
    email_fonte text,
    telefone text,
    vinculo_atual text,
    conflitos text[],
    decisao text NOT NULL,
    motivo text,
    auditor text DEFAULT 'audit_ouro_quality_v1'::text,
    lote text DEFAULT '20260717_ouro_quality'::text,
    consulta_externa boolean DEFAULT false,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ouro_enrichment_quality_audit_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.ouro_enrichment_quality_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ouro_enrichment_quality_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.ouro_enrichment_quality_audit_id_seq OWNED BY engenharia.ouro_enrichment_quality_audit.id;


--
-- Name: ouro_quality_snapshot; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.ouro_quality_snapshot (
    obra_id uuid NOT NULL,
    tier text,
    classificacao_snapshot text,
    empresa text,
    cnpj text,
    email text,
    email_status text,
    decisor text,
    cargo text,
    linkedin text,
    snapshot_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: outreach_drafts; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.outreach_drafts (
    id integer NOT NULL,
    decisor_id integer,
    obra_id uuid,
    fornecedor_nome character varying(200),
    assunto character varying(200),
    corpo text,
    cta text,
    raciocinio text,
    prompt_versao character varying(20),
    custo_usd numeric(8,6),
    tokens_input integer,
    tokens_output integer,
    gerado_em timestamp with time zone DEFAULT now(),
    enviado_em timestamp with time zone,
    status character varying(20) DEFAULT 'rascunho'::character varying,
    CONSTRAINT outreach_drafts_status_check CHECK (((status)::text = ANY (ARRAY[('rascunho'::character varying)::text, ('aprovado'::character varying)::text, ('enviado'::character varying)::text, ('descartado'::character varying)::text])))
);


--
-- Name: outreach_drafts_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.outreach_drafts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: outreach_drafts_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.outreach_drafts_id_seq OWNED BY engenharia.outreach_drafts.id;


--
-- Name: pagamentos; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.pagamentos (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    prestador_id uuid,
    plano text,
    preco_centavos integer NOT NULL,
    mp_preference_id text,
    mp_payment_id text,
    mp_status text,
    status_local text DEFAULT 'pendente'::text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone,
    tipo text DEFAULT 'plano'::text NOT NULL,
    obra_id uuid,
    cnpj_empresa text,
    modalidade character varying(20),
    renunciou_avaliacao boolean DEFAULT false,
    lead_outbound_id uuid,
    renunciou_arrependimento boolean DEFAULT false,
    renunciou_arrependimento_em timestamp with time zone,
    renunciou_arrependimento_ip text,
    CONSTRAINT pagamentos_tipo_check CHECK ((tipo = ANY (ARRAY['plano'::text, 'desbloqueio'::text])))
);


--
-- Name: password_resets; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.password_resets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    ip_origem inet,
    user_agent text
);


--
-- Name: pipeline_falhas; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.pipeline_falhas (
    id bigint NOT NULL,
    fonte text,
    captador text,
    id_externo text,
    namespace text DEFAULT 'default'::text NOT NULL,
    payload jsonb,
    contexto jsonb,
    erro text NOT NULL,
    status text DEFAULT 'pendente'::text NOT NULL,
    tentativas integer DEFAULT 0 NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    resolvido_em timestamp with time zone,
    CONSTRAINT pipeline_falhas_status_ck CHECK ((status = ANY (ARRAY['pendente'::text, 'reprocessando'::text, 'resolvido'::text, 'desistido'::text])))
);


--
-- Name: pipeline_falhas_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.pipeline_falhas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pipeline_falhas_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.pipeline_falhas_id_seq OWNED BY engenharia.pipeline_falhas.id;


--
-- Name: pipeline_inbox; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.pipeline_inbox (
    id bigint NOT NULL,
    v1_obra_id uuid,
    fonte text,
    id_externo text,
    payload_minimo jsonb NOT NULL,
    status text DEFAULT 'pendente'::text NOT NULL,
    erro text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    processado_em timestamp with time zone,
    CONSTRAINT pipeline_inbox_status_ck CHECK ((status = ANY (ARRAY['pendente'::text, 'processado'::text, 'ignorado'::text, 'erro'::text])))
);


--
-- Name: pipeline_inbox_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.pipeline_inbox_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pipeline_inbox_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.pipeline_inbox_id_seq OWNED BY engenharia.pipeline_inbox.id;


--
-- Name: pipeline_obras_log; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.pipeline_obras_log (
    id integer NOT NULL,
    "timestamp" timestamp without time zone DEFAULT now(),
    operacao character varying(20),
    obra_id uuid,
    obra_titulo text,
    fonte_dado text,
    campos_alterados jsonb,
    valores_antigos jsonb,
    valores_novos jsonb,
    nota text
);


--
-- Name: pipeline_obras_log_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.pipeline_obras_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pipeline_obras_log_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.pipeline_obras_log_id_seq OWNED BY engenharia.pipeline_obras_log.id;


--
-- Name: pipeline_origem_reclass_audit; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.pipeline_origem_reclass_audit (
    id bigint NOT NULL,
    captura_bruta_id uuid NOT NULL,
    id_externo text,
    fonte text,
    captador text,
    marcador_anterior text NOT NULL,
    marcador_novo text NOT NULL,
    motivo text NOT NULL,
    v1_obra_id uuid,
    evidencias jsonb,
    executado_em timestamp with time zone DEFAULT now() NOT NULL,
    executado_por text DEFAULT 'correcao_monitoramento_20260717'::text NOT NULL
);


--
-- Name: pipeline_origem_reclass_audit_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.pipeline_origem_reclass_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pipeline_origem_reclass_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.pipeline_origem_reclass_audit_id_seq OWNED BY engenharia.pipeline_origem_reclass_audit.id;


--
-- Name: plano_alteracoes_suspeitas; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.plano_alteracoes_suspeitas (
    id bigint NOT NULL,
    prestador_id uuid NOT NULL,
    plano_antigo text,
    plano_novo text,
    detectado_em timestamp with time zone DEFAULT now() NOT NULL,
    contexto text,
    alertado_em timestamp with time zone
);


--
-- Name: plano_alteracoes_suspeitas_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.plano_alteracoes_suspeitas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: plano_alteracoes_suspeitas_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.plano_alteracoes_suspeitas_id_seq OWNED BY engenharia.plano_alteracoes_suspeitas.id;


--
-- Name: planos_pricing; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.planos_pricing (
    id integer NOT NULL,
    plano character varying(20) NOT NULL,
    periodo character varying(15) NOT NULL,
    preco_centavos integer NOT NULL,
    saldo_centavos integer NOT NULL,
    desconto_pct integer DEFAULT 0,
    ativo boolean DEFAULT true
);


--
-- Name: planos_pricing_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.planos_pricing_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: planos_pricing_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.planos_pricing_id_seq OWNED BY engenharia.planos_pricing.id;


--
-- Name: portao_config; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.portao_config (
    chave text NOT NULL,
    valor text NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    nota text
);


--
-- Name: portao_decisoes; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.portao_decisoes (
    id bigint NOT NULL,
    obra_id uuid NOT NULL,
    captura_id uuid,
    status_anterior text,
    status_novo text NOT NULL,
    regra_aplicada text,
    versao_portao text NOT NULL,
    confianca numeric(5,4),
    motivo text NOT NULL,
    criterios_atendidos jsonb,
    criterios_ausentes jsonb,
    evidencias jsonb,
    campos_analisados jsonb,
    origem_decisao text DEFAULT 'regra'::text NOT NULL,
    usuario_ou_agente text DEFAULT 'portao_automatico'::text NOT NULL,
    reverso boolean DEFAULT false NOT NULL,
    reverte_decisao_id bigint,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: portao_decisoes_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.portao_decisoes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: portao_decisoes_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.portao_decisoes_id_seq OWNED BY engenharia.portao_decisoes.id;


--
-- Name: portao_fila; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.portao_fila (
    id bigint NOT NULL,
    obra_id uuid NOT NULL,
    captura_id uuid,
    status text DEFAULT 'pendente'::text NOT NULL,
    tentativas integer DEFAULT 0 NOT NULL,
    max_tentativas integer DEFAULT 5 NOT NULL,
    proxima_tentativa timestamp with time zone DEFAULT now() NOT NULL,
    ultimo_erro text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    processado_em timestamp with time zone,
    CONSTRAINT portao_fila_status_ck CHECK ((status = ANY (ARRAY['pendente'::text, 'processando'::text, 'concluido'::text, 'erro'::text, 'desistido'::text])))
);


--
-- Name: portao_fila_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.portao_fila_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: portao_fila_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.portao_fila_id_seq OWNED BY engenharia.portao_fila.id;


--
-- Name: portao_rollback_historico; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.portao_rollback_historico (
    id bigint NOT NULL,
    obra_id uuid NOT NULL,
    status_portao_anterior text,
    visivel_anterior boolean,
    classificacao_anterior text,
    motivo_invisivel_anterior text,
    status_enriquecimento_anterior text,
    motivo text,
    status_portao_novo text,
    visivel_novo boolean,
    lote text,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: portao_rollback_historico_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.portao_rollback_historico_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: portao_rollback_historico_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.portao_rollback_historico_id_seq OWNED BY engenharia.portao_rollback_historico.id;


--
-- Name: portao_snapshot_pre_historico; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.portao_snapshot_pre_historico (
    snapshot_id bigint NOT NULL,
    obra_id uuid NOT NULL,
    status_portao text,
    visivel boolean,
    motivo_invisivel text,
    classificacao_computed text,
    status_enriquecimento text,
    fase_real_obra text,
    valor_estimado numeric,
    fonte text,
    setor text,
    empresa text,
    id_externo text,
    nome text,
    capturado_em timestamp with time zone DEFAULT now()
);


--
-- Name: portao_snapshot_pre_historico_snapshot_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.portao_snapshot_pre_historico_snapshot_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: portao_snapshot_pre_historico_snapshot_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.portao_snapshot_pre_historico_snapshot_id_seq OWNED BY engenharia.portao_snapshot_pre_historico.snapshot_id;


--
-- Name: prata_external_enrich_audit; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.prata_external_enrich_audit (
    id bigint NOT NULL,
    obra_id uuid NOT NULL,
    grupo text,
    tier_anterior text,
    tier_novo text,
    decisor text,
    empresa text,
    cnpj text,
    dominio text,
    email text,
    email_status text,
    ferramenta text,
    fonte text,
    url text,
    evidencia text,
    confianca numeric,
    creditos_consumidos integer DEFAULT 0,
    regra text,
    lote text,
    motivo text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: prata_external_enrich_audit_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.prata_external_enrich_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: prata_external_enrich_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.prata_external_enrich_audit_id_seq OWNED BY engenharia.prata_external_enrich_audit.id;


--
-- Name: prata_external_enrich_snapshot; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.prata_external_enrich_snapshot (
    obra_id uuid NOT NULL,
    empresa text,
    cnpj text,
    dominio text,
    capex numeric,
    decisor text,
    cargo text,
    linkedin text,
    email text,
    email_status text,
    email_fonte text,
    telefone text,
    lacunas text[],
    grupo text,
    prioridade integer,
    tier text,
    snapshot_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: prata_segmentacao; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.prata_segmentacao (
    obra_id uuid NOT NULL,
    grupo text NOT NULL,
    prioridade integer NOT NULL,
    cnpj_ok boolean,
    dominio_ok boolean,
    capex_ok boolean,
    decisor_ok boolean,
    cargo_ok boolean,
    linkedin_ok boolean,
    email_presente boolean,
    email_validado boolean,
    is_rebaixada_reuso boolean DEFAULT false,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: prestador_empresas; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.prestador_empresas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prestador_id uuid,
    cnpj text NOT NULL,
    razao_social text,
    tipo text DEFAULT 'representante'::text,
    ativo boolean DEFAULT true,
    criado_em timestamp with time zone DEFAULT now()
);


--
-- Name: prestadores; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.prestadores (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    nome_empresa text NOT NULL,
    cnpj text,
    email text NOT NULL,
    senha_hash text NOT NULL,
    telefone text,
    segmento text,
    uf text,
    plano text DEFAULT 'GRATUITO'::text,
    plano_expira timestamp with time zone,
    creditos integer DEFAULT 0,
    ativo boolean DEFAULT true,
    criado_em timestamp with time zone DEFAULT now(),
    ultimo_acesso timestamp with time zone,
    optin_em timestamp with time zone,
    optin_ip text,
    optin_origem text,
    excluido_em timestamp with time zone,
    excluido_motivo text,
    razao_social text,
    status text DEFAULT 'ativo'::text,
    email_token text,
    email_token_expiry timestamp with time zone,
    mp_subscription_id text,
    mp_payer_id text,
    modalidade character varying(20) DEFAULT 'MENSAL'::character varying,
    preco_pago_mes numeric(10,2),
    preco_pago_total numeric(10,2),
    ciclo_inicio timestamp with time zone DEFAULT now(),
    ciclo_fim timestamp with time zone,
    proximo_billing timestamp with time zone,
    auto_renovacao boolean DEFAULT true,
    periodo_avaliacao_fim timestamp with time zone,
    renunciou_avaliacao boolean DEFAULT false,
    creditos_liberados_em timestamp with time zone,
    last_inapp_alert_at timestamp with time zone,
    badge_verificador boolean DEFAULT false,
    badge_verificador_desde timestamp with time zone,
    acesso_antecipado boolean DEFAULT false,
    contribuicoes_total integer DEFAULT 0,
    creditos_consumidos integer DEFAULT 0,
    creditos_ganhos integer DEFAULT 0,
    codigo_convite character varying(20),
    convidado_por uuid,
    creditos_expiram_em timestamp with time zone,
    onboarding_completo boolean DEFAULT false,
    onboarding_completo_em timestamp with time zone,
    is_representante boolean DEFAULT false,
    comissao_pct_inicial integer DEFAULT 50,
    comissao_pct_recorrente integer DEFAULT 25,
    comissao_meses_recorrencia integer DEFAULT 12,
    senha_temporaria boolean DEFAULT false,
    senha_alterada_em timestamp with time zone,
    cnaes_primario character varying(10),
    cnaes_secundarios text[],
    ufs_atuacao text[],
    capex_min_milhoes numeric(10,2),
    capex_max_milhoes numeric(10,2),
    especialidades_tags text[],
    referencias_obras text[],
    tamanho_porte character varying(20),
    viaja_nacional boolean DEFAULT true,
    viaja_internacional boolean DEFAULT false,
    faixa_faturamento character varying(50),
    certificacoes jsonb DEFAULT '{}'::jsonb,
    cases_breve text,
    site_institucional character varying(255),
    linkedin_empresa character varying(255),
    telefone_comercial character varying(20),
    source character varying(50) DEFAULT 'cadastro_manual'::character varying,
    renunciou_arrependimento boolean DEFAULT false,
    renunciou_arrependimento_em timestamp with time zone,
    renunciou_arrependimento_ip text,
    eh_co_admin boolean DEFAULT false NOT NULL,
    plano_enterprise boolean DEFAULT false,
    white_label boolean DEFAULT false,
    territorio_alerta text,
    api_token text,
    CONSTRAINT chk_modalidade CHECK (((modalidade)::text = ANY (ARRAY[('MENSAL'::character varying)::text, ('TRIMESTRAL'::character varying)::text, ('SEMESTRAL'::character varying)::text, ('ANUAL'::character varying)::text]))),
    CONSTRAINT prestadores_tamanho_porte_check CHECK ((((tamanho_porte)::text = ANY (ARRAY[('ME'::character varying)::text, ('EPP'::character varying)::text, ('MEDIO'::character varying)::text, ('GRANDE'::character varying)::text])) OR (tamanho_porte IS NULL)))
);


--
-- Name: COLUMN prestadores.optin_em; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.prestadores.optin_em IS 'Timestamp do consentimento explícito do prestador. Base legal LGPD Art. 7º I.';


--
-- Name: COLUMN prestadores.excluido_em; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.prestadores.excluido_em IS 'Soft-delete por solicitação do titular (LGPD Art. 18 VI). Não apagar do banco por rastreabilidade — basta marcar.';


--
-- Name: primeiro_acesso_tokens; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.primeiro_acesso_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prestador_id uuid,
    token character varying(60) NOT NULL,
    expira_em timestamp with time zone NOT NULL,
    usado_em timestamp with time zone,
    criado_em timestamp with time zone DEFAULT now()
);


--
-- Name: quota_snapshots; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.quota_snapshots (
    id bigint NOT NULL,
    ts timestamp with time zone DEFAULT now() NOT NULL,
    service character varying(20) NOT NULL,
    used integer NOT NULL,
    available integer NOT NULL,
    pct_restante numeric(5,2) NOT NULL,
    reset_at date,
    raw jsonb
);


--
-- Name: quota_snapshots_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.quota_snapshots_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: quota_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.quota_snapshots_id_seq OWNED BY engenharia.quota_snapshots.id;


--
-- Name: regras_prioridade_campos; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.regras_prioridade_campos (
    id integer NOT NULL,
    campo_canonico_id text NOT NULL,
    ordem_prioridade text[] NOT NULL,
    regra_conflito text,
    observacao text,
    versao text DEFAULT '1.0'::text NOT NULL,
    ativo boolean DEFAULT true,
    criado_em timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE regras_prioridade_campos; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.regras_prioridade_campos IS 'Regras de prioridade entre fontes por campo canonico';


--
-- Name: regras_prioridade_campos_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.regras_prioridade_campos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: regras_prioridade_campos_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.regras_prioridade_campos_id_seq OWNED BY engenharia.regras_prioridade_campos.id;


--
-- Name: resumo_empresa_wins; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.resumo_empresa_wins (
    id bigint NOT NULL,
    batch_id text NOT NULL,
    match_id bigint,
    obra_id uuid,
    entidade_id uuid,
    cnpj_conhecido text,
    empresa_wins text,
    cliente_bndes text,
    cliente_chave text NOT NULL,
    nivel text NOT NULL,
    publicado boolean DEFAULT false NOT NULL,
    bndes_historico_encontrado boolean DEFAULT true NOT NULL,
    bndes_quantidade_operacoes bigint,
    bndes_valor_historico_operacoes double precision,
    bndes_valor_historico_desembolsado double precision,
    bndes_primeira_operacao date,
    bndes_ultima_operacao date,
    bndes_operacoes_ativas bigint,
    bndes_operacoes_desde_2025 bigint,
    bndes_valor_operacoes_desde_2025 double precision,
    bndes_valor_desembolsado_desde_2025 double precision,
    bndes_setores_historicos text,
    bndes_subsetores_historicos text,
    bndes_ufs_historicas text,
    bndes_portes_registrados text,
    bndes_instituicoes_financeiras text,
    bndes_situacoes_operacoes text,
    bndes_recorrencia_investimento text,
    bndes_anos_com_operacao integer,
    bndes_ultima_operacao_anos numeric(8,2),
    bndes_tendencia_recente text,
    bndes_investment_signal_score smallint,
    bndes_investment_signal_label text,
    bndes_tipo_vinculo text,
    bndes_match_metodo text,
    bndes_match_confianca numeric(5,4),
    bndes_match_criterios jsonb,
    bndes_fonte_arquivo text,
    bndes_fonte_url text DEFAULT 'https://dadosabertos.bndes.gov.br/dataset/operacoes-financiamento'::text,
    bndes_data_atualizacao timestamp with time zone DEFAULT now() NOT NULL,
    bndes_evidencia text DEFAULT 'HISTORICO_EMPRESA_BNDES'::text,
    bndes_conflito boolean DEFAULT false,
    bndes_revisao_manual boolean DEFAULT false,
    bndes_import_batch_id text
);


--
-- Name: resumo_empresa_wins_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.resumo_empresa_wins_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: resumo_empresa_wins_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.resumo_empresa_wins_id_seq OWNED BY engenharia.resumo_empresa_wins.id;


--
-- Name: sc_decisor_fase1_log; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.sc_decisor_fase1_log (
    cnpj character varying(14) NOT NULL,
    empresa text,
    status text,
    nome text,
    cargo text,
    confianca integer,
    snippet text,
    processado_em timestamp with time zone DEFAULT now()
);


--
-- Name: setor_categorias; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.setor_categorias (
    id integer NOT NULL,
    setor text NOT NULL,
    categoria_id integer NOT NULL,
    prioridade integer DEFAULT 5
);


--
-- Name: setor_categorias_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.setor_categorias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: setor_categorias_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.setor_categorias_id_seq OWNED BY engenharia.setor_categorias.id;


--
-- Name: setor_cnae_compatibility; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.setor_cnae_compatibility (
    id integer NOT NULL,
    setor_obra text NOT NULL,
    cnae_codigo text NOT NULL,
    peso numeric NOT NULL,
    fases_aplicaveis text[] NOT NULL,
    fonte text DEFAULT 'seed_manual'::text,
    criado_em timestamp with time zone DEFAULT now(),
    CONSTRAINT setor_cnae_compatibility_peso_check CHECK (((peso >= (0)::numeric) AND (peso <= (1)::numeric)))
);


--
-- Name: setor_cnae_compatibility_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.setor_cnae_compatibility_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: setor_cnae_compatibility_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.setor_cnae_compatibility_id_seq OWNED BY engenharia.setor_cnae_compatibility.id;


--
-- Name: sinais_oportunidade; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.sinais_oportunidade (
    id bigint NOT NULL,
    batch_id text NOT NULL,
    cliente_chave text NOT NULL,
    cliente text NOT NULL,
    cpf_cnpj_mascarado text,
    status text DEFAULT 'SINAL_NOVO'::text NOT NULL,
    valor_recente double precision,
    operacoes_desde_2025 bigint,
    operacoes_ativas bigint,
    ultima_operacao date,
    setores text,
    ufs text,
    criterios jsonb DEFAULT '[]'::jsonb NOT NULL,
    match_nivel text,
    notas text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sinais_oportunidade_status_check CHECK ((status = ANY (ARRAY['SINAL_NOVO'::text, 'EMPRESA_EXISTENTE'::text, 'POSSIVEL_OPORTUNIDADE'::text, 'SEM_EVIDENCIA_DE_OBRA'::text, 'REVISAR'::text, 'DESCARTADO'::text])))
);


--
-- Name: sinais_oportunidade_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.sinais_oportunidade_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sinais_oportunidade_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.sinais_oportunidade_id_seq OWNED BY engenharia.sinais_oportunidade.id;


--
-- Name: tier_coerencia_audit; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.tier_coerencia_audit (
    id bigint NOT NULL,
    obra_id uuid NOT NULL,
    tier_anterior text,
    tier_novo text,
    motivo text,
    telefone text,
    tipo_telefone text,
    fonte text,
    confianca numeric,
    decisor text,
    cargo text,
    canal_meta jsonb,
    regra_aplicada text,
    criado_em timestamp with time zone DEFAULT now()
);


--
-- Name: tier_coerencia_audit_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.tier_coerencia_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tier_coerencia_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.tier_coerencia_audit_id_seq OWNED BY engenharia.tier_coerencia_audit.id;


--
-- Name: tier_ouro_regra_final_audit; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.tier_ouro_regra_final_audit (
    id bigint NOT NULL,
    obra_id uuid NOT NULL,
    tier_anterior text,
    tier_novo text,
    criterios_atendidos jsonb,
    criterios_ausentes jsonb,
    cnpj text,
    dominio text,
    capex numeric,
    decisor text,
    cargo text,
    linkedin text,
    email text,
    email_status text,
    telefone text,
    tipo_telefone text,
    motivo text,
    regra_aplicada text DEFAULT 'OURO_8_CRITERIOS_V1'::text NOT NULL,
    evidencias jsonb,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tier_ouro_regra_final_audit_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.tier_ouro_regra_final_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tier_ouro_regra_final_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.tier_ouro_regra_final_audit_id_seq OWNED BY engenharia.tier_ouro_regra_final_audit.id;


--
-- Name: tier_ouro_regra_final_snapshot; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.tier_ouro_regra_final_snapshot (
    obra_id uuid NOT NULL,
    classificacao_anterior text,
    status_portao text,
    valor_estimado numeric,
    cnpj text,
    snapshot_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: uf_proximidade; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.uf_proximidade (
    uf_obra text NOT NULL,
    uf_fornec text NOT NULL,
    peso numeric NOT NULL,
    tipo text NOT NULL,
    CONSTRAINT uf_proximidade_peso_check CHECK (((peso >= (0)::numeric) AND (peso <= (1)::numeric))),
    CONSTRAINT uf_proximidade_tipo_check CHECK ((tipo = ANY (ARRAY['mesma'::text, 'vizinha'::text, 'regiao'::text, 'outra'::text])))
);


--
-- Name: ufs_vizinhas; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.ufs_vizinhas (
    uf text NOT NULL,
    uf_vizinha text NOT NULL
);


--
-- Name: urls_fonte_validacao; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.urls_fonte_validacao (
    url_fonte text NOT NULL,
    tipo_url text DEFAULT 'dado_aberto_csv'::text NOT NULL,
    existencia_status text,
    existencia_http_code integer,
    existencia_validada_at timestamp with time zone,
    payload_hash text,
    payload_hash_anterior text,
    last_modified_header text,
    movimento_detectado_at timestamp with time zone,
    estrutural_validado_at timestamp with time zone,
    proxima_revalidacao timestamp with time zone,
    tentativas_consecutivas_falha integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: v8_chromium_results; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.v8_chromium_results (
    id integer NOT NULL,
    razao_social_input text NOT NULL,
    cnpj_input text,
    cnpj_descoberto text,
    razao_social_oficial text,
    uf text,
    dominio_oficial text,
    fonte_dominio text,
    confidence text,
    obs text,
    precisa_revisao_manual boolean DEFAULT false,
    descoberto_em timestamp with time zone DEFAULT now()
);


--
-- Name: v8_chromium_results_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.v8_chromium_results_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: v8_chromium_results_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.v8_chromium_results_id_seq OWNED BY engenharia.v8_chromium_results.id;


--
-- Name: valores_mestre; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.valores_mestre (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    grupo_id uuid NOT NULL,
    campo_canonico_id text NOT NULL,
    valor_mestre text,
    fonte_preferencial integer,
    captura_origem_id uuid,
    confianca numeric(3,2),
    justificativa text,
    alternativas jsonb,
    revisao_necessaria boolean DEFAULT false,
    criado_em timestamp with time zone DEFAULT now(),
    atualizado_em timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE valores_mestre; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.valores_mestre IS 'Valores mestres por grupo consolidado';


--
-- Name: COLUMN valores_mestre.justificativa; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.valores_mestre.justificativa IS 'Justificativa da escolha do valor mestre';


--
-- Name: COLUMN valores_mestre.alternativas; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.valores_mestre.alternativas IS 'Valores alternativos preservados para auditoria';


--
-- Name: valores_monetarios; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.valores_monetarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    captura_bruta_id uuid NOT NULL,
    tipo_valor text NOT NULL,
    valor_original numeric(20,2),
    valor_normalizado numeric(20,2),
    moeda text DEFAULT 'BRL'::text,
    confianca numeric(3,2) DEFAULT 1.00,
    metodo_estimativa text,
    formula_estimativa text,
    premissas_estimativa text,
    data_referencia date,
    versao_modelo text,
    evidencia jsonb,
    criado_em timestamp with time zone DEFAULT now(),
    CONSTRAINT valores_monetarios_tipo_valor_check CHECK ((tipo_valor = ANY (ARRAY['CAPEX_DECLARADO'::text, 'VALOR_ESTIMADO_CONTRATACAO'::text, 'VALOR_CONTRATADO'::text, 'VALOR_FINANCIADO'::text, 'VALOR_DE_LEILAO'::text, 'TETO_CREDENCIAMENTO'::text, 'ORCAMENTO_PROGRAMA'::text, 'VALOR_AGREGADO'::text, 'ESTIMATIVA_WINSHUB'::text, 'NAO_COMPARAVEL'::text, 'DESCONHECIDO'::text])))
);


--
-- Name: TABLE valores_monetarios; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.valores_monetarios IS 'Valores monetarios com semantica';


--
-- Name: COLUMN valores_monetarios.tipo_valor; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.valores_monetarios.tipo_valor IS 'Tipo semantico do valor. ESTIMATIVA_WINSHUB exige metodo, formula, premissas, data_referencia, confianca, versao_modelo.';


--
-- Name: COLUMN valores_monetarios.metodo_estimativa; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.valores_monetarios.metodo_estimativa IS 'Metodo usado para estimar (ex: potencia_kw * 4000000 / 1000)';


--
-- Name: COLUMN valores_monetarios.premissas_estimativa; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.valores_monetarios.premissas_estimativa IS 'Premissas adotadas na estimativa';


--
-- Name: COLUMN valores_monetarios.data_referencia; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.valores_monetarios.data_referencia IS 'Data de referencia dos dados usados na estimativa';


--
-- Name: COLUMN valores_monetarios.versao_modelo; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.valores_monetarios.versao_modelo IS 'Versao do modelo de estimativa';


--
-- Name: valores_normalizados; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.valores_normalizados (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    captura_bruta_id uuid NOT NULL,
    campo_canonico_id text NOT NULL,
    valor_original text,
    valor_normalizado text,
    campo_origem text NOT NULL,
    fonte_id integer NOT NULL,
    tipo_origem text,
    confianca numeric(3,2) DEFAULT 1.00,
    evidencia jsonb,
    criado_em timestamp with time zone DEFAULT now(),
    CONSTRAINT valores_normalizados_tipo_origem_check CHECK ((tipo_origem = ANY (ARRAY['nativo'::text, 'inferido'::text, 'enriquecido'::text, 'artificial'::text])))
);


--
-- Name: TABLE valores_normalizados; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON TABLE engenharia.valores_normalizados IS 'Valores extraidos e normalizados do payload';


--
-- Name: COLUMN valores_normalizados.evidencia; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON COLUMN engenharia.valores_normalizados.evidencia IS 'Evidencia da extracao (caminho JSON, regex, transformacao aplicada)';


--
-- Name: vinculo_audit; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.vinculo_audit (
    id bigint NOT NULL,
    batch_id text NOT NULL,
    match_id bigint,
    obra_id uuid,
    entidade_id uuid,
    cliente_chave text,
    acao text NOT NULL,
    nivel_anterior text,
    nivel_novo text,
    metodo text,
    confianca numeric(5,4),
    criterios jsonb,
    valores_incorporados jsonb,
    decisao text,
    rollback_possivel boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vinculo_audit_id_seq; Type: SEQUENCE; Schema: engenharia; Owner: -
--

CREATE SEQUENCE engenharia.vinculo_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vinculo_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: engenharia; Owner: -
--

ALTER SEQUENCE engenharia.vinculo_audit_id_seq OWNED BY engenharia.vinculo_audit.id;


--
-- Name: vw_projetos_mestre; Type: VIEW; Schema: engenharia; Owner: -
--

CREATE VIEW engenharia.vw_projetos_mestre AS
 SELECT ov.id AS registro_mestre_id,
    ov.titulo,
    ov.descricao AS descricao_obra,
    ov.status AS status_obra,
    ov.visivel,
    ov.fontes_encontradas,
    ov.quantidade_fontes,
    ov.campos_complementados,
    ov.conflitos_abertos,
    ov.completude,
    ov.confianca_consolidacao,
    ov.validada_em,
    ov.atualizado_em,
    vm_cc002.valor_mestre AS id_externo,
    vm_cc009.valor_mestre AS titulo_normalizado,
    vm_cc010.valor_mestre AS titulo_original,
    vm_cc011.valor_mestre AS descricao,
    vm_cc013.valor_mestre AS data_publicacao,
    vm_cc017.valor_mestre AS valor_capex,
    vm_cc018.valor_mestre AS valor_financiamento,
    vm_cc019.valor_mestre AS valor_referencia,
    vm_cc022.valor_mestre AS cnpj_contratante,
    vm_cc026.valor_mestre AS cnpj_executora,
    vm_cc028.valor_mestre AS cnpj_beneficiaria,
    vm_cc030.valor_mestre AS cnpj_requerente,
    vm_cc032.valor_mestre AS cnpj_concessionaria,
    vm_cc035.valor_mestre AS municipio_obra,
    vm_cc036.valor_mestre AS municipio_sede,
    vm_cc037.valor_mestre AS uf_obra,
    vm_cc038.valor_mestre AS uf_sede,
    vm_cc042.valor_mestre AS tipo_registro,
    vm_cc043.valor_mestre AS setor,
    vm_cc044.valor_mestre AS fase_normalizada
   FROM ((((((((((((((((((((engenharia.obras_validadas ov
     LEFT JOIN engenharia.valores_mestre vm_cc002 ON (((vm_cc002.grupo_id = ov.grupo_id) AND (vm_cc002.campo_canonico_id = 'CC-002'::text))))
     LEFT JOIN engenharia.valores_mestre vm_cc009 ON (((vm_cc009.grupo_id = ov.grupo_id) AND (vm_cc009.campo_canonico_id = 'CC-009'::text))))
     LEFT JOIN engenharia.valores_mestre vm_cc010 ON (((vm_cc010.grupo_id = ov.grupo_id) AND (vm_cc010.campo_canonico_id = 'CC-010'::text))))
     LEFT JOIN engenharia.valores_mestre vm_cc011 ON (((vm_cc011.grupo_id = ov.grupo_id) AND (vm_cc011.campo_canonico_id = 'CC-011'::text))))
     LEFT JOIN engenharia.valores_mestre vm_cc013 ON (((vm_cc013.grupo_id = ov.grupo_id) AND (vm_cc013.campo_canonico_id = 'CC-013'::text))))
     LEFT JOIN engenharia.valores_mestre vm_cc017 ON (((vm_cc017.grupo_id = ov.grupo_id) AND (vm_cc017.campo_canonico_id = 'CC-017'::text))))
     LEFT JOIN engenharia.valores_mestre vm_cc018 ON (((vm_cc018.grupo_id = ov.grupo_id) AND (vm_cc018.campo_canonico_id = 'CC-018'::text))))
     LEFT JOIN engenharia.valores_mestre vm_cc019 ON (((vm_cc019.grupo_id = ov.grupo_id) AND (vm_cc019.campo_canonico_id = 'CC-019'::text))))
     LEFT JOIN engenharia.valores_mestre vm_cc022 ON (((vm_cc022.grupo_id = ov.grupo_id) AND (vm_cc022.campo_canonico_id = 'CC-022'::text))))
     LEFT JOIN engenharia.valores_mestre vm_cc026 ON (((vm_cc026.grupo_id = ov.grupo_id) AND (vm_cc026.campo_canonico_id = 'CC-026'::text))))
     LEFT JOIN engenharia.valores_mestre vm_cc028 ON (((vm_cc028.grupo_id = ov.grupo_id) AND (vm_cc028.campo_canonico_id = 'CC-028'::text))))
     LEFT JOIN engenharia.valores_mestre vm_cc030 ON (((vm_cc030.grupo_id = ov.grupo_id) AND (vm_cc030.campo_canonico_id = 'CC-030'::text))))
     LEFT JOIN engenharia.valores_mestre vm_cc032 ON (((vm_cc032.grupo_id = ov.grupo_id) AND (vm_cc032.campo_canonico_id = 'CC-032'::text))))
     LEFT JOIN engenharia.valores_mestre vm_cc035 ON (((vm_cc035.grupo_id = ov.grupo_id) AND (vm_cc035.campo_canonico_id = 'CC-035'::text))))
     LEFT JOIN engenharia.valores_mestre vm_cc036 ON (((vm_cc036.grupo_id = ov.grupo_id) AND (vm_cc036.campo_canonico_id = 'CC-036'::text))))
     LEFT JOIN engenharia.valores_mestre vm_cc037 ON (((vm_cc037.grupo_id = ov.grupo_id) AND (vm_cc037.campo_canonico_id = 'CC-037'::text))))
     LEFT JOIN engenharia.valores_mestre vm_cc038 ON (((vm_cc038.grupo_id = ov.grupo_id) AND (vm_cc038.campo_canonico_id = 'CC-038'::text))))
     LEFT JOIN engenharia.valores_mestre vm_cc042 ON (((vm_cc042.grupo_id = ov.grupo_id) AND (vm_cc042.campo_canonico_id = 'CC-042'::text))))
     LEFT JOIN engenharia.valores_mestre vm_cc043 ON (((vm_cc043.grupo_id = ov.grupo_id) AND (vm_cc043.campo_canonico_id = 'CC-043'::text))))
     LEFT JOIN engenharia.valores_mestre vm_cc044 ON (((vm_cc044.grupo_id = ov.grupo_id) AND (vm_cc044.campo_canonico_id = 'CC-044'::text))));


--
-- Name: VIEW vw_projetos_mestre; Type: COMMENT; Schema: engenharia; Owner: -
--

COMMENT ON VIEW engenharia.vw_projetos_mestre IS 'Projecao dos 57 campos canonicos para registros mestres';


--
-- Name: whatsapp_conversas; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.whatsapp_conversas (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    numero text NOT NULL,
    instancia text NOT NULL,
    role text NOT NULL,
    mensagem text NOT NULL,
    criado_em timestamp with time zone DEFAULT now(),
    CONSTRAINT whatsapp_conversas_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text])))
);


--
-- Name: whatsapp_estado; Type: TABLE; Schema: engenharia; Owner: -
--

CREATE TABLE engenharia.whatsapp_estado (
    numero text NOT NULL,
    passo text,
    dados jsonb DEFAULT '{}'::jsonb NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now()
);


--
-- Name: admin_audit_log id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.admin_audit_log ALTER COLUMN id SET DEFAULT nextval('engenharia.admin_audit_log_id_seq'::regclass);


--
-- Name: audit_updates id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.audit_updates ALTER COLUMN id SET DEFAULT nextval('engenharia.audit_updates_id_seq'::regclass);


--
-- Name: auto_match_buscas id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.auto_match_buscas ALTER COLUMN id SET DEFAULT nextval('engenharia.auto_match_buscas_id_seq'::regclass);


--
-- Name: bronze_enrich_audit id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.bronze_enrich_audit ALTER COLUMN id SET DEFAULT nextval('engenharia.bronze_enrich_audit_id_seq'::regclass);


--
-- Name: canais_cadastro_empresa id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.canais_cadastro_empresa ALTER COLUMN id SET DEFAULT nextval('engenharia.canais_cadastro_empresa_id_seq'::regclass);


--
-- Name: captadores id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.captadores ALTER COLUMN id SET DEFAULT nextval('engenharia.captadores_id_seq'::regclass);


--
-- Name: categorias_servico id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.categorias_servico ALTER COLUMN id SET DEFAULT nextval('engenharia.categorias_servico_id_seq'::regclass);


--
-- Name: conflitos id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.conflitos ALTER COLUMN id SET DEFAULT nextval('engenharia.conflitos_id_seq'::regclass);


--
-- Name: contatos_alternativos id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.contatos_alternativos ALTER COLUMN id SET DEFAULT nextval('engenharia.contatos_alternativos_id_seq'::regclass);


--
-- Name: decisores_cache id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.decisores_cache ALTER COLUMN id SET DEFAULT nextval('engenharia.decisores_cache_id_seq'::regclass);


--
-- Name: decisores_preservados id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.decisores_preservados ALTER COLUMN id SET DEFAULT nextval('engenharia.decisores_preservados_id_seq'::regclass);


--
-- Name: empresa_decisores_cache id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.empresa_decisores_cache ALTER COLUMN id SET DEFAULT nextval('engenharia.empresa_decisores_cache_id_seq'::regclass);


--
-- Name: enrichment_gap_audit id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.enrichment_gap_audit ALTER COLUMN id SET DEFAULT nextval('engenharia.enrichment_gap_audit_id_seq'::regclass);


--
-- Name: enrichment_lookup_log id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.enrichment_lookup_log ALTER COLUMN id SET DEFAULT nextval('engenharia.enrichment_lookup_log_id_seq'::regclass);


--
-- Name: enrichment_queue id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.enrichment_queue ALTER COLUMN id SET DEFAULT nextval('engenharia.enrichment_queue_id_seq'::regclass);


--
-- Name: evidencias id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.evidencias ALTER COLUMN id SET DEFAULT nextval('engenharia.evidencias_id_seq'::regclass);


--
-- Name: fontes id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.fontes ALTER COLUMN id SET DEFAULT nextval('engenharia.fontes_id_seq'::regclass);


--
-- Name: historico_empresa id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.historico_empresa ALTER COLUMN id SET DEFAULT nextval('engenharia.historico_empresa_id_seq'::regclass);


--
-- Name: historico_empresa_ano id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.historico_empresa_ano ALTER COLUMN id SET DEFAULT nextval('engenharia.historico_empresa_ano_id_seq'::regclass);


--
-- Name: import_audit id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.import_audit ALTER COLUMN id SET DEFAULT nextval('engenharia.import_audit_id_seq'::regclass);


--
-- Name: mapeamentos_campos id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.mapeamentos_campos ALTER COLUMN id SET DEFAULT nextval('engenharia.mapeamentos_campos_id_seq'::regclass);


--
-- Name: matches_cadeia_fornecedor id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.matches_cadeia_fornecedor ALTER COLUMN id SET DEFAULT nextval('engenharia.matches_cadeia_fornecedor_id_seq'::regclass);


--
-- Name: matches_cadeia_obra id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.matches_cadeia_obra ALTER COLUMN id SET DEFAULT nextval('engenharia.matches_cadeia_obra_id_seq'::regclass);


--
-- Name: matches_empresa id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.matches_empresa ALTER COLUMN id SET DEFAULT nextval('engenharia.matches_empresa_id_seq'::regclass);


--
-- Name: matches_necessidade_fornecedor id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.matches_necessidade_fornecedor ALTER COLUMN id SET DEFAULT nextval('engenharia.matches_necessidade_fornecedor_id_seq'::regclass);


--
-- Name: noticias_backlog_manual id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.noticias_backlog_manual ALTER COLUMN id SET DEFAULT nextval('engenharia.noticias_backlog_manual_id_seq'::regclass);


--
-- Name: obra_checks id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.obra_checks ALTER COLUMN id SET DEFAULT nextval('engenharia.obra_checks_id_seq'::regclass);


--
-- Name: obras_atualizacoes_log id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.obras_atualizacoes_log ALTER COLUMN id SET DEFAULT nextval('engenharia.obras_atualizacoes_log_id_seq'::regclass);


--
-- Name: operacoes_recentes id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.operacoes_recentes ALTER COLUMN id SET DEFAULT nextval('engenharia.operacoes_recentes_id_seq'::regclass);


--
-- Name: ouro_enrichment_quality_audit id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.ouro_enrichment_quality_audit ALTER COLUMN id SET DEFAULT nextval('engenharia.ouro_enrichment_quality_audit_id_seq'::regclass);


--
-- Name: outreach_drafts id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.outreach_drafts ALTER COLUMN id SET DEFAULT nextval('engenharia.outreach_drafts_id_seq'::regclass);


--
-- Name: pipeline_falhas id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.pipeline_falhas ALTER COLUMN id SET DEFAULT nextval('engenharia.pipeline_falhas_id_seq'::regclass);


--
-- Name: pipeline_inbox id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.pipeline_inbox ALTER COLUMN id SET DEFAULT nextval('engenharia.pipeline_inbox_id_seq'::regclass);


--
-- Name: pipeline_obras_log id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.pipeline_obras_log ALTER COLUMN id SET DEFAULT nextval('engenharia.pipeline_obras_log_id_seq'::regclass);


--
-- Name: pipeline_origem_reclass_audit id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.pipeline_origem_reclass_audit ALTER COLUMN id SET DEFAULT nextval('engenharia.pipeline_origem_reclass_audit_id_seq'::regclass);


--
-- Name: plano_alteracoes_suspeitas id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.plano_alteracoes_suspeitas ALTER COLUMN id SET DEFAULT nextval('engenharia.plano_alteracoes_suspeitas_id_seq'::regclass);


--
-- Name: planos_pricing id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.planos_pricing ALTER COLUMN id SET DEFAULT nextval('engenharia.planos_pricing_id_seq'::regclass);


--
-- Name: portao_decisoes id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.portao_decisoes ALTER COLUMN id SET DEFAULT nextval('engenharia.portao_decisoes_id_seq'::regclass);


--
-- Name: portao_fila id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.portao_fila ALTER COLUMN id SET DEFAULT nextval('engenharia.portao_fila_id_seq'::regclass);


--
-- Name: portao_rollback_historico id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.portao_rollback_historico ALTER COLUMN id SET DEFAULT nextval('engenharia.portao_rollback_historico_id_seq'::regclass);


--
-- Name: portao_snapshot_pre_historico snapshot_id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.portao_snapshot_pre_historico ALTER COLUMN snapshot_id SET DEFAULT nextval('engenharia.portao_snapshot_pre_historico_snapshot_id_seq'::regclass);


--
-- Name: prata_external_enrich_audit id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.prata_external_enrich_audit ALTER COLUMN id SET DEFAULT nextval('engenharia.prata_external_enrich_audit_id_seq'::regclass);


--
-- Name: quota_snapshots id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.quota_snapshots ALTER COLUMN id SET DEFAULT nextval('engenharia.quota_snapshots_id_seq'::regclass);


--
-- Name: regras_prioridade_campos id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.regras_prioridade_campos ALTER COLUMN id SET DEFAULT nextval('engenharia.regras_prioridade_campos_id_seq'::regclass);


--
-- Name: resumo_empresa_wins id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.resumo_empresa_wins ALTER COLUMN id SET DEFAULT nextval('engenharia.resumo_empresa_wins_id_seq'::regclass);


--
-- Name: setor_categorias id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.setor_categorias ALTER COLUMN id SET DEFAULT nextval('engenharia.setor_categorias_id_seq'::regclass);


--
-- Name: setor_cnae_compatibility id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.setor_cnae_compatibility ALTER COLUMN id SET DEFAULT nextval('engenharia.setor_cnae_compatibility_id_seq'::regclass);


--
-- Name: sinais_oportunidade id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.sinais_oportunidade ALTER COLUMN id SET DEFAULT nextval('engenharia.sinais_oportunidade_id_seq'::regclass);


--
-- Name: tier_coerencia_audit id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.tier_coerencia_audit ALTER COLUMN id SET DEFAULT nextval('engenharia.tier_coerencia_audit_id_seq'::regclass);


--
-- Name: tier_ouro_regra_final_audit id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.tier_ouro_regra_final_audit ALTER COLUMN id SET DEFAULT nextval('engenharia.tier_ouro_regra_final_audit_id_seq'::regclass);


--
-- Name: v8_chromium_results id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.v8_chromium_results ALTER COLUMN id SET DEFAULT nextval('engenharia.v8_chromium_results_id_seq'::regclass);


--
-- Name: vinculo_audit id; Type: DEFAULT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.vinculo_audit ALTER COLUMN id SET DEFAULT nextval('engenharia.vinculo_audit_id_seq'::regclass);


--
-- Name: acessos_log acessos_log_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.acessos_log
    ADD CONSTRAINT acessos_log_pkey PRIMARY KEY (id);


--
-- Name: admin_audit_log admin_audit_log_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.admin_audit_log
    ADD CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id);


--
-- Name: alertas_enviados alertas_enviados_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.alertas_enviados
    ADD CONSTRAINT alertas_enviados_pkey PRIMARY KEY (id);


--
-- Name: alertas_preferencias alertas_preferencias_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.alertas_preferencias
    ADD CONSTRAINT alertas_preferencias_pkey PRIMARY KEY (prestador_id);


--
-- Name: audit_updates audit_updates_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.audit_updates
    ADD CONSTRAINT audit_updates_pkey PRIMARY KEY (id);


--
-- Name: auditoria_consolidacao auditoria_consolidacao_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.auditoria_consolidacao
    ADD CONSTRAINT auditoria_consolidacao_pkey PRIMARY KEY (id);


--
-- Name: auditoria_portao auditoria_portao_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.auditoria_portao
    ADD CONSTRAINT auditoria_portao_pkey PRIMARY KEY (id);


--
-- Name: auto_match_buscas auto_match_buscas_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.auto_match_buscas
    ADD CONSTRAINT auto_match_buscas_pkey PRIMARY KEY (id);


--
-- Name: brasilapi_cache brasilapi_cache_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.brasilapi_cache
    ADD CONSTRAINT brasilapi_cache_pkey PRIMARY KEY (cnpj);


--
-- Name: bronze_enrich_audit bronze_enrich_audit_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.bronze_enrich_audit
    ADD CONSTRAINT bronze_enrich_audit_pkey PRIMARY KEY (id);


--
-- Name: bronze_enrich_rollback bronze_enrich_rollback_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.bronze_enrich_rollback
    ADD CONSTRAINT bronze_enrich_rollback_pkey PRIMARY KEY (obra_id);


--
-- Name: bronze_enrich_snapshot bronze_enrich_snapshot_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.bronze_enrich_snapshot
    ADD CONSTRAINT bronze_enrich_snapshot_pkey PRIMARY KEY (obra_id);


--
-- Name: cache_brasilapi cache_brasilapi_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.cache_brasilapi
    ADD CONSTRAINT cache_brasilapi_pkey PRIMARY KEY (cnpj);


--
-- Name: campos_canonicos campos_canonicos_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.campos_canonicos
    ADD CONSTRAINT campos_canonicos_pkey PRIMARY KEY (id);


--
-- Name: canais_cadastro_empresa canais_cadastro_empresa_empresa_nome_canal_url_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.canais_cadastro_empresa
    ADD CONSTRAINT canais_cadastro_empresa_empresa_nome_canal_url_key UNIQUE (empresa_nome, canal_url);


--
-- Name: canais_cadastro_empresa canais_cadastro_empresa_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.canais_cadastro_empresa
    ADD CONSTRAINT canais_cadastro_empresa_pkey PRIMARY KEY (id);


--
-- Name: candidatos_industrial candidatos_industrial_link_hash_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.candidatos_industrial
    ADD CONSTRAINT candidatos_industrial_link_hash_key UNIQUE (link_hash);


--
-- Name: candidatos_industrial candidatos_industrial_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.candidatos_industrial
    ADD CONSTRAINT candidatos_industrial_pkey PRIMARY KEY (id);


--
-- Name: candidatos_projeto candidatos_projeto_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.candidatos_projeto
    ADD CONSTRAINT candidatos_projeto_pkey PRIMARY KEY (id);


--
-- Name: captadores captadores_nome_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.captadores
    ADD CONSTRAINT captadores_nome_key UNIQUE (nome);


--
-- Name: captadores captadores_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.captadores
    ADD CONSTRAINT captadores_pkey PRIMARY KEY (id);


--
-- Name: captura_entidades captura_entidades_captura_bruta_id_entidade_id_papel_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.captura_entidades
    ADD CONSTRAINT captura_entidades_captura_bruta_id_entidade_id_papel_key UNIQUE (captura_bruta_id, entidade_id, papel);


--
-- Name: captura_entidades captura_entidades_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.captura_entidades
    ADD CONSTRAINT captura_entidades_pkey PRIMARY KEY (id);


--
-- Name: capturas_brutas capturas_brutas_captador_id_hash_conteudo_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.capturas_brutas
    ADD CONSTRAINT capturas_brutas_captador_id_hash_conteudo_key UNIQUE (captador_id, hash_conteudo);


--
-- Name: capturas_brutas capturas_brutas_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.capturas_brutas
    ADD CONSTRAINT capturas_brutas_pkey PRIMARY KEY (id);


--
-- Name: capturas_versoes capturas_versoes_captura_bruta_id_hash_novo_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.capturas_versoes
    ADD CONSTRAINT capturas_versoes_captura_bruta_id_hash_novo_key UNIQUE (captura_bruta_id, hash_novo);


--
-- Name: capturas_versoes capturas_versoes_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.capturas_versoes
    ADD CONSTRAINT capturas_versoes_pkey PRIMARY KEY (id);


--
-- Name: categorias_servico categorias_servico_codigo_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.categorias_servico
    ADD CONSTRAINT categorias_servico_codigo_key UNIQUE (codigo);


--
-- Name: categorias_servico categorias_servico_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.categorias_servico
    ADD CONSTRAINT categorias_servico_pkey PRIMARY KEY (id);


--
-- Name: cnae_oficial cnae_oficial_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.cnae_oficial
    ADD CONSTRAINT cnae_oficial_pkey PRIMARY KEY (codigo);


--
-- Name: cnpj_grupo cnpj_grupo_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.cnpj_grupo
    ADD CONSTRAINT cnpj_grupo_pkey PRIMARY KEY (cnpj, grupo_id);


--
-- Name: comissoes comissoes_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.comissoes
    ADD CONSTRAINT comissoes_pkey PRIMARY KEY (id);


--
-- Name: conflitos_campos conflitos_campos_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.conflitos_campos
    ADD CONSTRAINT conflitos_campos_pkey PRIMARY KEY (id);


--
-- Name: conflitos conflitos_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.conflitos
    ADD CONSTRAINT conflitos_pkey PRIMARY KEY (id);


--
-- Name: contatos_alternativos contatos_alternativos_email_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.contatos_alternativos
    ADD CONSTRAINT contatos_alternativos_email_key UNIQUE (email);


--
-- Name: contatos_alternativos contatos_alternativos_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.contatos_alternativos
    ADD CONSTRAINT contatos_alternativos_pkey PRIMARY KEY (id);


--
-- Name: contatos_log contatos_log_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.contatos_log
    ADD CONSTRAINT contatos_log_pkey PRIMARY KEY (id);


--
-- Name: correspondencias_capturas correspondencias_capturas_captura_a_id_captura_b_id_regra_a_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.correspondencias_capturas
    ADD CONSTRAINT correspondencias_capturas_captura_a_id_captura_b_id_regra_a_key UNIQUE (captura_a_id, captura_b_id, regra_aplicada);


--
-- Name: correspondencias_capturas correspondencias_capturas_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.correspondencias_capturas
    ADD CONSTRAINT correspondencias_capturas_pkey PRIMARY KEY (id);


--
-- Name: decisor_jobs decisor_jobs_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.decisor_jobs
    ADD CONSTRAINT decisor_jobs_pkey PRIMARY KEY (job_id);


--
-- Name: decisores_cache decisores_cache_cnpj_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.decisores_cache
    ADD CONSTRAINT decisores_cache_cnpj_key UNIQUE (cnpj);


--
-- Name: decisores_cache decisores_cache_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.decisores_cache
    ADD CONSTRAINT decisores_cache_pkey PRIMARY KEY (id);


--
-- Name: decisores_empresa_alvo decisores_empresa_alvo_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.decisores_empresa_alvo
    ADD CONSTRAINT decisores_empresa_alvo_pkey PRIMARY KEY (id);


--
-- Name: decisores_obra decisores_obra_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.decisores_obra
    ADD CONSTRAINT decisores_obra_pkey PRIMARY KEY (id);


--
-- Name: decisores decisores_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.decisores
    ADD CONSTRAINT decisores_pkey PRIMARY KEY (id);


--
-- Name: decisores_preservados decisores_preservados_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.decisores_preservados
    ADD CONSTRAINT decisores_preservados_pkey PRIMARY KEY (id);


--
-- Name: desbloqueios desbloqueios_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.desbloqueios
    ADD CONSTRAINT desbloqueios_pkey PRIMARY KEY (id);


--
-- Name: desbloqueios_plano desbloqueios_plano_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.desbloqueios_plano
    ADD CONSTRAINT desbloqueios_plano_pkey PRIMARY KEY (id);


--
-- Name: desbloqueios_plano desbloqueios_plano_prestador_id_mes_ref_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.desbloqueios_plano
    ADD CONSTRAINT desbloqueios_plano_prestador_id_mes_ref_key UNIQUE (prestador_id, mes_ref);


--
-- Name: documentos documentos_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.documentos
    ADD CONSTRAINT documentos_pkey PRIMARY KEY (id);


--
-- Name: email_validacao_cache email_validacao_cache_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.email_validacao_cache
    ADD CONSTRAINT email_validacao_cache_pkey PRIMARY KEY (email);


--
-- Name: email_validation_cache email_validation_cache_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.email_validation_cache
    ADD CONSTRAINT email_validation_cache_pkey PRIMARY KEY (email);


--
-- Name: empresa_decisores_cache empresa_decisores_cache_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.empresa_decisores_cache
    ADD CONSTRAINT empresa_decisores_cache_pkey PRIMARY KEY (id);


--
-- Name: empresa_dominios empresa_dominios_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.empresa_dominios
    ADD CONSTRAINT empresa_dominios_pkey PRIMARY KEY (cnpj);


--
-- Name: empresa_dossier_cache empresa_dossier_cache_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.empresa_dossier_cache
    ADD CONSTRAINT empresa_dossier_cache_pkey PRIMARY KEY (cnpj);


--
-- Name: empresa_email_pattern_cache empresa_email_pattern_cache_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.empresa_email_pattern_cache
    ADD CONSTRAINT empresa_email_pattern_cache_pkey PRIMARY KEY (dominio);


--
-- Name: empresa_intel empresa_intel_cnpj_dominio_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.empresa_intel
    ADD CONSTRAINT empresa_intel_cnpj_dominio_key UNIQUE (cnpj, dominio);


--
-- Name: empresa_intel empresa_intel_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.empresa_intel
    ADD CONSTRAINT empresa_intel_pkey PRIMARY KEY (id);


--
-- Name: empresas_clientes empresas_clientes_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.empresas_clientes
    ADD CONSTRAINT empresas_clientes_pkey PRIMARY KEY (cnpj);


--
-- Name: enrichment_gap_audit enrichment_gap_audit_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.enrichment_gap_audit
    ADD CONSTRAINT enrichment_gap_audit_pkey PRIMARY KEY (id);


--
-- Name: enrichment_gap_matrix enrichment_gap_matrix_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.enrichment_gap_matrix
    ADD CONSTRAINT enrichment_gap_matrix_pkey PRIMARY KEY (obra_id);


--
-- Name: enrichment_gap_snapshot enrichment_gap_snapshot_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.enrichment_gap_snapshot
    ADD CONSTRAINT enrichment_gap_snapshot_pkey PRIMARY KEY (obra_id);


--
-- Name: enrichment_lookup_log enrichment_lookup_log_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.enrichment_lookup_log
    ADD CONSTRAINT enrichment_lookup_log_pkey PRIMARY KEY (id);


--
-- Name: enrichment_queue enrichment_queue_obra_id_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.enrichment_queue
    ADD CONSTRAINT enrichment_queue_obra_id_key UNIQUE (obra_id);


--
-- Name: enrichment_queue enrichment_queue_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.enrichment_queue
    ADD CONSTRAINT enrichment_queue_pkey PRIMARY KEY (id);


--
-- Name: enriquecimento_log enriquecimento_log_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.enriquecimento_log
    ADD CONSTRAINT enriquecimento_log_pkey PRIMARY KEY (id);


--
-- Name: entidade_decisores entidade_decisores_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.entidade_decisores
    ADD CONSTRAINT entidade_decisores_pkey PRIMARY KEY (entidade_id, decisor_id);


--
-- Name: entidades entidades_cnpj_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.entidades
    ADD CONSTRAINT entidades_cnpj_key UNIQUE (cnpj);


--
-- Name: entidades entidades_cpf_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.entidades
    ADD CONSTRAINT entidades_cpf_key UNIQUE (cpf);


--
-- Name: entidades_lookup entidades_lookup_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.entidades_lookup
    ADD CONSTRAINT entidades_lookup_pkey PRIMARY KEY (entidade_id);


--
-- Name: entidades entidades_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.entidades
    ADD CONSTRAINT entidades_pkey PRIMARY KEY (id);


--
-- Name: eventos_pipeline eventos_pipeline_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.eventos_pipeline
    ADD CONSTRAINT eventos_pipeline_pkey PRIMARY KEY (id);


--
-- Name: evidencias_campos evidencias_campos_captura_bruta_id_campo_canonico_id_caminh_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.evidencias_campos
    ADD CONSTRAINT evidencias_campos_captura_bruta_id_campo_canonico_id_caminh_key UNIQUE (captura_bruta_id, campo_canonico_id, caminho_origem);


--
-- Name: evidencias_campos evidencias_campos_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.evidencias_campos
    ADD CONSTRAINT evidencias_campos_pkey PRIMARY KEY (id);


--
-- Name: evidencias evidencias_evidencia_hash_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.evidencias
    ADD CONSTRAINT evidencias_evidencia_hash_key UNIQUE (evidencia_hash);


--
-- Name: evidencias evidencias_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.evidencias
    ADD CONSTRAINT evidencias_pkey PRIMARY KEY (id);


--
-- Name: fila_prospeccao fila_prospeccao_fornecedor_cnpj_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.fila_prospeccao
    ADD CONSTRAINT fila_prospeccao_fornecedor_cnpj_key UNIQUE (fornecedor_cnpj);


--
-- Name: fila_prospeccao fila_prospeccao_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.fila_prospeccao
    ADD CONSTRAINT fila_prospeccao_pkey PRIMARY KEY (id);


--
-- Name: fontes fontes_nome_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.fontes
    ADD CONSTRAINT fontes_nome_key UNIQUE (nome);


--
-- Name: fontes fontes_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.fontes
    ADD CONSTRAINT fontes_pkey PRIMARY KEY (id);


--
-- Name: fornecedor_meta fornecedor_meta_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.fornecedor_meta
    ADD CONSTRAINT fornecedor_meta_pkey PRIMARY KEY (cnpj);


--
-- Name: fornecedores fornecedores_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.fornecedores
    ADD CONSTRAINT fornecedores_pkey PRIMARY KEY (cnpj);


--
-- Name: grupo_capturas grupo_capturas_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.grupo_capturas
    ADD CONSTRAINT grupo_capturas_pkey PRIMARY KEY (grupo_id, captura_bruta_id);


--
-- Name: grupo grupo_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.grupo
    ADD CONSTRAINT grupo_pkey PRIMARY KEY (id);


--
-- Name: grupos_consolidados grupos_consolidados_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.grupos_consolidados
    ADD CONSTRAINT grupos_consolidados_pkey PRIMARY KEY (id);


--
-- Name: historico_empresa_ano historico_empresa_ano_batch_id_cliente_chave_ano_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.historico_empresa_ano
    ADD CONSTRAINT historico_empresa_ano_batch_id_cliente_chave_ano_key UNIQUE (batch_id, cliente_chave, ano);


--
-- Name: historico_empresa_ano historico_empresa_ano_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.historico_empresa_ano
    ADD CONSTRAINT historico_empresa_ano_pkey PRIMARY KEY (id);


--
-- Name: historico_empresa historico_empresa_batch_id_cliente_chave_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.historico_empresa
    ADD CONSTRAINT historico_empresa_batch_id_cliente_chave_key UNIQUE (batch_id, cliente_chave);


--
-- Name: historico_empresa historico_empresa_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.historico_empresa
    ADD CONSTRAINT historico_empresa_pkey PRIMARY KEY (id);


--
-- Name: identificadores identificadores_namespace_valor_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.identificadores
    ADD CONSTRAINT identificadores_namespace_valor_key UNIQUE (namespace, valor);


--
-- Name: identificadores identificadores_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.identificadores
    ADD CONSTRAINT identificadores_pkey PRIMARY KEY (id);


--
-- Name: import_audit import_audit_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.import_audit
    ADD CONSTRAINT import_audit_pkey PRIMARY KEY (id);


--
-- Name: importacoes importacoes_batch_id_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.importacoes
    ADD CONSTRAINT importacoes_batch_id_key UNIQUE (batch_id);


--
-- Name: importacoes importacoes_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.importacoes
    ADD CONSTRAINT importacoes_pkey PRIMARY KEY (id);


--
-- Name: interacoes interacoes_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.interacoes
    ADD CONSTRAINT interacoes_pkey PRIMARY KEY (id);


--
-- Name: leads_outbound leads_outbound_pdf_token_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.leads_outbound
    ADD CONSTRAINT leads_outbound_pdf_token_key UNIQUE (pdf_token);


--
-- Name: leads_outbound leads_outbound_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.leads_outbound
    ADD CONSTRAINT leads_outbound_pkey PRIMARY KEY (id);


--
-- Name: localizacoes localizacoes_captura_bruta_id_tipo_localizacao_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.localizacoes
    ADD CONSTRAINT localizacoes_captura_bruta_id_tipo_localizacao_key UNIQUE (captura_bruta_id, tipo_localizacao);


--
-- Name: localizacoes localizacoes_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.localizacoes
    ADD CONSTRAINT localizacoes_pkey PRIMARY KEY (id);


--
-- Name: log_captacao log_captacao_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.log_captacao
    ADD CONSTRAINT log_captacao_pkey PRIMARY KEY (id);


--
-- Name: mapeamentos_campos mapeamentos_campos_captador_origem_caminho_original_campo_c_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.mapeamentos_campos
    ADD CONSTRAINT mapeamentos_campos_captador_origem_caminho_original_campo_c_key UNIQUE (captador_origem, caminho_original, campo_canonico_id);


--
-- Name: mapeamentos_campos mapeamentos_campos_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.mapeamentos_campos
    ADD CONSTRAINT mapeamentos_campos_pkey PRIMARY KEY (id);


--
-- Name: matches_cadeia_fornecedor matches_cadeia_fornecedor_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.matches_cadeia_fornecedor
    ADD CONSTRAINT matches_cadeia_fornecedor_pkey PRIMARY KEY (id);


--
-- Name: matches_cadeia_obra matches_cadeia_obra_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.matches_cadeia_obra
    ADD CONSTRAINT matches_cadeia_obra_pkey PRIMARY KEY (id);


--
-- Name: matches_empresa matches_empresa_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.matches_empresa
    ADD CONSTRAINT matches_empresa_pkey PRIMARY KEY (id);


--
-- Name: matches_necessidade_fornecedor matches_necessidade_fornecedor_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.matches_necessidade_fornecedor
    ADD CONSTRAINT matches_necessidade_fornecedor_pkey PRIMARY KEY (id);


--
-- Name: matches_v2 matches_v2_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.matches_v2
    ADD CONSTRAINT matches_v2_pkey PRIMARY KEY (obra_id, cnpj);


--
-- Name: matchmaker_jobs matchmaker_jobs_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.matchmaker_jobs
    ADD CONSTRAINT matchmaker_jobs_pkey PRIMARY KEY (id);


--
-- Name: municipios_ibge municipios_ibge_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.municipios_ibge
    ADD CONSTRAINT municipios_ibge_pkey PRIMARY KEY (codigo_ibge);


--
-- Name: municipios_rfb municipios_rfb_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.municipios_rfb
    ADD CONSTRAINT municipios_rfb_pkey PRIMARY KEY (codigo_rfb);


--
-- Name: newsletter_subscribers newsletter_subscribers_email_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.newsletter_subscribers
    ADD CONSTRAINT newsletter_subscribers_email_key UNIQUE (email);


--
-- Name: newsletter_subscribers newsletter_subscribers_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.newsletter_subscribers
    ADD CONSTRAINT newsletter_subscribers_pkey PRIMARY KEY (id);


--
-- Name: noticias_backlog_manual noticias_backlog_manual_fonte_nome_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.noticias_backlog_manual
    ADD CONSTRAINT noticias_backlog_manual_fonte_nome_key UNIQUE (fonte_nome);


--
-- Name: noticias_backlog_manual noticias_backlog_manual_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.noticias_backlog_manual
    ADD CONSTRAINT noticias_backlog_manual_pkey PRIMARY KEY (id);


--
-- Name: noticias_processadas noticias_processadas_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.noticias_processadas
    ADD CONSTRAINT noticias_processadas_pkey PRIMARY KEY (hash);


--
-- Name: obra_checks obra_checks_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.obra_checks
    ADD CONSTRAINT obra_checks_pkey PRIMARY KEY (id);


--
-- Name: obra_decisores obra_decisores_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.obra_decisores
    ADD CONSTRAINT obra_decisores_pkey PRIMARY KEY (obra_id, decisor_id);


--
-- Name: obras_atualizacoes_log obras_atualizacoes_log_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.obras_atualizacoes_log
    ADD CONSTRAINT obras_atualizacoes_log_pkey PRIMARY KEY (id);


--
-- Name: obras obras_id_externo_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.obras
    ADD CONSTRAINT obras_id_externo_key UNIQUE (id_externo);


--
-- Name: obras_impacto_economico obras_impacto_economico_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.obras_impacto_economico
    ADD CONSTRAINT obras_impacto_economico_pkey PRIMARY KEY (obra_id);


--
-- Name: obras obras_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.obras
    ADD CONSTRAINT obras_pkey PRIMARY KEY (id);


--
-- Name: obras_validadas obras_validadas_candidato_projeto_id_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.obras_validadas
    ADD CONSTRAINT obras_validadas_candidato_projeto_id_key UNIQUE (candidato_projeto_id);


--
-- Name: obras_validadas obras_validadas_grupo_id_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.obras_validadas
    ADD CONSTRAINT obras_validadas_grupo_id_key UNIQUE (grupo_id);


--
-- Name: obras_validadas obras_validadas_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.obras_validadas
    ADD CONSTRAINT obras_validadas_pkey PRIMARY KEY (id);


--
-- Name: operacoes_recentes operacoes_recentes_batch_id_cliente_chave_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.operacoes_recentes
    ADD CONSTRAINT operacoes_recentes_batch_id_cliente_chave_key UNIQUE (batch_id, cliente_chave);


--
-- Name: operacoes_recentes operacoes_recentes_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.operacoes_recentes
    ADD CONSTRAINT operacoes_recentes_pkey PRIMARY KEY (id);


--
-- Name: ouro_enrichment_quality_audit ouro_enrichment_quality_audit_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.ouro_enrichment_quality_audit
    ADD CONSTRAINT ouro_enrichment_quality_audit_pkey PRIMARY KEY (id);


--
-- Name: ouro_quality_snapshot ouro_quality_snapshot_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.ouro_quality_snapshot
    ADD CONSTRAINT ouro_quality_snapshot_pkey PRIMARY KEY (obra_id);


--
-- Name: outreach_drafts outreach_drafts_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.outreach_drafts
    ADD CONSTRAINT outreach_drafts_pkey PRIMARY KEY (id);


--
-- Name: pagamentos pagamentos_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.pagamentos
    ADD CONSTRAINT pagamentos_pkey PRIMARY KEY (id);


--
-- Name: password_resets password_resets_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.password_resets
    ADD CONSTRAINT password_resets_pkey PRIMARY KEY (id);


--
-- Name: password_resets password_resets_token_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.password_resets
    ADD CONSTRAINT password_resets_token_key UNIQUE (token);


--
-- Name: pipeline_falhas pipeline_falhas_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.pipeline_falhas
    ADD CONSTRAINT pipeline_falhas_pkey PRIMARY KEY (id);


--
-- Name: pipeline_inbox pipeline_inbox_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.pipeline_inbox
    ADD CONSTRAINT pipeline_inbox_pkey PRIMARY KEY (id);


--
-- Name: pipeline_obras_log pipeline_obras_log_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.pipeline_obras_log
    ADD CONSTRAINT pipeline_obras_log_pkey PRIMARY KEY (id);


--
-- Name: pipeline_origem_reclass_audit pipeline_origem_reclass_audit_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.pipeline_origem_reclass_audit
    ADD CONSTRAINT pipeline_origem_reclass_audit_pkey PRIMARY KEY (id);


--
-- Name: plano_alteracoes_suspeitas plano_alteracoes_suspeitas_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.plano_alteracoes_suspeitas
    ADD CONSTRAINT plano_alteracoes_suspeitas_pkey PRIMARY KEY (id);


--
-- Name: planos_pricing planos_pricing_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.planos_pricing
    ADD CONSTRAINT planos_pricing_pkey PRIMARY KEY (id);


--
-- Name: planos_pricing planos_pricing_plano_periodo_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.planos_pricing
    ADD CONSTRAINT planos_pricing_plano_periodo_key UNIQUE (plano, periodo);


--
-- Name: portao_config portao_config_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.portao_config
    ADD CONSTRAINT portao_config_pkey PRIMARY KEY (chave);


--
-- Name: portao_decisoes portao_decisoes_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.portao_decisoes
    ADD CONSTRAINT portao_decisoes_pkey PRIMARY KEY (id);


--
-- Name: portao_fila portao_fila_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.portao_fila
    ADD CONSTRAINT portao_fila_pkey PRIMARY KEY (id);


--
-- Name: portao_rollback_historico portao_rollback_historico_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.portao_rollback_historico
    ADD CONSTRAINT portao_rollback_historico_pkey PRIMARY KEY (id);


--
-- Name: portao_snapshot_pre_historico portao_snapshot_pre_historico_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.portao_snapshot_pre_historico
    ADD CONSTRAINT portao_snapshot_pre_historico_pkey PRIMARY KEY (snapshot_id);


--
-- Name: prata_external_enrich_audit prata_external_enrich_audit_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.prata_external_enrich_audit
    ADD CONSTRAINT prata_external_enrich_audit_pkey PRIMARY KEY (id);


--
-- Name: prata_external_enrich_snapshot prata_external_enrich_snapshot_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.prata_external_enrich_snapshot
    ADD CONSTRAINT prata_external_enrich_snapshot_pkey PRIMARY KEY (obra_id);


--
-- Name: prata_segmentacao prata_segmentacao_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.prata_segmentacao
    ADD CONSTRAINT prata_segmentacao_pkey PRIMARY KEY (obra_id);


--
-- Name: prestador_empresas prestador_empresas_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.prestador_empresas
    ADD CONSTRAINT prestador_empresas_pkey PRIMARY KEY (id);


--
-- Name: prestador_empresas prestador_empresas_prestador_id_cnpj_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.prestador_empresas
    ADD CONSTRAINT prestador_empresas_prestador_id_cnpj_key UNIQUE (prestador_id, cnpj);


--
-- Name: prestadores prestadores_cnpj_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.prestadores
    ADD CONSTRAINT prestadores_cnpj_key UNIQUE (cnpj);


--
-- Name: prestadores prestadores_codigo_convite_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.prestadores
    ADD CONSTRAINT prestadores_codigo_convite_key UNIQUE (codigo_convite);


--
-- Name: prestadores prestadores_email_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.prestadores
    ADD CONSTRAINT prestadores_email_key UNIQUE (email);


--
-- Name: prestadores prestadores_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.prestadores
    ADD CONSTRAINT prestadores_pkey PRIMARY KEY (id);


--
-- Name: primeiro_acesso_tokens primeiro_acesso_tokens_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.primeiro_acesso_tokens
    ADD CONSTRAINT primeiro_acesso_tokens_pkey PRIMARY KEY (id);


--
-- Name: primeiro_acesso_tokens primeiro_acesso_tokens_token_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.primeiro_acesso_tokens
    ADD CONSTRAINT primeiro_acesso_tokens_token_key UNIQUE (token);


--
-- Name: quota_snapshots quota_snapshots_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.quota_snapshots
    ADD CONSTRAINT quota_snapshots_pkey PRIMARY KEY (id);


--
-- Name: regras_prioridade_campos regras_prioridade_campos_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.regras_prioridade_campos
    ADD CONSTRAINT regras_prioridade_campos_pkey PRIMARY KEY (id);


--
-- Name: resumo_empresa_wins resumo_empresa_wins_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.resumo_empresa_wins
    ADD CONSTRAINT resumo_empresa_wins_pkey PRIMARY KEY (id);


--
-- Name: sc_decisor_fase1_log sc_decisor_fase1_log_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.sc_decisor_fase1_log
    ADD CONSTRAINT sc_decisor_fase1_log_pkey PRIMARY KEY (cnpj);


--
-- Name: setor_categorias setor_categorias_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.setor_categorias
    ADD CONSTRAINT setor_categorias_pkey PRIMARY KEY (id);


--
-- Name: setor_categorias setor_categorias_setor_categoria_id_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.setor_categorias
    ADD CONSTRAINT setor_categorias_setor_categoria_id_key UNIQUE (setor, categoria_id);


--
-- Name: setor_cnae_compatibility setor_cnae_compatibility_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.setor_cnae_compatibility
    ADD CONSTRAINT setor_cnae_compatibility_pkey PRIMARY KEY (id);


--
-- Name: setor_cnae_compatibility setor_cnae_compatibility_setor_obra_cnae_codigo_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.setor_cnae_compatibility
    ADD CONSTRAINT setor_cnae_compatibility_setor_obra_cnae_codigo_key UNIQUE (setor_obra, cnae_codigo);


--
-- Name: sinais_oportunidade sinais_oportunidade_batch_id_cliente_chave_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.sinais_oportunidade
    ADD CONSTRAINT sinais_oportunidade_batch_id_cliente_chave_key UNIQUE (batch_id, cliente_chave);


--
-- Name: sinais_oportunidade sinais_oportunidade_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.sinais_oportunidade
    ADD CONSTRAINT sinais_oportunidade_pkey PRIMARY KEY (id);


--
-- Name: tier_coerencia_audit tier_coerencia_audit_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.tier_coerencia_audit
    ADD CONSTRAINT tier_coerencia_audit_pkey PRIMARY KEY (id);


--
-- Name: tier_ouro_regra_final_audit tier_ouro_regra_final_audit_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.tier_ouro_regra_final_audit
    ADD CONSTRAINT tier_ouro_regra_final_audit_pkey PRIMARY KEY (id);


--
-- Name: tier_ouro_regra_final_snapshot tier_ouro_regra_final_snapshot_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.tier_ouro_regra_final_snapshot
    ADD CONSTRAINT tier_ouro_regra_final_snapshot_pkey PRIMARY KEY (obra_id);


--
-- Name: uf_proximidade uf_proximidade_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.uf_proximidade
    ADD CONSTRAINT uf_proximidade_pkey PRIMARY KEY (uf_obra, uf_fornec);


--
-- Name: ufs_vizinhas ufs_vizinhas_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.ufs_vizinhas
    ADD CONSTRAINT ufs_vizinhas_pkey PRIMARY KEY (uf, uf_vizinha);


--
-- Name: urls_fonte_validacao urls_fonte_validacao_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.urls_fonte_validacao
    ADD CONSTRAINT urls_fonte_validacao_pkey PRIMARY KEY (url_fonte);


--
-- Name: v8_chromium_results v8_chromium_results_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.v8_chromium_results
    ADD CONSTRAINT v8_chromium_results_pkey PRIMARY KEY (id);


--
-- Name: valores_mestre valores_mestre_grupo_id_campo_canonico_id_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.valores_mestre
    ADD CONSTRAINT valores_mestre_grupo_id_campo_canonico_id_key UNIQUE (grupo_id, campo_canonico_id);


--
-- Name: valores_mestre valores_mestre_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.valores_mestre
    ADD CONSTRAINT valores_mestre_pkey PRIMARY KEY (id);


--
-- Name: valores_monetarios valores_monetarios_captura_bruta_id_tipo_valor_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.valores_monetarios
    ADD CONSTRAINT valores_monetarios_captura_bruta_id_tipo_valor_key UNIQUE (captura_bruta_id, tipo_valor);


--
-- Name: valores_monetarios valores_monetarios_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.valores_monetarios
    ADD CONSTRAINT valores_monetarios_pkey PRIMARY KEY (id);


--
-- Name: valores_normalizados valores_normalizados_captura_bruta_id_campo_canonico_id_cam_key; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.valores_normalizados
    ADD CONSTRAINT valores_normalizados_captura_bruta_id_campo_canonico_id_cam_key UNIQUE (captura_bruta_id, campo_canonico_id, campo_origem);


--
-- Name: valores_normalizados valores_normalizados_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.valores_normalizados
    ADD CONSTRAINT valores_normalizados_pkey PRIMARY KEY (id);


--
-- Name: vinculo_audit vinculo_audit_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.vinculo_audit
    ADD CONSTRAINT vinculo_audit_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_conversas whatsapp_conversas_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.whatsapp_conversas
    ADD CONSTRAINT whatsapp_conversas_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_estado whatsapp_estado_pkey; Type: CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.whatsapp_estado
    ADD CONSTRAINT whatsapp_estado_pkey PRIMARY KEY (numero);


--
-- Name: decisor_jobs_user_atualizado_idx; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX decisor_jobs_user_atualizado_idx ON engenharia.decisor_jobs USING btree (user_id, atualizado_em DESC);


--
-- Name: fornecedor_matches_summary_cnpj_idx; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE UNIQUE INDEX fornecedor_matches_summary_cnpj_idx ON engenharia.fornecedor_matches_summary USING btree (cnpj);


--
-- Name: idx_acessos_log_criado; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_acessos_log_criado ON engenharia.acessos_log USING btree (criado_em DESC);


--
-- Name: idx_acessos_log_prestador; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_acessos_log_prestador ON engenharia.acessos_log USING btree (prestador_id, criado_em DESC);


--
-- Name: idx_admin_audit_path; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_admin_audit_path ON engenharia.admin_audit_log USING btree (path);


--
-- Name: idx_admin_audit_ts; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_admin_audit_ts ON engenharia.admin_audit_log USING btree (ts DESC);


--
-- Name: idx_alertas_prestador; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_alertas_prestador ON engenharia.alertas_enviados USING btree (prestador_id, enviado_em DESC);


--
-- Name: idx_auditoria_consolidacao_grupo; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_auditoria_consolidacao_grupo ON engenharia.auditoria_consolidacao USING btree (grupo_id);


--
-- Name: idx_auditoria_portao_decisao; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_auditoria_portao_decisao ON engenharia.auditoria_portao USING btree (decisao);


--
-- Name: idx_auto_match_buscas_prestador; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_auto_match_buscas_prestador ON engenharia.auto_match_buscas USING btree (prestador_id, debitado_em DESC);


--
-- Name: idx_bndes_he_batch; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_bndes_he_batch ON engenharia.historico_empresa USING btree (batch_id);


--
-- Name: idx_bndes_he_frag; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_bndes_he_frag ON engenharia.historico_empresa USING btree (cnpj_fragmento_digitos);


--
-- Name: idx_bndes_he_nome; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_bndes_he_nome ON engenharia.historico_empresa USING btree (nome_sem_natureza);


--
-- Name: idx_bndes_match_batch_nivel; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_bndes_match_batch_nivel ON engenharia.matches_empresa USING btree (batch_id, nivel);


--
-- Name: idx_bndes_match_obra; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_bndes_match_obra ON engenharia.matches_empresa USING btree (obra_id) WHERE (obra_id IS NOT NULL);


--
-- Name: idx_bndes_resumo_obra; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_bndes_resumo_obra ON engenharia.resumo_empresa_wins USING btree (obra_id) WHERE publicado;


--
-- Name: idx_bndes_sinais_status; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_bndes_sinais_status ON engenharia.sinais_oportunidade USING btree (batch_id, status);


--
-- Name: idx_bronze_enrich_audit_obra; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_bronze_enrich_audit_obra ON engenharia.bronze_enrich_audit USING btree (obra_id);


--
-- Name: idx_cache_brasilapi_expira; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_cache_brasilapi_expira ON engenharia.cache_brasilapi USING btree (expira_em);


--
-- Name: idx_canais_ativo; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_canais_ativo ON engenharia.canais_cadastro_empresa USING btree (ativo);


--
-- Name: idx_canais_cnpj; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_canais_cnpj ON engenharia.canais_cadastro_empresa USING btree (empresa_cnpj);


--
-- Name: idx_canais_empresa; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_canais_empresa ON engenharia.canais_cadastro_empresa USING btree (empresa_nome);


--
-- Name: idx_candidatos_industrial_setor_alvo; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_candidatos_industrial_setor_alvo ON engenharia.candidatos_industrial USING btree (setor_alvo);


--
-- Name: idx_candidatos_industrial_status; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_candidatos_industrial_status ON engenharia.candidatos_industrial USING btree (status);


--
-- Name: idx_captura_entidades_ent; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_captura_entidades_ent ON engenharia.captura_entidades USING btree (entidade_id);


--
-- Name: idx_captura_entidades_papel; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_captura_entidades_papel ON engenharia.captura_entidades USING btree (papel);


--
-- Name: idx_capturas_brutas_captador; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_capturas_brutas_captador ON engenharia.capturas_brutas USING btree (captador_id);


--
-- Name: idx_capturas_brutas_externo; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_capturas_brutas_externo ON engenharia.capturas_brutas USING btree (id_externo);


--
-- Name: idx_capturas_brutas_fonte; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_capturas_brutas_fonte ON engenharia.capturas_brutas USING btree (fonte_id);


--
-- Name: idx_capturas_brutas_id_externo_ns; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_capturas_brutas_id_externo_ns ON engenharia.capturas_brutas USING btree (fonte_id, namespace, id_externo);


--
-- Name: idx_capturas_brutas_status; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_capturas_brutas_status ON engenharia.capturas_brutas USING btree (status);


--
-- Name: idx_capturas_brutas_v1_obra; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_capturas_brutas_v1_obra ON engenharia.capturas_brutas USING btree (v1_obra_id) WHERE (v1_obra_id IS NOT NULL);


--
-- Name: idx_categorias_ativo; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_categorias_ativo ON engenharia.categorias_servico USING btree (ativo);


--
-- Name: idx_categorias_cnaes; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_categorias_cnaes ON engenharia.categorias_servico USING gin (cnaes);


--
-- Name: idx_categorias_codigo; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_categorias_codigo ON engenharia.categorias_servico USING btree (codigo);


--
-- Name: idx_cnae_oficial_codigo; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_cnae_oficial_codigo ON engenharia.cnae_oficial USING btree (codigo);


--
-- Name: idx_cnaes_interesse; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE UNIQUE INDEX idx_cnaes_interesse ON engenharia.cnaes_interesse USING btree (cnae);


--
-- Name: idx_cnpj_grupo_cnpj; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_cnpj_grupo_cnpj ON engenharia.cnpj_grupo USING btree (cnpj);


--
-- Name: idx_cnpj_grupo_grupo_id; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_cnpj_grupo_grupo_id ON engenharia.cnpj_grupo USING btree (grupo_id);


--
-- Name: idx_cnpj_grupo_papel; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_cnpj_grupo_papel ON engenharia.cnpj_grupo USING btree (papel);


--
-- Name: idx_comissoes_disponivel; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_comissoes_disponivel ON engenharia.comissoes USING btree (disponivel_em) WHERE ((status)::text = 'pendente'::text);


--
-- Name: idx_comissoes_rep_status; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_comissoes_rep_status ON engenharia.comissoes USING btree (representante_id, status);


--
-- Name: idx_comissoes_status; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_comissoes_status ON engenharia.comissoes USING btree (status);


--
-- Name: idx_conflitos_campo; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_conflitos_campo ON engenharia.conflitos_campos USING btree (campo_canonico_id);


--
-- Name: idx_conflitos_estado; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_conflitos_estado ON engenharia.conflitos_campos USING btree (estado);


--
-- Name: idx_conflitos_grupo; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_conflitos_grupo ON engenharia.conflitos_campos USING btree (grupo_id);


--
-- Name: idx_contatos_alt_cnpj; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_contatos_alt_cnpj ON engenharia.contatos_alternativos USING btree (cnpj);


--
-- Name: idx_contatos_alt_dominio; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_contatos_alt_dominio ON engenharia.contatos_alternativos USING btree (empresa_dominio);


--
-- Name: idx_contatos_log_cnpj; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_contatos_log_cnpj ON engenharia.contatos_log USING btree (cnpj_destino);


--
-- Name: idx_contatos_log_enviado; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_contatos_log_enviado ON engenharia.contatos_log USING btree (enviado_em);


--
-- Name: idx_contatos_log_obra; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_contatos_log_obra ON engenharia.contatos_log USING btree (obra_id);


--
-- Name: idx_contatos_obra; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_contatos_obra ON engenharia.contatos_log USING btree (obra_id, confirmado_pelo_decisor);


--
-- Name: idx_contatos_prestador; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_contatos_prestador ON engenharia.contatos_log USING btree (prestador_id, enviado_em DESC);


--
-- Name: idx_correspondencias_capt_a; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_correspondencias_capt_a ON engenharia.correspondencias_capturas USING btree (captura_a_id);


--
-- Name: idx_correspondencias_capt_b; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_correspondencias_capt_b ON engenharia.correspondencias_capturas USING btree (captura_b_id);


--
-- Name: idx_correspondencias_decisao; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_correspondencias_decisao ON engenharia.correspondencias_capturas USING btree (decisao);


--
-- Name: idx_correspondencias_nivel; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_correspondencias_nivel ON engenharia.correspondencias_capturas USING btree (nivel);


--
-- Name: idx_decisores_cache_cnpj; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_decisores_cache_cnpj ON engenharia.decisores_cache USING btree (cnpj);


--
-- Name: idx_decisores_cache_dominio; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_decisores_cache_dominio ON engenharia.decisores_cache USING btree (dominio);


--
-- Name: idx_decisores_cache_expira; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_decisores_cache_expira ON engenharia.decisores_cache USING btree (expira_em);


--
-- Name: idx_decisores_email_status; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_decisores_email_status ON engenharia.decisores_obra USING btree (email_status) WHERE (excluido_em IS NULL);


--
-- Name: idx_decisores_empresa_alvo_empresa; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_decisores_empresa_alvo_empresa ON engenharia.decisores_empresa_alvo USING btree (empresa_nome);


--
-- Name: idx_decisores_entidade; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_decisores_entidade ON engenharia.decisores USING btree (entidade_id);


--
-- Name: idx_decisores_obra; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_decisores_obra ON engenharia.decisores_obra USING btree (obra_id);


--
-- Name: idx_decisores_obra_nome_unico; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE UNIQUE INDEX idx_decisores_obra_nome_unico ON engenharia.decisores_obra USING btree (obra_id, nome) WHERE (excluido_em IS NULL);


--
-- Name: idx_decisores_qualidade; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_decisores_qualidade ON engenharia.decisores_obra USING btree (qualidade_lead) WHERE (excluido_em IS NULL);


--
-- Name: idx_decisores_tipo_cargo; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_decisores_tipo_cargo ON engenharia.decisores_obra USING btree (obra_id, tipo_cargo) WHERE (excluido_em IS NULL);


--
-- Name: idx_desbloqueios_prestador; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_desbloqueios_prestador ON engenharia.desbloqueios USING btree (prestador_id, criado_em DESC);


--
-- Name: idx_desbloqueios_unico; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE UNIQUE INDEX idx_desbloqueios_unico ON engenharia.desbloqueios USING btree (prestador_id, obra_id, cnpj_empresa);


--
-- Name: idx_dossier_cache_dominio; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_dossier_cache_dominio ON engenharia.empresa_dossier_cache USING btree ((((payload -> 'dominio_oficial'::text) ->> 'dominio'::text)));


--
-- Name: idx_dossier_cache_revalidacao; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_dossier_cache_revalidacao ON engenharia.empresa_dossier_cache USING btree (proxima_revalidacao);


--
-- Name: idx_email_val_cache_dominio; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_email_val_cache_dominio ON engenharia.email_validacao_cache USING btree (split_part(email, '@'::text, 2));


--
-- Name: idx_email_val_cache_revalidacao; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_email_val_cache_revalidacao ON engenharia.email_validacao_cache USING btree (proxima_revalidacao);


--
-- Name: idx_email_val_cache_status; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_email_val_cache_status ON engenharia.email_validacao_cache USING btree (status);


--
-- Name: idx_emp_clientes_porte; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_emp_clientes_porte ON engenharia.empresas_clientes USING btree (porte);


--
-- Name: idx_emp_clientes_uf; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_emp_clientes_uf ON engenharia.empresas_clientes USING btree (uf);


--
-- Name: idx_empresa_decisores_cnpj; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_empresa_decisores_cnpj ON engenharia.empresa_decisores_cache USING btree (cnpj) WHERE (excluido_em IS NULL);


--
-- Name: idx_empresa_decisores_cnpj_pessoa_uniq; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE UNIQUE INDEX idx_empresa_decisores_cnpj_pessoa_uniq ON engenharia.empresa_decisores_cache USING btree (cnpj, lower(engenharia.immutable_unaccent(nome_pessoa))) WHERE (excluido_em IS NULL);


--
-- Name: idx_empresa_decisores_confianca; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_empresa_decisores_confianca ON engenharia.empresa_decisores_cache USING btree (confianca) WHERE (excluido_em IS NULL);


--
-- Name: idx_empresa_decisores_email; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_empresa_decisores_email ON engenharia.empresa_decisores_cache USING btree (email) WHERE (email IS NOT NULL);


--
-- Name: idx_empresa_decisores_linkedin; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_empresa_decisores_linkedin ON engenharia.empresa_decisores_cache USING btree (linkedin_slug) WHERE (linkedin_slug IS NOT NULL);


--
-- Name: idx_empresa_decisores_revalidacao; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_empresa_decisores_revalidacao ON engenharia.empresa_decisores_cache USING btree (revalidacao) WHERE (excluido_em IS NULL);


--
-- Name: idx_empresa_decisores_tipo_cargo; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_empresa_decisores_tipo_cargo ON engenharia.empresa_decisores_cache USING btree (tipo_cargo) WHERE (excluido_em IS NULL);


--
-- Name: idx_empresa_dominios_confianca; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_empresa_dominios_confianca ON engenharia.empresa_dominios USING btree (confianca);


--
-- Name: idx_empresa_dominios_dominio; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_empresa_dominios_dominio ON engenharia.empresa_dominios USING btree (dominio);


--
-- Name: idx_empresa_dominios_fonte; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_empresa_dominios_fonte ON engenharia.empresa_dominios USING btree (fonte);


--
-- Name: idx_empresa_dominios_holding_cnpj; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_empresa_dominios_holding_cnpj ON engenharia.empresa_dominios USING btree (holding_cnpj);


--
-- Name: idx_empresa_intel_cnpj; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_empresa_intel_cnpj ON engenharia.empresa_intel USING btree (cnpj);


--
-- Name: idx_empresa_intel_data; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_empresa_intel_data ON engenharia.empresa_intel USING btree (coletado_em DESC);


--
-- Name: idx_empresa_intel_dominio; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_empresa_intel_dominio ON engenharia.empresa_intel USING btree (dominio);


--
-- Name: idx_empresa_intel_tags; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_empresa_intel_tags ON engenharia.empresa_intel USING gin (tags);


--
-- Name: idx_enq_obra; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_enq_obra ON engenharia.enrichment_queue USING btree (obra_id);


--
-- Name: idx_enq_status_capex; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_enq_status_capex ON engenharia.enrichment_queue USING btree (status, capex DESC);


--
-- Name: idx_enrich_gap_audit_obra; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_enrich_gap_audit_obra ON engenharia.enrichment_gap_audit USING btree (obra_id);


--
-- Name: idx_enrich_gap_matrix_prio; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_enrich_gap_matrix_prio ON engenharia.enrichment_gap_matrix USING btree (prioridade, tier_atual);


--
-- Name: idx_enriq_log_data; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_enriq_log_data ON engenharia.enriquecimento_log USING btree (criado_em DESC);


--
-- Name: idx_enriq_log_obra; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_enriq_log_obra ON engenharia.enriquecimento_log USING btree (obra_id);


--
-- Name: idx_entidades_cnpj; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_entidades_cnpj ON engenharia.entidades USING btree (cnpj);


--
-- Name: idx_entidades_lookup_cnpj; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE UNIQUE INDEX idx_entidades_lookup_cnpj ON engenharia.entidades_lookup USING btree (cnpj_normalizado);


--
-- Name: idx_eventos_status; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_eventos_status ON engenharia.eventos_pipeline USING btree (status);


--
-- Name: idx_fila_lote; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_fila_lote ON engenharia.fila_prospeccao USING btree (lote);


--
-- Name: idx_fila_rep_status; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_fila_rep_status ON engenharia.fila_prospeccao USING btree (rep_atribuido, status);


--
-- Name: idx_fila_status_digital; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_fila_status_digital ON engenharia.fila_prospeccao USING btree (status_digital);


--
-- Name: idx_forn_cnae_descricao_trgm; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_forn_cnae_descricao_trgm ON engenharia.fornecedores USING gin (cnae_descricao public.gin_trgm_ops) WHERE (situacao_cadastral = '02'::bpchar);


--
-- Name: idx_forn_cnae_mc; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_forn_cnae_mc ON engenharia.fornecedores USING btree (cnae_principal, matches_count DESC, cadastrado DESC, razao_social);


--
-- Name: idx_forn_cnae_principal; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_forn_cnae_principal ON engenharia.fornecedores USING btree (cnae_principal text_pattern_ops) WHERE (situacao_cadastral = '02'::bpchar);


--
-- Name: idx_forn_div_cap; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_forn_div_cap ON engenharia.fornecedores USING btree (divisao_cnae, capital_social DESC) WHERE (situacao_cadastral = '02'::bpchar);


--
-- Name: idx_forn_div_uf_cap; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_forn_div_uf_cap ON engenharia.fornecedores USING btree (divisao_cnae, uf, capital_social DESC) WHERE (situacao_cadastral = '02'::bpchar);


--
-- Name: idx_forn_mc; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_forn_mc ON engenharia.fornecedores USING btree (matches_count DESC, cadastrado DESC, razao_social);


--
-- Name: idx_forn_nome_fantasia_trgm; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_forn_nome_fantasia_trgm ON engenharia.fornecedores USING gin (nome_fantasia public.gin_trgm_ops) WHERE (situacao_cadastral = '02'::bpchar);


--
-- Name: idx_forn_porte_mc; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_forn_porte_mc ON engenharia.fornecedores USING btree (porte, matches_count DESC, cadastrado DESC, razao_social);


--
-- Name: idx_forn_razao_social_trgm; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_forn_razao_social_trgm ON engenharia.fornecedores USING gin (razao_social public.gin_trgm_ops) WHERE (situacao_cadastral = '02'::bpchar);


--
-- Name: idx_forn_search_matched; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_forn_search_matched ON engenharia.fornecedores USING gin ((((((COALESCE(razao_social, ''::text) || ' '::text) || COALESCE(nome_fantasia, ''::text)) || ' '::text) || COALESCE(cnae_descricao, ''::text))) public.gin_trgm_ops) WHERE (matches_count > 0);


--
-- Name: idx_forn_situacao_uf_cnpj; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_forn_situacao_uf_cnpj ON engenharia.fornecedores USING btree (situacao_cadastral, uf, cnpj) WHERE (situacao_cadastral = '02'::bpchar);


--
-- Name: idx_forn_situacao_uf_razao; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_forn_situacao_uf_razao ON engenharia.fornecedores USING btree (situacao_cadastral, uf, razao_social) WHERE (situacao_cadastral = '02'::bpchar);


--
-- Name: idx_forn_uf_mc; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_forn_uf_mc ON engenharia.fornecedores USING btree (uf, matches_count DESC, cadastrado DESC, razao_social);


--
-- Name: idx_fornecedor_meta_grupo_id; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_fornecedor_meta_grupo_id ON engenharia.fornecedor_meta USING btree (grupo_id);


--
-- Name: idx_fornecedor_meta_papel; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_fornecedor_meta_papel ON engenharia.fornecedor_meta USING btree (papel_wins_hub);


--
-- Name: idx_fornecedor_setores_cnpj; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_fornecedor_setores_cnpj ON engenharia.fornecedor_setores USING btree (cnpj);


--
-- Name: idx_fornecedores_cadastrado; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_fornecedores_cadastrado ON engenharia.fornecedores USING btree (cadastrado) WHERE (cadastrado = true);


--
-- Name: idx_fornecedores_cnae; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_fornecedores_cnae ON engenharia.fornecedores USING btree (cnae_principal);


--
-- Name: idx_fornecedores_cnae_sec; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_fornecedores_cnae_sec ON engenharia.fornecedores USING gin (cnae_secundarios);


--
-- Name: idx_fornecedores_cnpj_raiz; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_fornecedores_cnpj_raiz ON engenharia.fornecedores USING btree ("substring"(cnpj, 1, 8));


--
-- Name: idx_fornecedores_divisao_cnae; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_fornecedores_divisao_cnae ON engenharia.fornecedores USING btree (divisao_cnae) WHERE (divisao_cnae IS NOT NULL);


--
-- Name: idx_fornecedores_lower_razao_social; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_fornecedores_lower_razao_social ON engenharia.fornecedores USING btree (lower(razao_social));


--
-- Name: idx_fornecedores_lower_razao_social_pattern; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_fornecedores_lower_razao_social_pattern ON engenharia.fornecedores USING btree (lower(razao_social) varchar_pattern_ops);


--
-- Name: idx_fornecedores_municipio; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_fornecedores_municipio ON engenharia.fornecedores USING btree (municipio_ibge);


--
-- Name: idx_fornecedores_municipio_rfb; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_fornecedores_municipio_rfb ON engenharia.fornecedores USING btree (municipio_rfb);


--
-- Name: idx_fornecedores_porte_inferido; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_fornecedores_porte_inferido ON engenharia.fornecedores USING btree (porte_inferido);


--
-- Name: idx_fornecedores_search_trgm; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_fornecedores_search_trgm ON engenharia.fornecedores USING gin ((((((COALESCE(razao_social, ''::text) || ' '::text) || COALESCE(nome_fantasia, ''::text)) || ' '::text) || COALESCE(cnae_descricao, ''::text))) public.gin_trgm_ops);


--
-- Name: idx_fornecedores_situacao; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_fornecedores_situacao ON engenharia.fornecedores USING btree (situacao);


--
-- Name: idx_fornecedores_uf; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_fornecedores_uf ON engenharia.fornecedores USING btree (uf);


--
-- Name: idx_fornecedores_uf_porte_cnae; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_fornecedores_uf_porte_cnae ON engenharia.fornecedores USING btree (uf, porte_inferido, cnae_principal) WHERE (porte_inferido <> 'MICRO'::text);


--
-- Name: idx_fornecedores_usuario_id; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_fornecedores_usuario_id ON engenharia.fornecedores USING btree (usuario_id) WHERE (usuario_id IS NOT NULL);


--
-- Name: idx_fornsetor_setor; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_fornsetor_setor ON engenharia.fornecedor_setores USING btree (setor, cnpj);


--
-- Name: idx_grupo_capturas_capt; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_grupo_capturas_capt ON engenharia.grupo_capturas USING btree (captura_bruta_id);


--
-- Name: idx_grupo_capturas_grupo; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_grupo_capturas_grupo ON engenharia.grupo_capturas USING btree (grupo_id);


--
-- Name: idx_identificadores_capt; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_identificadores_capt ON engenharia.identificadores USING btree (captura_bruta_id);


--
-- Name: idx_identificadores_ns; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_identificadores_ns ON engenharia.identificadores USING btree (namespace, valor);


--
-- Name: idx_leads_outbound_rep; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_leads_outbound_rep ON engenharia.leads_outbound USING btree (representante_id);


--
-- Name: idx_leads_outbound_status; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_leads_outbound_status ON engenharia.leads_outbound USING btree (status);


--
-- Name: idx_leads_outbound_token; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_leads_outbound_token ON engenharia.leads_outbound USING btree (pdf_token);


--
-- Name: idx_localizacoes_capt; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_localizacoes_capt ON engenharia.localizacoes USING btree (captura_bruta_id);


--
-- Name: idx_lookup_log_cnpj; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_lookup_log_cnpj ON engenharia.enrichment_lookup_log USING btree (cnpj_normalizado);


--
-- Name: idx_lookup_log_cnpj_timestamp; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_lookup_log_cnpj_timestamp ON engenharia.enrichment_lookup_log USING btree (cnpj_normalizado, "timestamp" DESC);


--
-- Name: idx_lookup_log_contexto_timestamp; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_lookup_log_contexto_timestamp ON engenharia.enrichment_lookup_log USING btree (contexto, "timestamp" DESC);


--
-- Name: idx_lookup_log_external_timestamp; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_lookup_log_external_timestamp ON engenharia.enrichment_lookup_log USING btree (chamada_externa_executada, chamada_externa_evitada, "timestamp" DESC);


--
-- Name: idx_lookup_log_request_id; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_lookup_log_request_id ON engenharia.enrichment_lookup_log USING btree (request_id);


--
-- Name: idx_lookup_log_status_timestamp; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_lookup_log_status_timestamp ON engenharia.enrichment_lookup_log USING btree (status_lookup, "timestamp" DESC);


--
-- Name: idx_lookup_log_timestamp; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_lookup_log_timestamp ON engenharia.enrichment_lookup_log USING btree ("timestamp");


--
-- Name: idx_matches_v2_cnpj; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_matches_v2_cnpj ON engenharia.matches_v2 USING btree (cnpj);


--
-- Name: idx_matches_v2_cnpj_score_obra; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_matches_v2_cnpj_score_obra ON engenharia.matches_v2 USING btree (cnpj, score DESC, obra_id);


--
-- Name: idx_matches_v2_obra; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_matches_v2_obra ON engenharia.matches_v2 USING btree (obra_id);


--
-- Name: idx_matches_v2_score; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_matches_v2_score ON engenharia.matches_v2 USING btree (score DESC);


--
-- Name: idx_matchmaker_jobs_iniciado_em; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_matchmaker_jobs_iniciado_em ON engenharia.matchmaker_jobs USING btree (iniciado_em DESC);


--
-- Name: idx_matchmaker_jobs_status; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_matchmaker_jobs_status ON engenharia.matchmaker_jobs USING btree (status);


--
-- Name: idx_mcf_obra; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_mcf_obra ON engenharia.matches_cadeia_fornecedor USING btree (obra_id);


--
-- Name: idx_mco_div; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_mco_div ON engenharia.matches_cadeia_obra USING btree (cnae_insumo_div);


--
-- Name: idx_mco_obra; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_mco_obra ON engenharia.matches_cadeia_obra USING btree (obra_id);


--
-- Name: idx_mnf_obra; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_mnf_obra ON engenharia.matches_necessidade_fornecedor USING btree (obra_id);


--
-- Name: idx_municipios_nome; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_municipios_nome ON engenharia.municipios_ibge USING btree (lower(nome));


--
-- Name: idx_municipios_rfb_ibge; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_municipios_rfb_ibge ON engenharia.municipios_rfb USING btree (codigo_ibge);


--
-- Name: idx_municipios_uf; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_municipios_uf ON engenharia.municipios_ibge USING btree (uf);


--
-- Name: idx_mv_forn_facetas_tv; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE UNIQUE INDEX idx_mv_forn_facetas_tv ON engenharia.mv_fornecedores_facetas_global USING btree (tipo, valor);


--
-- Name: idx_mv_forn_lista_cnpj; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE UNIQUE INDEX idx_mv_forn_lista_cnpj ON engenharia.mv_fornecedores_lista_global USING btree (cnpj);


--
-- Name: idx_newsletter_envio; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_newsletter_envio ON engenharia.newsletter_subscribers USING btree (ativo, confirmado_em) WHERE ((ativo = true) AND (confirmado_em IS NOT NULL));


--
-- Name: idx_newsletter_token; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_newsletter_token ON engenharia.newsletter_subscribers USING btree (token_confirmacao);


--
-- Name: idx_noticias_fonte; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_noticias_fonte ON engenharia.noticias_processadas USING btree (fonte);


--
-- Name: idx_noticias_processado_em; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_noticias_processado_em ON engenharia.noticias_processadas USING btree (processado_em DESC);


--
-- Name: idx_obras_classificacao_computed; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_obras_classificacao_computed ON engenharia.obras USING btree (classificacao_computed) WHERE (classificacao_computed = ANY (ARRAY['OURO'::text, 'PRATA'::text]));


--
-- Name: idx_obras_empresa_trgm; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_obras_empresa_trgm ON engenharia.obras USING gin (empresa public.gin_trgm_ops);


--
-- Name: idx_obras_empresa_unaccent_trgm; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_obras_empresa_unaccent_trgm ON engenharia.obras USING gin (engenharia.immutable_unaccent_lower(empresa) public.gin_trgm_ops);


--
-- Name: idx_obras_fase; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_obras_fase ON engenharia.obras USING btree (fase);


--
-- Name: idx_obras_fonte_tipo; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_obras_fonte_tipo ON engenharia.obras USING btree (fonte_tipo);


--
-- Name: idx_obras_log_campo; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_obras_log_campo ON engenharia.obras_atualizacoes_log USING btree (campo);


--
-- Name: idx_obras_log_data; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_obras_log_data ON engenharia.obras_atualizacoes_log USING btree (atualizado_em DESC);


--
-- Name: idx_obras_log_obra; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_obras_log_obra ON engenharia.obras_atualizacoes_log USING btree (obra_id);


--
-- Name: idx_obras_motivo_invisivel; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_obras_motivo_invisivel ON engenharia.obras USING btree (motivo_invisivel) WHERE (motivo_invisivel IS NOT NULL);


--
-- Name: idx_obras_nome_trgm; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_obras_nome_trgm ON engenharia.obras USING gin (nome public.gin_trgm_ops);


--
-- Name: idx_obras_nome_unaccent_trgm; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_obras_nome_unaccent_trgm ON engenharia.obras USING gin (engenharia.immutable_unaccent_lower(nome) public.gin_trgm_ops);


--
-- Name: idx_obras_notificado; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_obras_notificado ON engenharia.obras USING btree (criado_em DESC) WHERE (notificado_em IS NULL);


--
-- Name: idx_obras_portao_visivel; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_obras_portao_visivel ON engenharia.obras USING btree (status_portao, visivel) WHERE (status_portao = 'APROVADA'::text);


--
-- Name: idx_obras_status_portao; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_obras_status_portao ON engenharia.obras USING btree (status_portao) WHERE (status_portao IS NOT NULL);


--
-- Name: idx_obras_uf; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_obras_uf ON engenharia.obras USING btree (uf);


--
-- Name: idx_obras_ultimo_enrichment_at; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_obras_ultimo_enrichment_at ON engenharia.obras USING btree (ultimo_enrichment_at DESC NULLS LAST) WHERE (ultimo_enrichment_status IS NOT NULL);


--
-- Name: idx_obras_url_fonte; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_obras_url_fonte ON engenharia.obras USING btree (url_fonte) WHERE (url_fonte IS NOT NULL);


--
-- Name: idx_obras_validacao_obra_at; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_obras_validacao_obra_at ON engenharia.obras USING btree (validacao_obra_at NULLS FIRST);


--
-- Name: idx_obras_validadas_status; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_obras_validadas_status ON engenharia.obras_validadas USING btree (status);


--
-- Name: idx_obras_visible_capex; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_obras_visible_capex ON engenharia.obras USING btree (valor_estimado DESC NULLS LAST) WHERE ((motivo_invisivel IS NULL) AND (empresa IS NOT NULL) AND (empresa <> ''::text));


--
-- Name: idx_ouro_quality_audit_decisao; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_ouro_quality_audit_decisao ON engenharia.ouro_enrichment_quality_audit USING btree (decisao);


--
-- Name: idx_ouro_quality_audit_obra; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_ouro_quality_audit_obra ON engenharia.ouro_enrichment_quality_audit USING btree (obra_id);


--
-- Name: idx_outreach_drafts_decisor; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_outreach_drafts_decisor ON engenharia.outreach_drafts USING btree (decisor_id);


--
-- Name: idx_outreach_drafts_status; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_outreach_drafts_status ON engenharia.outreach_drafts USING btree (status);


--
-- Name: idx_pagamentos_lead; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_pagamentos_lead ON engenharia.pagamentos USING btree (lead_outbound_id) WHERE (lead_outbound_id IS NOT NULL);


--
-- Name: idx_pagamentos_mp_preference; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_pagamentos_mp_preference ON engenharia.pagamentos USING btree (mp_preference_id) WHERE (mp_preference_id IS NOT NULL);


--
-- Name: idx_pagamentos_obra; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_pagamentos_obra ON engenharia.pagamentos USING btree (obra_id) WHERE (obra_id IS NOT NULL);


--
-- Name: idx_pagamentos_prestador; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_pagamentos_prestador ON engenharia.pagamentos USING btree (prestador_id, criado_em DESC);


--
-- Name: idx_password_resets_expires; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_password_resets_expires ON engenharia.password_resets USING btree (expires_at);


--
-- Name: idx_password_resets_token; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_password_resets_token ON engenharia.password_resets USING btree (token);


--
-- Name: idx_password_resets_user; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_password_resets_user ON engenharia.password_resets USING btree (user_id);


--
-- Name: idx_pattern_cache_confianca; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_pattern_cache_confianca ON engenharia.empresa_email_pattern_cache USING btree (confianca) WHERE ((confianca)::text = 'alta'::text);


--
-- Name: idx_pattern_cache_revalidacao; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_pattern_cache_revalidacao ON engenharia.empresa_email_pattern_cache USING btree (proxima_revalidacao);


--
-- Name: idx_pipeline_falhas_status; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_pipeline_falhas_status ON engenharia.pipeline_falhas USING btree (status, criado_em);


--
-- Name: idx_pipeline_inbox_status; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_pipeline_inbox_status ON engenharia.pipeline_inbox USING btree (status, criado_em);


--
-- Name: idx_pipeline_log_timestamp; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_pipeline_log_timestamp ON engenharia.pipeline_obras_log USING btree ("timestamp" DESC);


--
-- Name: idx_plano_susp_nao_alertado; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_plano_susp_nao_alertado ON engenharia.plano_alteracoes_suspeitas USING btree (id) WHERE (alertado_em IS NULL);


--
-- Name: idx_portao_decisoes_obra; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_portao_decisoes_obra ON engenharia.portao_decisoes USING btree (obra_id, criado_em DESC);


--
-- Name: idx_portao_decisoes_status; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_portao_decisoes_status ON engenharia.portao_decisoes USING btree (status_novo, criado_em DESC);


--
-- Name: idx_portao_fila_pendente; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_portao_fila_pendente ON engenharia.portao_fila USING btree (status, proxima_tentativa) WHERE (status = 'pendente'::text);


--
-- Name: idx_portao_rollback_obra; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_portao_rollback_obra ON engenharia.portao_rollback_historico USING btree (obra_id);


--
-- Name: idx_portao_snapshot_obra; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_portao_snapshot_obra ON engenharia.portao_snapshot_pre_historico USING btree (obra_id);


--
-- Name: idx_prata_ext_audit_obra; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_prata_ext_audit_obra ON engenharia.prata_external_enrich_audit USING btree (obra_id);


--
-- Name: idx_prata_seg_grupo; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_prata_seg_grupo ON engenharia.prata_segmentacao USING btree (grupo, prioridade);


--
-- Name: idx_prestador_empresas_cnpj; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_prestador_empresas_cnpj ON engenharia.prestador_empresas USING btree (cnpj) WHERE ativo;


--
-- Name: idx_prestador_empresas_prestador; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_prestador_empresas_prestador ON engenharia.prestador_empresas USING btree (prestador_id) WHERE ativo;


--
-- Name: idx_prestadores_avaliacao_pendente; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_prestadores_avaliacao_pendente ON engenharia.prestadores USING btree (periodo_avaliacao_fim) WHERE ((creditos_liberados_em IS NULL) AND (renunciou_avaliacao = false));


--
-- Name: idx_prestadores_email_token; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_prestadores_email_token ON engenharia.prestadores USING btree (email_token) WHERE (email_token IS NOT NULL);


--
-- Name: idx_prestadores_liberar_creditos; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_prestadores_liberar_creditos ON engenharia.prestadores USING btree (ciclo_inicio) WHERE ((renunciou_arrependimento = false) AND (creditos_liberados_em IS NULL) AND (ciclo_fim IS NOT NULL));


--
-- Name: idx_primeiro_acesso_prestador; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_primeiro_acesso_prestador ON engenharia.primeiro_acesso_tokens USING btree (prestador_id);


--
-- Name: idx_primeiro_acesso_token; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_primeiro_acesso_token ON engenharia.primeiro_acesso_tokens USING btree (token);


--
-- Name: idx_quota_snapshots_service_ts; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_quota_snapshots_service_ts ON engenharia.quota_snapshots USING btree (service, ts DESC);


--
-- Name: idx_scc_cnae; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_scc_cnae ON engenharia.setor_cnae_compatibility USING btree (cnae_codigo);


--
-- Name: idx_scc_setor; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_scc_setor ON engenharia.setor_cnae_compatibility USING btree (setor_obra);


--
-- Name: idx_setor_categorias_setor; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_setor_categorias_setor ON engenharia.setor_categorias USING btree (setor);


--
-- Name: idx_tier_coerencia_obra; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_tier_coerencia_obra ON engenharia.tier_coerencia_audit USING btree (obra_id);


--
-- Name: idx_tier_ouro_regra_final_audit_obra; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_tier_ouro_regra_final_audit_obra ON engenharia.tier_ouro_regra_final_audit USING btree (obra_id);


--
-- Name: idx_tier_ouro_regra_final_audit_ts; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_tier_ouro_regra_final_audit_ts ON engenharia.tier_ouro_regra_final_audit USING btree (criado_em DESC);


--
-- Name: idx_urls_fonte_proxima_revalidacao; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_urls_fonte_proxima_revalidacao ON engenharia.urls_fonte_validacao USING btree (proxima_revalidacao NULLS FIRST);


--
-- Name: idx_v8_cnpj_desc; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_v8_cnpj_desc ON engenharia.v8_chromium_results USING btree (cnpj_descoberto);


--
-- Name: idx_v8_input; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_v8_input ON engenharia.v8_chromium_results USING btree (razao_social_input);


--
-- Name: idx_valores_mestre_grupo; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_valores_mestre_grupo ON engenharia.valores_mestre USING btree (grupo_id);


--
-- Name: idx_valores_monetarios_capt; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_valores_monetarios_capt ON engenharia.valores_monetarios USING btree (captura_bruta_id);


--
-- Name: idx_valores_monetarios_tipo; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_valores_monetarios_tipo ON engenharia.valores_monetarios USING btree (tipo_valor);


--
-- Name: idx_valores_normalizados_capt; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_valores_normalizados_capt ON engenharia.valores_normalizados USING btree (captura_bruta_id);


--
-- Name: idx_valores_normalizados_cc; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_valores_normalizados_cc ON engenharia.valores_normalizados USING btree (campo_canonico_id);


--
-- Name: idx_whatsapp_conversas_numero; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX idx_whatsapp_conversas_numero ON engenharia.whatsapp_conversas USING btree (numero, criado_em DESC);


--
-- Name: ix_decisores_preservados_cnpj; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE INDEX ix_decisores_preservados_cnpj ON engenharia.decisores_preservados USING btree (cnpj);


--
-- Name: uq_bndes_match_batch_cli_target; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE UNIQUE INDEX uq_bndes_match_batch_cli_target ON engenharia.matches_empresa USING btree (batch_id, cliente_chave, target_tipo, COALESCE((obra_id)::text, ''::text), COALESCE((entidade_id)::text, ''::text), COALESCE(cnpj_conhecido, ''::text));


--
-- Name: uq_bndes_resumo_batch_cli_obra; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE UNIQUE INDEX uq_bndes_resumo_batch_cli_obra ON engenharia.resumo_empresa_wins USING btree (batch_id, cliente_chave, COALESCE((obra_id)::text, ''::text));


--
-- Name: uq_capturas_brutas_dedup; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE UNIQUE INDEX uq_capturas_brutas_dedup ON engenharia.capturas_brutas USING btree (fonte_id, namespace, id_externo, hash_conteudo) WHERE ((id_externo IS NOT NULL) AND (hash_conteudo IS NOT NULL));


--
-- Name: uq_comissoes_inicial_por_prestador; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE UNIQUE INDEX uq_comissoes_inicial_por_prestador ON engenharia.comissoes USING btree (prestador_id) WHERE ((tipo)::text = 'INICIAL'::text);


--
-- Name: uq_portao_fila_obra_pendente; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE UNIQUE INDEX uq_portao_fila_obra_pendente ON engenharia.portao_fila USING btree (obra_id) WHERE (status = ANY (ARRAY['pendente'::text, 'processando'::text]));


--
-- Name: ux_decisores_preservados_cnpj_nome; Type: INDEX; Schema: engenharia; Owner: -
--

CREATE UNIQUE INDEX ux_decisores_preservados_cnpj_nome ON engenharia.decisores_preservados USING btree (COALESCE(cnpj, ''::text), lower(TRIM(BOTH FROM nome)));


--
-- Name: prestadores audita_plano_sem_pagamento; Type: TRIGGER; Schema: engenharia; Owner: -
--

CREATE TRIGGER audita_plano_sem_pagamento AFTER INSERT OR UPDATE OF plano ON engenharia.prestadores FOR EACH ROW EXECUTE FUNCTION engenharia.trg_audita_plano_sem_pagamento();


--
-- Name: decisores_obra sync_classificacao_after_decisor; Type: TRIGGER; Schema: engenharia; Owner: -
--

CREATE TRIGGER sync_classificacao_after_decisor AFTER INSERT OR DELETE OR UPDATE ON engenharia.decisores_obra FOR EACH ROW EXECUTE FUNCTION engenharia.trg_sync_classificacao();


--
-- Name: decisores_obra tg_sanitizar_decisor; Type: TRIGGER; Schema: engenharia; Owner: -
--

CREATE TRIGGER tg_sanitizar_decisor BEFORE INSERT OR UPDATE ON engenharia.decisores_obra FOR EACH ROW EXECUTE FUNCTION engenharia.sanitizar_decisor();


--
-- Name: obras trg_autovalidar_oficial; Type: TRIGGER; Schema: engenharia; Owner: -
--

CREATE TRIGGER trg_autovalidar_oficial BEFORE INSERT ON engenharia.obras FOR EACH ROW EXECUTE FUNCTION engenharia.fn_autovalidar_oficial();


--
-- Name: decisores_cache trg_decisores_cache_atualizado_em; Type: TRIGGER; Schema: engenharia; Owner: -
--

CREATE TRIGGER trg_decisores_cache_atualizado_em BEFORE UPDATE ON engenharia.decisores_cache FOR EACH ROW EXECUTE FUNCTION engenharia.update_decisores_cache_atualizado_em();


--
-- Name: obras trg_detectar_cnpj_guarda_chuva; Type: TRIGGER; Schema: engenharia; Owner: -
--

CREATE TRIGGER trg_detectar_cnpj_guarda_chuva BEFORE INSERT OR UPDATE ON engenharia.obras FOR EACH ROW EXECUTE FUNCTION engenharia.fn_detectar_cnpj_guarda_chuva();


--
-- Name: empresa_decisores_cache trg_empresa_decisores_cache_atualizado_em; Type: TRIGGER; Schema: engenharia; Owner: -
--

CREATE TRIGGER trg_empresa_decisores_cache_atualizado_em BEFORE UPDATE ON engenharia.empresa_decisores_cache FOR EACH ROW EXECUTE FUNCTION engenharia.trg_empresa_decisores_cache_atualizado_em();


--
-- Name: empresa_dominios trg_empresa_dominios_atualizado_em; Type: TRIGGER; Schema: engenharia; Owner: -
--

CREATE TRIGGER trg_empresa_dominios_atualizado_em BEFORE UPDATE ON engenharia.empresa_dominios FOR EACH ROW EXECUTE FUNCTION engenharia.update_empresa_dominios_atualizado_em();


--
-- Name: obras trg_enqueue_enrichment; Type: TRIGGER; Schema: engenharia; Owner: -
--

CREATE TRIGGER trg_enqueue_enrichment AFTER INSERT ON engenharia.obras FOR EACH ROW EXECUTE FUNCTION engenharia.fn_enqueue_enrichment();


--
-- Name: decisores_obra trg_flip_noticia_to_manual; Type: TRIGGER; Schema: engenharia; Owner: -
--

CREATE TRIGGER trg_flip_noticia_to_manual AFTER INSERT OR UPDATE ON engenharia.decisores_obra FOR EACH ROW EXECUTE FUNCTION engenharia.fn_flip_noticia_to_manual_pos_enrich();


--
-- Name: obras trg_log_obras_changes; Type: TRIGGER; Schema: engenharia; Owner: -
--

CREATE TRIGGER trg_log_obras_changes AFTER UPDATE ON engenharia.obras FOR EACH ROW EXECUTE FUNCTION engenharia.log_obras_changes();


--
-- Name: obras trg_normalize_obras_setor; Type: TRIGGER; Schema: engenharia; Owner: -
--

CREATE TRIGGER trg_normalize_obras_setor BEFORE INSERT OR UPDATE OF setor ON engenharia.obras FOR EACH ROW EXECUTE FUNCTION engenharia.normalize_obras_setor();


--
-- Name: obras trg_obras_pipeline_inbox; Type: TRIGGER; Schema: engenharia; Owner: -
--

CREATE TRIGGER trg_obras_pipeline_inbox AFTER INSERT ON engenharia.obras FOR EACH ROW WHEN ((new.id_externo IS NOT NULL)) EXECUTE FUNCTION engenharia.trg_obras_pipeline_inbox();


--
-- Name: obras trg_portao_enfileirar; Type: TRIGGER; Schema: engenharia; Owner: -
--

CREATE TRIGGER trg_portao_enfileirar AFTER INSERT ON engenharia.obras FOR EACH ROW EXECUTE FUNCTION engenharia.fn_portao_enfileirar();


--
-- Name: obras trg_portao_nova_captura; Type: TRIGGER; Schema: engenharia; Owner: -
--

CREATE TRIGGER trg_portao_nova_captura BEFORE INSERT ON engenharia.obras FOR EACH ROW EXECUTE FUNCTION engenharia.fn_portao_nova_captura();


--
-- Name: decisores_obra trg_preservar_decisor; Type: TRIGGER; Schema: engenharia; Owner: -
--

CREATE TRIGGER trg_preservar_decisor AFTER INSERT OR UPDATE OF confianca_match, email, telefone, linkedin_url, excluido_em, nome ON engenharia.decisores_obra FOR EACH ROW EXECUTE FUNCTION engenharia.trg_preservar_decisor();


--
-- Name: obras trg_reuso_decisor_preservado; Type: TRIGGER; Schema: engenharia; Owner: -
--

CREATE TRIGGER trg_reuso_decisor_preservado AFTER INSERT ON engenharia.obras FOR EACH ROW EXECUTE FUNCTION engenharia.fn_reuso_decisor_preservado();


--
-- Name: obras trg_zerar_cnpj_invalido; Type: TRIGGER; Schema: engenharia; Owner: -
--

CREATE TRIGGER trg_zerar_cnpj_invalido BEFORE INSERT OR UPDATE ON engenharia.obras FOR EACH ROW EXECUTE FUNCTION engenharia.zerar_cnpj_invalido();


--
-- Name: obras trg_zz_classificar_obra_nova; Type: TRIGGER; Schema: engenharia; Owner: -
--

CREATE TRIGGER trg_zz_classificar_obra_nova AFTER INSERT ON engenharia.obras FOR EACH ROW EXECUTE FUNCTION engenharia.fn_classificar_obra_nova();


--
-- Name: acessos_log acessos_log_prestador_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.acessos_log
    ADD CONSTRAINT acessos_log_prestador_id_fkey FOREIGN KEY (prestador_id) REFERENCES engenharia.prestadores(id) ON DELETE SET NULL;


--
-- Name: alertas_enviados alertas_enviados_prestador_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.alertas_enviados
    ADD CONSTRAINT alertas_enviados_prestador_id_fkey FOREIGN KEY (prestador_id) REFERENCES engenharia.prestadores(id);


--
-- Name: alertas_preferencias alertas_preferencias_prestador_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.alertas_preferencias
    ADD CONSTRAINT alertas_preferencias_prestador_id_fkey FOREIGN KEY (prestador_id) REFERENCES engenharia.prestadores(id);


--
-- Name: auditoria_consolidacao auditoria_consolidacao_campo_canonico_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.auditoria_consolidacao
    ADD CONSTRAINT auditoria_consolidacao_campo_canonico_id_fkey FOREIGN KEY (campo_canonico_id) REFERENCES engenharia.campos_canonicos(id);


--
-- Name: auditoria_consolidacao auditoria_consolidacao_grupo_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.auditoria_consolidacao
    ADD CONSTRAINT auditoria_consolidacao_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES engenharia.grupos_consolidados(id);


--
-- Name: auditoria_portao auditoria_portao_candidato_projeto_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.auditoria_portao
    ADD CONSTRAINT auditoria_portao_candidato_projeto_id_fkey FOREIGN KEY (candidato_projeto_id) REFERENCES engenharia.candidatos_projeto(id);


--
-- Name: auditoria_portao auditoria_portao_grupo_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.auditoria_portao
    ADD CONSTRAINT auditoria_portao_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES engenharia.grupos_consolidados(id);


--
-- Name: auto_match_buscas auto_match_buscas_prestador_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.auto_match_buscas
    ADD CONSTRAINT auto_match_buscas_prestador_id_fkey FOREIGN KEY (prestador_id) REFERENCES engenharia.prestadores(id) ON DELETE CASCADE;


--
-- Name: candidatos_industrial candidatos_industrial_obra_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.candidatos_industrial
    ADD CONSTRAINT candidatos_industrial_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES engenharia.obras(id) ON DELETE SET NULL;


--
-- Name: candidatos_projeto candidatos_projeto_fonte_primaria_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.candidatos_projeto
    ADD CONSTRAINT candidatos_projeto_fonte_primaria_id_fkey FOREIGN KEY (fonte_primaria_id) REFERENCES engenharia.fontes(id);


--
-- Name: captadores captadores_fonte_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.captadores
    ADD CONSTRAINT captadores_fonte_id_fkey FOREIGN KEY (fonte_id) REFERENCES engenharia.fontes(id);


--
-- Name: captura_entidades captura_entidades_captura_bruta_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.captura_entidades
    ADD CONSTRAINT captura_entidades_captura_bruta_id_fkey FOREIGN KEY (captura_bruta_id) REFERENCES engenharia.capturas_brutas(id);


--
-- Name: captura_entidades captura_entidades_entidade_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.captura_entidades
    ADD CONSTRAINT captura_entidades_entidade_id_fkey FOREIGN KEY (entidade_id) REFERENCES engenharia.entidades(id);


--
-- Name: capturas_brutas capturas_brutas_captador_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.capturas_brutas
    ADD CONSTRAINT capturas_brutas_captador_id_fkey FOREIGN KEY (captador_id) REFERENCES engenharia.captadores(id);


--
-- Name: capturas_brutas capturas_brutas_fonte_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.capturas_brutas
    ADD CONSTRAINT capturas_brutas_fonte_id_fkey FOREIGN KEY (fonte_id) REFERENCES engenharia.fontes(id);


--
-- Name: capturas_versoes capturas_versoes_captura_bruta_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.capturas_versoes
    ADD CONSTRAINT capturas_versoes_captura_bruta_id_fkey FOREIGN KEY (captura_bruta_id) REFERENCES engenharia.capturas_brutas(id);


--
-- Name: cnpj_grupo cnpj_grupo_grupo_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.cnpj_grupo
    ADD CONSTRAINT cnpj_grupo_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES engenharia.grupo(id) ON DELETE CASCADE;


--
-- Name: comissoes comissoes_lead_outbound_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.comissoes
    ADD CONSTRAINT comissoes_lead_outbound_id_fkey FOREIGN KEY (lead_outbound_id) REFERENCES engenharia.leads_outbound(id);


--
-- Name: comissoes comissoes_prestador_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.comissoes
    ADD CONSTRAINT comissoes_prestador_id_fkey FOREIGN KEY (prestador_id) REFERENCES engenharia.prestadores(id);


--
-- Name: comissoes comissoes_representante_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.comissoes
    ADD CONSTRAINT comissoes_representante_id_fkey FOREIGN KEY (representante_id) REFERENCES engenharia.prestadores(id);


--
-- Name: conflitos_campos conflitos_campos_campo_canonico_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.conflitos_campos
    ADD CONSTRAINT conflitos_campos_campo_canonico_id_fkey FOREIGN KEY (campo_canonico_id) REFERENCES engenharia.campos_canonicos(id);


--
-- Name: conflitos_campos conflitos_campos_captura_a_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.conflitos_campos
    ADD CONSTRAINT conflitos_campos_captura_a_id_fkey FOREIGN KEY (captura_a_id) REFERENCES engenharia.capturas_brutas(id);


--
-- Name: conflitos_campos conflitos_campos_captura_b_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.conflitos_campos
    ADD CONSTRAINT conflitos_campos_captura_b_id_fkey FOREIGN KEY (captura_b_id) REFERENCES engenharia.capturas_brutas(id);


--
-- Name: conflitos_campos conflitos_campos_fonte_a_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.conflitos_campos
    ADD CONSTRAINT conflitos_campos_fonte_a_id_fkey FOREIGN KEY (fonte_a_id) REFERENCES engenharia.fontes(id);


--
-- Name: conflitos_campos conflitos_campos_fonte_b_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.conflitos_campos
    ADD CONSTRAINT conflitos_campos_fonte_b_id_fkey FOREIGN KEY (fonte_b_id) REFERENCES engenharia.fontes(id);


--
-- Name: conflitos_campos conflitos_campos_grupo_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.conflitos_campos
    ADD CONSTRAINT conflitos_campos_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES engenharia.grupos_consolidados(id);


--
-- Name: contatos_log contatos_log_obra_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.contatos_log
    ADD CONSTRAINT contatos_log_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES engenharia.obras(id);


--
-- Name: contatos_log contatos_log_prestador_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.contatos_log
    ADD CONSTRAINT contatos_log_prestador_id_fkey FOREIGN KEY (prestador_id) REFERENCES engenharia.prestadores(id);


--
-- Name: correspondencias_capturas correspondencias_capturas_captura_a_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.correspondencias_capturas
    ADD CONSTRAINT correspondencias_capturas_captura_a_id_fkey FOREIGN KEY (captura_a_id) REFERENCES engenharia.capturas_brutas(id);


--
-- Name: correspondencias_capturas correspondencias_capturas_captura_b_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.correspondencias_capturas
    ADD CONSTRAINT correspondencias_capturas_captura_b_id_fkey FOREIGN KEY (captura_b_id) REFERENCES engenharia.capturas_brutas(id);


--
-- Name: decisores decisores_entidade_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.decisores
    ADD CONSTRAINT decisores_entidade_id_fkey FOREIGN KEY (entidade_id) REFERENCES engenharia.entidades(id);


--
-- Name: decisores_obra decisores_obra_obra_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.decisores_obra
    ADD CONSTRAINT decisores_obra_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES engenharia.obras(id) ON DELETE CASCADE;


--
-- Name: desbloqueios desbloqueios_obra_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.desbloqueios
    ADD CONSTRAINT desbloqueios_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES engenharia.obras(id) ON DELETE CASCADE;


--
-- Name: desbloqueios_plano desbloqueios_plano_prestador_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.desbloqueios_plano
    ADD CONSTRAINT desbloqueios_plano_prestador_id_fkey FOREIGN KEY (prestador_id) REFERENCES engenharia.prestadores(id) ON DELETE CASCADE;


--
-- Name: desbloqueios desbloqueios_prestador_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.desbloqueios
    ADD CONSTRAINT desbloqueios_prestador_id_fkey FOREIGN KEY (prestador_id) REFERENCES engenharia.prestadores(id);


--
-- Name: documentos documentos_captura_bruta_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.documentos
    ADD CONSTRAINT documentos_captura_bruta_id_fkey FOREIGN KEY (captura_bruta_id) REFERENCES engenharia.capturas_brutas(id);


--
-- Name: enrichment_queue enrichment_queue_obra_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.enrichment_queue
    ADD CONSTRAINT enrichment_queue_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES engenharia.obras(id) ON DELETE CASCADE;


--
-- Name: enriquecimento_log enriquecimento_log_decisor_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.enriquecimento_log
    ADD CONSTRAINT enriquecimento_log_decisor_id_fkey FOREIGN KEY (decisor_id) REFERENCES engenharia.decisores_obra(id) ON DELETE SET NULL;


--
-- Name: enriquecimento_log enriquecimento_log_obra_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.enriquecimento_log
    ADD CONSTRAINT enriquecimento_log_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES engenharia.obras(id) ON DELETE CASCADE;


--
-- Name: entidade_decisores entidade_decisores_decisor_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.entidade_decisores
    ADD CONSTRAINT entidade_decisores_decisor_id_fkey FOREIGN KEY (decisor_id) REFERENCES engenharia.decisores(id);


--
-- Name: entidade_decisores entidade_decisores_entidade_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.entidade_decisores
    ADD CONSTRAINT entidade_decisores_entidade_id_fkey FOREIGN KEY (entidade_id) REFERENCES engenharia.entidades(id);


--
-- Name: evidencias_campos evidencias_campos_campo_canonico_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.evidencias_campos
    ADD CONSTRAINT evidencias_campos_campo_canonico_id_fkey FOREIGN KEY (campo_canonico_id) REFERENCES engenharia.campos_canonicos(id);


--
-- Name: evidencias_campos evidencias_campos_captura_bruta_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.evidencias_campos
    ADD CONSTRAINT evidencias_campos_captura_bruta_id_fkey FOREIGN KEY (captura_bruta_id) REFERENCES engenharia.capturas_brutas(id);


--
-- Name: evidencias_campos evidencias_campos_fonte_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.evidencias_campos
    ADD CONSTRAINT evidencias_campos_fonte_id_fkey FOREIGN KEY (fonte_id) REFERENCES engenharia.fontes(id);


--
-- Name: evidencias evidencias_match_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.evidencias
    ADD CONSTRAINT evidencias_match_id_fkey FOREIGN KEY (match_id) REFERENCES engenharia.matches_empresa(id) ON DELETE SET NULL;


--
-- Name: fornecedor_meta fornecedor_meta_grupo_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.fornecedor_meta
    ADD CONSTRAINT fornecedor_meta_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES engenharia.grupo(id) ON DELETE SET NULL;


--
-- Name: fornecedores fornecedores_usuario_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.fornecedores
    ADD CONSTRAINT fornecedores_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES engenharia.prestadores(id) ON DELETE SET NULL;


--
-- Name: grupo_capturas grupo_capturas_captura_bruta_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.grupo_capturas
    ADD CONSTRAINT grupo_capturas_captura_bruta_id_fkey FOREIGN KEY (captura_bruta_id) REFERENCES engenharia.capturas_brutas(id);


--
-- Name: grupo_capturas grupo_capturas_correspondencia_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.grupo_capturas
    ADD CONSTRAINT grupo_capturas_correspondencia_id_fkey FOREIGN KEY (correspondencia_id) REFERENCES engenharia.correspondencias_capturas(id);


--
-- Name: grupo_capturas grupo_capturas_grupo_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.grupo_capturas
    ADD CONSTRAINT grupo_capturas_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES engenharia.grupos_consolidados(id);


--
-- Name: grupos_consolidados grupos_consolidados_candidato_projeto_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.grupos_consolidados
    ADD CONSTRAINT grupos_consolidados_candidato_projeto_id_fkey FOREIGN KEY (candidato_projeto_id) REFERENCES engenharia.candidatos_projeto(id);


--
-- Name: identificadores identificadores_captura_bruta_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.identificadores
    ADD CONSTRAINT identificadores_captura_bruta_id_fkey FOREIGN KEY (captura_bruta_id) REFERENCES engenharia.capturas_brutas(id);


--
-- Name: interacoes interacoes_obra_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.interacoes
    ADD CONSTRAINT interacoes_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES engenharia.obras(id);


--
-- Name: interacoes interacoes_prestador_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.interacoes
    ADD CONSTRAINT interacoes_prestador_id_fkey FOREIGN KEY (prestador_id) REFERENCES engenharia.prestadores(id);


--
-- Name: leads_outbound leads_outbound_prestador_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.leads_outbound
    ADD CONSTRAINT leads_outbound_prestador_id_fkey FOREIGN KEY (prestador_id) REFERENCES engenharia.prestadores(id);


--
-- Name: leads_outbound leads_outbound_representante_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.leads_outbound
    ADD CONSTRAINT leads_outbound_representante_id_fkey FOREIGN KEY (representante_id) REFERENCES engenharia.prestadores(id);


--
-- Name: localizacoes localizacoes_captura_bruta_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.localizacoes
    ADD CONSTRAINT localizacoes_captura_bruta_id_fkey FOREIGN KEY (captura_bruta_id) REFERENCES engenharia.capturas_brutas(id);


--
-- Name: mapeamentos_campos mapeamentos_campos_campo_canonico_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.mapeamentos_campos
    ADD CONSTRAINT mapeamentos_campos_campo_canonico_id_fkey FOREIGN KEY (campo_canonico_id) REFERENCES engenharia.campos_canonicos(id);


--
-- Name: matches_cadeia_fornecedor matches_cadeia_fornecedor_obra_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.matches_cadeia_fornecedor
    ADD CONSTRAINT matches_cadeia_fornecedor_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES engenharia.obras(id) ON DELETE CASCADE;


--
-- Name: matches_cadeia_obra matches_cadeia_obra_obra_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.matches_cadeia_obra
    ADD CONSTRAINT matches_cadeia_obra_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES engenharia.obras(id) ON DELETE CASCADE;


--
-- Name: matches_necessidade_fornecedor matches_necessidade_fornecedor_obra_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.matches_necessidade_fornecedor
    ADD CONSTRAINT matches_necessidade_fornecedor_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES engenharia.obras(id) ON DELETE CASCADE;


--
-- Name: matches_v2 matches_v2_obra_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.matches_v2
    ADD CONSTRAINT matches_v2_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES engenharia.obras(id) ON DELETE CASCADE;


--
-- Name: noticias_processadas noticias_processadas_obra_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.noticias_processadas
    ADD CONSTRAINT noticias_processadas_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES engenharia.obras(id);


--
-- Name: obra_decisores obra_decisores_decisor_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.obra_decisores
    ADD CONSTRAINT obra_decisores_decisor_id_fkey FOREIGN KEY (decisor_id) REFERENCES engenharia.decisores(id);


--
-- Name: obra_decisores obra_decisores_obra_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.obra_decisores
    ADD CONSTRAINT obra_decisores_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES engenharia.obras_validadas(id);


--
-- Name: obras_atualizacoes_log obras_atualizacoes_log_obra_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.obras_atualizacoes_log
    ADD CONSTRAINT obras_atualizacoes_log_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES engenharia.obras(id) ON DELETE CASCADE;


--
-- Name: obras_impacto_economico obras_impacto_economico_obra_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.obras_impacto_economico
    ADD CONSTRAINT obras_impacto_economico_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES engenharia.obras(id) ON DELETE CASCADE;


--
-- Name: obras_validadas obras_validadas_candidato_projeto_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.obras_validadas
    ADD CONSTRAINT obras_validadas_candidato_projeto_id_fkey FOREIGN KEY (candidato_projeto_id) REFERENCES engenharia.candidatos_projeto(id);


--
-- Name: obras_validadas obras_validadas_grupo_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.obras_validadas
    ADD CONSTRAINT obras_validadas_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES engenharia.grupos_consolidados(id);


--
-- Name: outreach_drafts outreach_drafts_decisor_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.outreach_drafts
    ADD CONSTRAINT outreach_drafts_decisor_id_fkey FOREIGN KEY (decisor_id) REFERENCES engenharia.empresa_decisores_cache(id);


--
-- Name: outreach_drafts outreach_drafts_obra_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.outreach_drafts
    ADD CONSTRAINT outreach_drafts_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES engenharia.obras(id);


--
-- Name: pagamentos pagamentos_lead_outbound_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.pagamentos
    ADD CONSTRAINT pagamentos_lead_outbound_id_fkey FOREIGN KEY (lead_outbound_id) REFERENCES engenharia.leads_outbound(id);


--
-- Name: pagamentos pagamentos_obra_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.pagamentos
    ADD CONSTRAINT pagamentos_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES engenharia.obras(id) ON DELETE SET NULL;


--
-- Name: pagamentos pagamentos_prestador_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.pagamentos
    ADD CONSTRAINT pagamentos_prestador_id_fkey FOREIGN KEY (prestador_id) REFERENCES engenharia.prestadores(id) ON DELETE SET NULL;


--
-- Name: password_resets password_resets_user_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.password_resets
    ADD CONSTRAINT password_resets_user_id_fkey FOREIGN KEY (user_id) REFERENCES engenharia.prestadores(id) ON DELETE CASCADE;


--
-- Name: pipeline_obras_log pipeline_obras_log_obra_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.pipeline_obras_log
    ADD CONSTRAINT pipeline_obras_log_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES engenharia.obras(id) ON DELETE SET NULL;


--
-- Name: portao_fila portao_fila_obra_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.portao_fila
    ADD CONSTRAINT portao_fila_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES engenharia.obras(id) ON DELETE CASCADE;


--
-- Name: prestador_empresas prestador_empresas_prestador_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.prestador_empresas
    ADD CONSTRAINT prestador_empresas_prestador_id_fkey FOREIGN KEY (prestador_id) REFERENCES engenharia.prestadores(id) ON DELETE CASCADE;


--
-- Name: prestadores prestadores_convidado_por_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.prestadores
    ADD CONSTRAINT prestadores_convidado_por_fkey FOREIGN KEY (convidado_por) REFERENCES engenharia.prestadores(id);


--
-- Name: primeiro_acesso_tokens primeiro_acesso_tokens_prestador_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.primeiro_acesso_tokens
    ADD CONSTRAINT primeiro_acesso_tokens_prestador_id_fkey FOREIGN KEY (prestador_id) REFERENCES engenharia.prestadores(id) ON DELETE CASCADE;


--
-- Name: regras_prioridade_campos regras_prioridade_campos_campo_canonico_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.regras_prioridade_campos
    ADD CONSTRAINT regras_prioridade_campos_campo_canonico_id_fkey FOREIGN KEY (campo_canonico_id) REFERENCES engenharia.campos_canonicos(id);


--
-- Name: resumo_empresa_wins resumo_empresa_wins_match_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.resumo_empresa_wins
    ADD CONSTRAINT resumo_empresa_wins_match_id_fkey FOREIGN KEY (match_id) REFERENCES engenharia.matches_empresa(id) ON DELETE CASCADE;


--
-- Name: setor_categorias setor_categorias_categoria_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.setor_categorias
    ADD CONSTRAINT setor_categorias_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES engenharia.categorias_servico(id) ON DELETE CASCADE;


--
-- Name: valores_mestre valores_mestre_campo_canonico_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.valores_mestre
    ADD CONSTRAINT valores_mestre_campo_canonico_id_fkey FOREIGN KEY (campo_canonico_id) REFERENCES engenharia.campos_canonicos(id);


--
-- Name: valores_mestre valores_mestre_captura_origem_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.valores_mestre
    ADD CONSTRAINT valores_mestre_captura_origem_id_fkey FOREIGN KEY (captura_origem_id) REFERENCES engenharia.capturas_brutas(id);


--
-- Name: valores_mestre valores_mestre_fonte_preferencial_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.valores_mestre
    ADD CONSTRAINT valores_mestre_fonte_preferencial_fkey FOREIGN KEY (fonte_preferencial) REFERENCES engenharia.fontes(id);


--
-- Name: valores_mestre valores_mestre_grupo_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.valores_mestre
    ADD CONSTRAINT valores_mestre_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES engenharia.grupos_consolidados(id);


--
-- Name: valores_monetarios valores_monetarios_captura_bruta_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.valores_monetarios
    ADD CONSTRAINT valores_monetarios_captura_bruta_id_fkey FOREIGN KEY (captura_bruta_id) REFERENCES engenharia.capturas_brutas(id);


--
-- Name: valores_normalizados valores_normalizados_campo_canonico_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.valores_normalizados
    ADD CONSTRAINT valores_normalizados_campo_canonico_id_fkey FOREIGN KEY (campo_canonico_id) REFERENCES engenharia.campos_canonicos(id);


--
-- Name: valores_normalizados valores_normalizados_captura_bruta_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.valores_normalizados
    ADD CONSTRAINT valores_normalizados_captura_bruta_id_fkey FOREIGN KEY (captura_bruta_id) REFERENCES engenharia.capturas_brutas(id);


--
-- Name: valores_normalizados valores_normalizados_fonte_id_fkey; Type: FK CONSTRAINT; Schema: engenharia; Owner: -
--

ALTER TABLE ONLY engenharia.valores_normalizados
    ADD CONSTRAINT valores_normalizados_fonte_id_fkey FOREIGN KEY (fonte_id) REFERENCES engenharia.fontes(id);


--
-- PostgreSQL database dump complete
--

