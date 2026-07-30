BEGIN;

CREATE TABLE IF NOT EXISTS engenharia.engineering_capture_runs (
    run_id uuid PRIMARY KEY,
    scheduled_for timestamptz NOT NULL,
    started_at timestamptz NOT NULL,
    finished_at timestamptz,
    timezone text NOT NULL,
    status text NOT NULL,
    sources_total integer NOT NULL DEFAULT 0,
    sources_success integer NOT NULL DEFAULT 0,
    sources_failed integer NOT NULL DEFAULT 0,
    captured_count integer NOT NULL DEFAULT 0,
    civil_count integer NOT NULL DEFAULT 0,
    industrial_count integer NOT NULL DEFAULT 0,
    rejected_below_minimum integer NOT NULL DEFAULT 0,
    rejected_missing_value integer NOT NULL DEFAULT 0,
    rejected_out_of_scope integer NOT NULL DEFAULT 0,
    inserted_count integer NOT NULL DEFAULT 0,
    updated_count integer NOT NULL DEFAULT 0,
    unchanged_count integer NOT NULL DEFAULT 0,
    duplicate_count integer NOT NULL DEFAULT 0,
    conflict_count integer NOT NULL DEFAULT 0,
    error_summary text,
    pipeline_version text NOT NULL,
    dry_run boolean NOT NULL DEFAULT false,
    CONSTRAINT engineering_capture_runs_status_chk CHECK (
        status IN ('RUNNING','SUCCESS','PARTIAL','FAILED','SKIPPED_LOCKED','BLOCKED_DISK')
    )
);

CREATE TABLE IF NOT EXISTS engenharia.engineering_capture_source_runs (
    id bigserial PRIMARY KEY,
    run_id uuid NOT NULL REFERENCES engenharia.engineering_capture_runs(run_id) ON DELETE CASCADE,
    source text NOT NULL,
    started_at timestamptz NOT NULL,
    finished_at timestamptz,
    status text NOT NULL,
    captured_count integer NOT NULL DEFAULT 0,
    inserted_count integer NOT NULL DEFAULT 0,
    updated_count integer NOT NULL DEFAULT 0,
    unchanged_count integer NOT NULL DEFAULT 0,
    duplicate_count integer NOT NULL DEFAULT 0,
    conflict_count integer NOT NULL DEFAULT 0,
    rejected_count integer NOT NULL DEFAULT 0,
    retry_count integer NOT NULL DEFAULT 0,
    error_summary text,
    checkpoint jsonb,
    UNIQUE (run_id, source)
);

CREATE TABLE IF NOT EXISTS engenharia.engineering_capture_rejections (
    id bigserial PRIMARY KEY,
    run_id uuid NOT NULL,
    source text NOT NULL,
    source_id_hash text NOT NULL,
    reason text NOT NULL,
    classification text,
    value_class text,
    value_original numeric(20,2),
    currency_original text,
    collected_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE engenharia.obras
    ADD COLUMN IF NOT EXISTS engineering_classification_original text,
    ADD COLUMN IF NOT EXISTS engineering_classification_normalized text,
    ADD COLUMN IF NOT EXISTS engineering_classification_rule text,
    ADD COLUMN IF NOT EXISTS engineering_classification_confidence numeric(5,4),
    ADD COLUMN IF NOT EXISTS engineering_value_original numeric(20,2),
    ADD COLUMN IF NOT EXISTS engineering_currency_original text,
    ADD COLUMN IF NOT EXISTS engineering_value_source_field text,
    ADD COLUMN IF NOT EXISTS engineering_value_class text,
    ADD COLUMN IF NOT EXISTS engineering_value_rule text,
    ADD COLUMN IF NOT EXISTS engineering_collected_at timestamptz,
    ADD COLUMN IF NOT EXISTS engineering_idempotency_key text,
    ADD COLUMN IF NOT EXISTS engineering_content_hash text,
    ADD COLUMN IF NOT EXISTS engineering_updated_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS uq_obras_engineering_source_idempotency
    ON engenharia.obras (fonte, engineering_idempotency_key)
    WHERE engineering_idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_engineering_capture_runs_started
    ON engenharia.engineering_capture_runs (started_at DESC);

INSERT INTO engenharia.fontes
    (nome, nome_curto, tipo, categoria, url_base, documentacao, frequencia, ativo)
VALUES
    ('PNCP Civil 100k', 'pncp_civil_100k', 'API', 'A',
     'https://pncp.gov.br/', 'https://pncp.gov.br/api/consulta/swagger-ui/index.html',
     'DIARIA', true),
    ('ObrasGov 100k', 'obrasgov_100k', 'API', 'A',
     'https://obrasgov.sistema.gov.br/',
     'https://api.obrasgov.gestao.gov.br/obrasgov/api/swagger-ui/index.html',
     'DIARIA', true)
ON CONFLICT (nome) DO UPDATE SET
    nome_curto = EXCLUDED.nome_curto,
    tipo = EXCLUDED.tipo,
    categoria = EXCLUDED.categoria,
    url_base = EXCLUDED.url_base,
    documentacao = EXCLUDED.documentacao,
    frequencia = EXCLUDED.frequencia,
    ativo = EXCLUDED.ativo;

INSERT INTO engenharia.captadores
    (nome, fonte_id, script_path, versao, hash_script, ativo)
SELECT 'canonical_' || f.nome_curto, f.id,
       'engineering_capture.runner', 'engineering-capture-v1.0.0',
       'versioned-in-git', true
  FROM engenharia.fontes f
 WHERE f.nome_curto IN ('pncp_civil_100k', 'obrasgov_100k')
ON CONFLICT (nome) DO UPDATE SET
    fonte_id = EXCLUDED.fonte_id,
    script_path = EXCLUDED.script_path,
    versao = EXCLUDED.versao,
    hash_script = EXCLUDED.hash_script,
    ativo = EXCLUDED.ativo;

COMMIT;
