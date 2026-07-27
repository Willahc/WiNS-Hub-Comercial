BEGIN;

UPDATE engenharia.fontes
   SET url_base = 'https://obrasgov.sistema.gov.br/',
       documentacao = 'https://api.obrasgov.gestao.gov.br/obrasgov/api/swagger-ui/index.html'
 WHERE nome_curto = 'obrasgov_100k';

REVOKE EXECUTE ON FUNCTION
    engenharia.immutable_unaccent_lower(text),
    engenharia.cnpj_valido(text),
    engenharia.portao_flag(text,text),
    engenharia.portao_flag_on(text),
    engenharia.recompute_classificacao_obra(uuid)
FROM wins_app;
REVOKE USAGE, SELECT ON ALL SEQUENCES IN SCHEMA engenharia FROM wins_app;
REVOKE SELECT, INSERT ON
    engenharia.enrichment_queue,
    engenharia.portao_fila,
    engenharia.pipeline_inbox,
    engenharia.decisores_obra
FROM wins_app;
REVOKE SELECT ON engenharia.decisores_preservados FROM wins_app;
REVOKE INSERT, UPDATE ON engenharia.obras FROM wins_app;
REVOKE SELECT, INSERT, UPDATE ON
    engenharia.engineering_capture_runs,
    engenharia.engineering_capture_source_runs,
    engenharia.engineering_capture_rejections,
    engenharia.capturas_brutas,
    engenharia.obras_atualizacoes_log
FROM wins_app;
REVOKE SELECT ON
    engenharia.fontes,
    engenharia.captadores,
    engenharia.portao_config,
    engenharia.obras
FROM wins_app;
REVOKE USAGE ON SCHEMA engenharia FROM wins_app;

-- Rollback is intentionally guarded: the former definitions require a real
-- wins_v2 implementation. It must never manufacture an empty compatibility
-- schema merely to make the old functions compile.
DO $validation$
BEGIN
    IF to_regnamespace('wins_v2') IS NULL
       OR to_regprocedure('wins_v2.portao_flag_on(text)') IS NULL
       OR to_regclass('wins_v2.portao_config') IS NULL
       OR to_regclass('wins_v2.portao_fila') IS NULL
       OR to_regclass('wins_v2.pipeline_inbox') IS NULL
    THEN
        RAISE EXCEPTION
            'Rollback refused: a complete wins_v2 Portão implementation is not present';
    END IF;
END;
$validation$;

CREATE OR REPLACE FUNCTION engenharia.portao_flag(
    p_chave text,
    p_default text DEFAULT 'false'
) RETURNS text
LANGUAGE sql STABLE
AS $$
    SELECT COALESCE(
        (SELECT valor FROM wins_v2.portao_config WHERE chave = p_chave),
        p_default
    );
$$;

CREATE OR REPLACE FUNCTION engenharia.portao_flag_on(p_chave text)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
    SELECT lower(wins_v2.portao_flag(p_chave, 'false'))
           IN ('1', 'true', 'yes', 'on', 'sim');
$$;

-- Remaining trigger functions must be restored from the pre-migration
-- schema dump only after the guard above succeeds.
DO $rollback$
BEGIN
    RAISE EXCEPTION
        'Rollback requires reviewed restoration of all pre-migration trigger definitions';
END;
$rollback$;

COMMIT;
