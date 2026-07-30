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

DO $rollback$
DECLARE
    signature text;
    current_ddl text;
    rollback_ddl text;
BEGIN
    FOREACH signature IN ARRAY ARRAY[
        'engenharia.portao_flag(text,text)',
        'engenharia.portao_flag_on(text)',
        'engenharia.fn_enqueue_enrichment()',
        'engenharia.fn_portao_nova_captura()',
        'engenharia.fn_portao_enfileirar()',
        'engenharia.trg_obras_pipeline_inbox()'
    ]
    LOOP
        SELECT pg_get_functiondef(signature::regprocedure) INTO current_ddl;
        rollback_ddl := replace(current_ddl, 'engenharia.', 'wins_v2.');
        rollback_ddl := regexp_replace(
            rollback_ddl,
            '^CREATE OR REPLACE FUNCTION wins_v2\.',
            'CREATE OR REPLACE FUNCTION engenharia.'
        );
        EXECUTE rollback_ddl;
    END LOOP;
END;
$rollback$;

ALTER TABLE engenharia.engineering_capture_runs
    DROP CONSTRAINT IF EXISTS engineering_capture_runs_status_chk;
ALTER TABLE engenharia.engineering_capture_runs
    ADD CONSTRAINT engineering_capture_runs_status_chk CHECK (
        status IN (
            'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED',
            'SKIPPED_LOCKED', 'BLOCKED_DISK'
        )
    );

COMMIT;
