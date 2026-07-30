BEGIN;

-- The database objects were moved from wins_v2 to engenharia, but these
-- function bodies retained hard-coded wins_v2 references. Keep the Portão
-- behavior and point it at the canonical objects that already hold its state.
CREATE OR REPLACE FUNCTION engenharia.portao_flag(
    p_chave text,
    p_default text DEFAULT 'false'
) RETURNS text
LANGUAGE sql
STABLE
SET search_path = engenharia, public
AS $$
    SELECT COALESCE(
        (SELECT valor FROM engenharia.portao_config WHERE chave = p_chave),
        p_default
    );
$$;

CREATE OR REPLACE FUNCTION engenharia.portao_flag_on(p_chave text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = engenharia, public
AS $$
    SELECT lower(engenharia.portao_flag(p_chave, 'false'))
           IN ('1', 'true', 'yes', 'on', 'sim');
$$;

CREATE OR REPLACE FUNCTION engenharia.fn_enqueue_enrichment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = engenharia, public
AS $$
BEGIN
  IF engenharia.portao_flag_on('PORTAO_OBRAS_ENABLED')
     AND engenharia.portao_flag_on('PORTAO_OBRAS_NEW_CAPTURES_ENABLED')
  THEN
    IF NEW.status_portao IS DISTINCT FROM 'APROVADA' THEN
      RETURN NEW;
    END IF;
    IF NOT engenharia.portao_flag_on('AUTO_ENRICH_AFTER_GATE_ENABLED') THEN
      RETURN NEW;
    END IF;
  END IF;

  IF COALESCE(NEW.fonte,'') NOT IN ('anm_cfem','ibama_sislic')
     AND NEW.motivo_invisivel IS NULL
  THEN
    INSERT INTO engenharia.enrichment_queue (obra_id, capex)
    VALUES (NEW.id, COALESCE(NEW.valor_estimado, 0))
    ON CONFLICT (obra_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION engenharia.fn_portao_nova_captura()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = engenharia, public
AS $$
DECLARE
    v_enabled boolean;
    v_new_cap boolean;
BEGIN
    v_enabled := engenharia.portao_flag_on('PORTAO_OBRAS_ENABLED');
    v_new_cap := engenharia.portao_flag_on('PORTAO_OBRAS_NEW_CAPTURES_ENABLED');

    IF NOT (v_enabled AND v_new_cap) OR NEW.status_portao IS NOT NULL THEN
        RETURN NEW;
    END IF;

    NEW.status_portao := 'EM_ANALISE';
    NEW.status_enriquecimento := COALESCE(NEW.status_enriquecimento, 'NAO_INICIADO');
    NEW.visivel := false;
    NEW.motivo_invisivel :=
        COALESCE(NULLIF(NEW.motivo_invisivel, ''), 'aguardando_portao');
    NEW.portao_versao :=
        engenharia.portao_flag('PORTAO_VERSAO', 'portao-v5.0.0');
    NEW.portao_motivo :=
        COALESCE(NEW.portao_motivo, 'nova_captura_aguardando_portao');
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION engenharia.fn_portao_enfileirar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = engenharia, public
AS $$
BEGIN
    IF NEW.status_portao = 'EM_ANALISE'
       AND engenharia.portao_flag_on('PORTAO_OBRAS_ENABLED')
       AND engenharia.portao_flag_on('PORTAO_OBRAS_NEW_CAPTURES_ENABLED')
    THEN
        IF NOT EXISTS (
            SELECT 1 FROM engenharia.portao_fila
             WHERE obra_id = NEW.id
               AND status IN ('pendente', 'processando')
        ) THEN
            INSERT INTO engenharia.portao_fila (obra_id, captura_id, status)
            VALUES (NEW.id, NEW.id, 'pendente');
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION engenharia.trg_obras_pipeline_inbox()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = engenharia, public
AS $$
BEGIN
    INSERT INTO engenharia.pipeline_inbox
        (v1_obra_id, fonte, id_externo, payload_minimo, status)
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

ALTER TABLE engenharia.engineering_capture_runs
    DROP CONSTRAINT IF EXISTS engineering_capture_runs_status_chk;
ALTER TABLE engenharia.engineering_capture_runs
    ADD CONSTRAINT engineering_capture_runs_status_chk CHECK (
        status IN (
            'RUNNING', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED',
            'SKIPPED_LOCKED', 'BLOCKED_DISK'
        )
    );

UPDATE engenharia.fontes
   SET url_base = 'https://api-publica.obrasgov.gestao.gov.br/',
       documentacao = 'https://api-publica.obrasgov.gestao.gov.br/obras/docs'
 WHERE nome_curto = 'obrasgov_100k';

COMMENT ON FUNCTION engenharia.portao_flag(text,text) IS
    'Reads the canonical Engenharia Portão configuration after the wins_v2 schema migration.';
COMMENT ON FUNCTION engenharia.fn_enqueue_enrichment() IS
    'Queues enrichment only after the existing Portão approval rules permit it.';

-- The timer uses the existing wins_app credential. Grant only the canonical
-- capture path; do not create or alter authentication credentials.
GRANT USAGE ON SCHEMA engenharia TO wins_app;
GRANT SELECT ON
    engenharia.fontes,
    engenharia.captadores,
    engenharia.portao_config,
    engenharia.obras
TO wins_app;
GRANT SELECT, INSERT, UPDATE ON
    engenharia.engineering_capture_runs,
    engenharia.engineering_capture_source_runs,
    engenharia.engineering_capture_rejections,
    engenharia.capturas_brutas,
    engenharia.obras_atualizacoes_log
TO wins_app;
GRANT INSERT, UPDATE ON engenharia.obras TO wins_app;
GRANT SELECT, INSERT ON
    engenharia.enrichment_queue,
    engenharia.portao_fila,
    engenharia.pipeline_inbox,
    engenharia.decisores_obra
TO wins_app;
GRANT SELECT ON engenharia.decisores_preservados TO wins_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA engenharia TO wins_app;
GRANT EXECUTE ON FUNCTION
    engenharia.immutable_unaccent_lower(text),
    engenharia.cnpj_valido(text),
    engenharia.portao_flag(text,text),
    engenharia.portao_flag_on(text),
    engenharia.recompute_classificacao_obra(uuid)
TO wins_app;

DO $validation$
DECLARE
    missing_flags integer;
    stale_functions integer;
BEGIN
    SELECT count(*) INTO missing_flags
      FROM (VALUES
        ('PORTAO_OBRAS_ENABLED'),
        ('PORTAO_OBRAS_NEW_CAPTURES_ENABLED'),
        ('AUTO_ENRICH_AFTER_GATE_ENABLED'),
        ('PORTAO_VERSAO')
      ) AS required(chave)
     WHERE NOT EXISTS (
        SELECT 1 FROM engenharia.portao_config c WHERE c.chave = required.chave
     );
    IF missing_flags <> 0 THEN
        RAISE EXCEPTION 'Portão validation failed: % required flags missing', missing_flags;
    END IF;

    SELECT count(*) INTO stale_functions
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'engenharia'
       AND p.proname IN (
           'portao_flag', 'portao_flag_on', 'fn_enqueue_enrichment',
           'fn_portao_nova_captura', 'fn_portao_enfileirar',
           'trg_obras_pipeline_inbox'
       )
       AND p.prosrc ILIKE '%wins_v2%';
    IF stale_functions <> 0 THEN
        RAISE EXCEPTION 'Portão validation failed: % stale wins_v2 references', stale_functions;
    END IF;

    PERFORM engenharia.portao_flag_on('PORTAO_OBRAS_ENABLED');
    PERFORM 1 FROM engenharia.portao_fila LIMIT 1;
    PERFORM 1 FROM engenharia.pipeline_inbox LIMIT 1;
END;
$validation$;

COMMIT;
