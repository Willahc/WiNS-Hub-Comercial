BEGIN;
CREATE TABLE IF NOT EXISTS engenharia.pncp_linkedin_searches (
    cnpj varchar(14) NOT NULL,
    nome text NOT NULL,
    empresa text,
    consulta text NOT NULL,
    status text NOT NULL,
    linkedin_url text,
    titulo_resultado text,
    snippet text,
    cargo_detectado text,
    tipo_cargo text,
    score integer,
    motivo text,
    fonte text NOT NULL DEFAULT 'GOOGLE_SERPER_FREE',
    consultado_em timestamptz NOT NULL DEFAULT now(),
    dados jsonb NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (cnpj,nome)
);
CREATE INDEX IF NOT EXISTS idx_pncp_linkedin_status_score
 ON engenharia.pncp_linkedin_searches(status,score DESC);
GRANT SELECT,INSERT,UPDATE ON engenharia.pncp_linkedin_searches TO wins_app;
COMMIT;
