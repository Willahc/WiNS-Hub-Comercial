 CREATE OR REPLACE FUNCTION engenharia.consolidar_grupo(p_grupo_id uuid)               +
  RETURNS integer                                                                      +
  LANGUAGE plpgsql                                                                     +
  SET search_path TO 'wins_v2', 'pg_temp'                                              +
 AS $function$                                                                         +
 DECLARE                                                                               +
     v_count INT := 0;                                                                 +
     v_campo RECORD;                                                                   +
     v_prioridade TEXT[];                                                              +
     v_valor_mestre TEXT;                                                              +
     v_fonte_pref INT;                                                                 +
     v_captura_origem UUID;                                                            +
     v_confianca NUMERIC(3,2);                                                         +
     v_alternativas JSONB;                                                             +
     v_valores RECORD;                                                                 +
     v_valores_unicos TEXT[];                                                          +
     v_first_valor TEXT;                                                               +
     v_first_fonte INT;                                                                +
     v_first_captura UUID;                                                             +
     v_second_valor TEXT;                                                              +
     v_second_fonte INT;                                                               +
     v_second_captura UUID;                                                            +
     v_conflict_id UUID;                                                               +
     v_tipo_conflito TEXT;                                                             +
     v_justificativa TEXT;                                                             +
     v_fonte_nome TEXT;                                                                +
 BEGIN                                                                                 +
     PERFORM id FROM grupos_consolidados                                               +
     WHERE id = p_grupo_id                                                             +
     FOR UPDATE;                                                                       +
                                                                                       +
     FOR v_campo IN                                                                    +
         SELECT DISTINCT vn.campo_canonico_id                                          +
         FROM grupo_capturas gc                                                        +
         JOIN valores_normalizados vn ON vn.captura_bruta_id = gc.captura_bruta_id     +
         WHERE gc.grupo_id = p_grupo_id                                                +
         ORDER BY vn.campo_canonico_id                                                 +
     LOOP                                                                              +
         SELECT ordem_prioridade INTO v_prioridade                                     +
         FROM regras_prioridade_campos                                                 +
         WHERE campo_canonico_id = v_campo.campo_canonico_id AND ativo = true          +
         ORDER BY criado_em DESC LIMIT 1;                                              +
                                                                                       +
         v_alternativas := '[]'::jsonb;                                                +
                                                                                       +
         FOR v_valores IN                                                              +
             SELECT vn.valor_normalizado, vn.fonte_id, vn.captura_bruta_id,            +
                    vn.confianca, f.nome AS fonte_nome                                 +
             FROM grupo_capturas gc                                                    +
             JOIN valores_normalizados vn ON vn.captura_bruta_id = gc.captura_bruta_id +
             LEFT JOIN fontes f ON f.id = vn.fonte_id                                  +
             WHERE gc.grupo_id = p_grupo_id                                            +
               AND vn.campo_canonico_id = v_campo.campo_canonico_id                    +
               AND vn.valor_normalizado IS NOT NULL                                    +
             ORDER BY                                                                  +
                 CASE WHEN v_prioridade IS NOT NULL THEN                               +
                     array_position(v_prioridade, f.nome)                              +
                 ELSE 999 END NULLS LAST,                                              +
                 vn.confianca DESC,                                                    +
                 vn.criado_em DESC                                                     +
         LOOP                                                                          +
             v_alternativas := v_alternativas || jsonb_build_object(                   +
                 'valor', v_valores.valor_normalizado,                                 +
                 'fonte_id', v_valores.fonte_id,                                       +
                 'fonte_nome', v_valores.fonte_nome,                                   +
                 'captura_id', v_valores.captura_bruta_id,                             +
                 'confianca', v_valores.confianca                                      +
             );                                                                        +
         END LOOP;                                                                     +
                                                                                       +
         IF jsonb_array_length(v_alternativas) = 0 THEN                                +
             CONTINUE;                                                                 +
         END IF;                                                                       +
                                                                                       +
         v_valor_mestre := v_alternativas->0->>'valor';                                +
         v_fonte_pref := (v_alternativas->0->>'fonte_id')::INT;                        +
         v_captura_origem := (v_alternativas->0->>'captura_id')::UUID;                 +
         v_confianca := (v_alternativas->0->>'confianca')::NUMERIC(3,2);               +
         v_fonte_nome := v_alternativas->0->>'fonte_nome';                             +
                                                                                       +
         SELECT array_agg(DISTINCT valor) INTO v_valores_unicos                        +
         FROM jsonb_to_recordset(v_alternativas) AS _(valor TEXT);                     +
                                                                                       +
         IF array_length(v_valores_unicos, 1) > 1 THEN                                 +
             v_tipo_conflito := CASE                                                   +
                 WHEN v_campo.campo_canonico_id LIKE 'CC-0%' THEN 'valor'              +
                 WHEN v_campo.campo_canonico_id LIKE 'CC-02%' THEN 'entidade'          +
                 WHEN v_campo.campo_canonico_id LIKE 'CC-03%' THEN 'localizacao'       +
                 WHEN v_campo.campo_canonico_id LIKE 'CC-04%' THEN 'descricao_tecnica' +
                 ELSE 'valor'                                                          +
             END;                                                                      +
                                                                                       +
             v_first_valor := NULL;                                                    +
             v_first_fonte := NULL;                                                    +
             v_first_captura := NULL;                                                  +
             v_second_valor := NULL;                                                   +
             v_second_fonte := NULL;                                                   +
             v_second_captura := NULL;                                                 +
                                                                                       +
             FOR v_valores IN                                                          +
                 SELECT DISTINCT ON (alt->>'valor')                                    +
                     alt->>'valor' AS valor,                                           +
                     (alt->>'fonte_id')::INT AS fonte_id,                              +
                     (alt->>'captura_id')::UUID AS captura_id                          +
                 FROM jsonb_array_elements(v_alternativas) alt                         +
                 ORDER BY alt->>'valor'                                                +
                 LIMIT 2                                                               +
             LOOP                                                                      +
                 IF v_first_valor IS NULL THEN                                         +
                     v_first_valor := v_valores.valor;                                 +
                     v_first_fonte := v_valores.fonte_id;                              +
                     v_first_captura := v_valores.captura_id;                          +
                 ELSIF v_second_valor IS NULL AND v_valores.valor <> v_first_valor THEN+
                     v_second_valor := v_valores.valor;                                +
                     v_second_fonte := v_valores.fonte_id;                             +
                     v_second_captura := v_valores.captura_id;                         +
                 END IF;                                                               +
             END LOOP;                                                                 +
                                                                                       +
             IF v_second_valor IS NOT NULL THEN                                        +
                 BEGIN                                                                 +
                     v_conflict_id := detectar_conflito(                               +
                         p_grupo_id,                                                   +
                         v_campo.campo_canonico_id,                                    +
                         v_first_valor,                                                +
                         v_second_valor,                                               +
                         v_first_fonte,                                                +
                         v_second_fonte,                                               +
                         v_first_captura,                                              +
                         v_second_captura,                                             +
                         NULL                                                          +
                     );                                                                +
                 EXCEPTION                                                             +
                     WHEN OTHERS THEN                                                  +
                         NULL;                                                         +
                 END;                                                                  +
             END IF;                                                                   +
         END IF;                                                                       +
                                                                                       +
         v_justificativa := 'Selecionado por prioridade de fonte';                     +
         IF v_fonte_nome IS NOT NULL THEN                                              +
             v_justificativa := v_justificativa || ' (' || v_fonte_nome || ')';        +
         END IF;                                                                       +
                                                                                       +
         INSERT INTO valores_mestre (grupo_id, campo_canonico_id, valor_mestre,        +
                                     fonte_preferencial, captura_origem_id, confianca, +
                                     justificativa, alternativas)                      +
         VALUES (p_grupo_id, v_campo.campo_canonico_id, v_valor_mestre,                +
                 v_fonte_pref, v_captura_origem, v_confianca,                          +
                 v_justificativa, v_alternativas)                                      +
         ON CONFLICT (grupo_id, campo_canonico_id) DO UPDATE                           +
             SET valor_mestre = EXCLUDED.valor_mestre,                                 +
                 fonte_preferencial = EXCLUDED.fonte_preferencial,                     +
                 captura_origem_id = EXCLUDED.captura_origem_id,                       +
                 confianca = EXCLUDED.confianca,                                       +
                 alternativas = EXCLUDED.alternativas,                                 +
                 justificativa = EXCLUDED.justificativa,                               +
                 atualizado_em = now();                                                +
                                                                                       +
         v_count := v_count + 1;                                                       +
     END LOOP;                                                                         +
                                                                                       +
     INSERT INTO auditoria_consolidacao (grupo_id, acao, detalhes)                     +
     VALUES (p_grupo_id, 'consolidacao_finalizada',                                    +
             jsonb_build_object('campos_consolidados', v_count));                      +
                                                                                       +
     RETURN v_count;                                                                   +
 END;                                                                                  +
 $function$                                                                            +
 

