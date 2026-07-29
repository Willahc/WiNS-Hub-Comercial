BEGIN;

CREATE TABLE IF NOT EXISTS engenharia.pncp_commercial_targets (
    id bigserial PRIMARY KEY,
    obra_id uuid NOT NULL REFERENCES engenharia.obras(id) ON DELETE CASCADE,
    pncp_id text NOT NULL,
    fornecedor_cnpj varchar(14) NOT NULL,
    fornecedor_nome text,
    estagio text NOT NULL,
    evidencia_tipo text NOT NULL,
    evidencia_id text,
    data_resultado date,
    primeiro_detectado_em timestamptz NOT NULL DEFAULT now(),
    ultima_verificacao_em timestamptz NOT NULL DEFAULT now(),
    cnpj_valido boolean,
    cnpj_situacao text,
    cnpj_razao_social text,
    cnpj_validado_em timestamptz,
    dominio text,
    dominio_status text,
    dominio_fonte text,
    dominio_validado_em timestamptz,
    detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT pncp_commercial_targets_estagio_chk CHECK (
        estagio IN (
            'RESULTADO_PUBLICADO',
            'CONTRATO_PUBLICADO',
            'CONSORCIO',
            'SUBCONTRATADA'
        )
    ),
    CONSTRAINT pncp_commercial_targets_evidencia_chk CHECK (
        evidencia_tipo IN ('RESULTADO_ITEM_PNCP', 'CONTRATO_PNCP', 'DOCUMENTO_PNCP')
    ),
    CONSTRAINT pncp_commercial_targets_cnpj_chk CHECK (
        fornecedor_cnpj ~ '^[0-9]{14}$'
    ),
    UNIQUE (obra_id, fornecedor_cnpj)
);

CREATE INDEX IF NOT EXISTS idx_pncp_targets_stage_result
    ON engenharia.pncp_commercial_targets
        (estagio, data_resultado DESC NULLS LAST, ultima_verificacao_em DESC);

CREATE INDEX IF NOT EXISTS idx_pncp_targets_cnpj
    ON engenharia.pncp_commercial_targets (fornecedor_cnpj);

CREATE TABLE IF NOT EXISTS engenharia.pncp_commercial_scans (
    obra_id uuid PRIMARY KEY REFERENCES engenharia.obras(id) ON DELETE CASCADE,
    pncp_id text NOT NULL,
    situacao text NOT NULL,
    detalhe text,
    consultado_em timestamptz NOT NULL DEFAULT now(),
    proxima_consulta_em timestamptz,
    tentativas integer NOT NULL DEFAULT 1,
    CONSTRAINT pncp_commercial_scans_situacao_chk CHECK (
        situacao IN (
            'SEM_RESULTADO', 'RESULTADO_PUBLICADO', 'CONTRATO_PUBLICADO',
            'CONTRATO_SEM_FORNECEDOR', 'RESULTADO_SEM_FORNECEDOR',
            'ID_INVALIDO', 'ERRO_PNCP', 'ERRO_REDE'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_pncp_scans_next
    ON engenharia.pncp_commercial_scans
        (proxima_consulta_em, consultado_em);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wins_app') THEN
        GRANT SELECT, INSERT, UPDATE
            ON engenharia.pncp_commercial_targets TO wins_app;
        GRANT USAGE, SELECT
            ON SEQUENCE engenharia.pncp_commercial_targets_id_seq TO wins_app;
        GRANT SELECT, INSERT, UPDATE
            ON engenharia.pncp_commercial_scans TO wins_app;
    END IF;
END
$$;

COMMIT;
