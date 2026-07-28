BEGIN;

CREATE TABLE IF NOT EXISTS engenharia.pncp_company_profiles (
    cnpj varchar(14) PRIMARY KEY CHECK (cnpj ~ '^[0-9]{14}$'),
    razao_social text,
    nome_fantasia text,
    situacao_cadastral text,
    email_empresa text,
    telefone_1 text,
    telefone_2 text,
    logradouro text,
    numero text,
    complemento text,
    bairro text,
    municipio text,
    uf char(2),
    cep text,
    dominio text,
    dominio_status text,
    site_url text,
    whatsapp_empresa text,
    linkedin_empresa text,
    instagram_empresa text,
    site_validado_em timestamptz,
    fonte text NOT NULL DEFAULT 'BRASILAPI_CNPJ',
    fonte_url text,
    consultado_em timestamptz NOT NULL DEFAULT now(),
    proxima_consulta_em timestamptz,
    status_consulta text NOT NULL DEFAULT 'PENDENTE',
    erro text,
    dados jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_pncp_company_profiles_status
    ON engenharia.pncp_company_profiles(status_consulta, proxima_consulta_em);

CREATE TABLE IF NOT EXISTS engenharia.pncp_company_officers (
    cnpj varchar(14) NOT NULL
        REFERENCES engenharia.pncp_company_profiles(cnpj) ON DELETE CASCADE,
    nome text NOT NULL,
    qualificacao text,
    data_entrada date,
    fonte text NOT NULL DEFAULT 'BRASILAPI_QSA',
    consultado_em timestamptz NOT NULL DEFAULT now(),
    dados jsonb NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (cnpj, nome)
);

GRANT SELECT, INSERT, UPDATE ON engenharia.pncp_company_profiles,
                                engenharia.pncp_company_officers TO wins_app;
-- O trigger de preservação de decisores usa os privilégios do chamador.
GRANT INSERT, UPDATE ON engenharia.decisores_preservados TO wins_app;

COMMIT;
