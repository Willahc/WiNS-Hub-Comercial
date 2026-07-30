-- 01_create_saude_empresa_core_map.sql
--
-- Cria objetos auxiliares e de mapeamento no schema saude.
-- Não insere dados em core.empresa nem core.papel_vertical.
-- Deve ser executado dentro da transação principal da migração.

BEGIN;

-- ============================================================
-- Tabela de mapeamento CNES/ANS → core.empresa
-- ============================================================
CREATE TABLE IF NOT EXISTS saude.empresa_core_map (
    id              BIGSERIAL,
    cnes_id         INTEGER,
    registro_ans    VARCHAR(20),
    cnpj            CHAR(14) NOT NULL,
    migracao_id     VARCHAR(50) NOT NULL,
    metodo_match    VARCHAR(20) NOT NULL DEFAULT 'cnpj_valido',
    criado_em       TIMESTAMPTZ DEFAULT now(),
    atualizado_em   TIMESTAMPTZ DEFAULT now(),

    -- Constraints
    CONSTRAINT empresa_core_map_pkey PRIMARY KEY (id),
    CONSTRAINT cnes_id_unique UNIQUE (cnes_id),
    CONSTRAINT registro_ans_unique UNIQUE (registro_ans),
    CONSTRAINT pelo_menos_um_vinculo CHECK (
        cnes_id IS NOT NULL OR registro_ans IS NOT NULL
    ),
    CONSTRAINT fk_empresa_core_map_cnpj FOREIGN KEY (cnpj)
        REFERENCES core.empresa(cnpj),
    CONSTRAINT chk_metodo_match CHECK (metodo_match = 'cnpj_valido')
);

CREATE INDEX IF NOT EXISTS idx_empresa_core_map_cnpj
    ON saude.empresa_core_map (cnpj);
CREATE INDEX IF NOT EXISTS idx_empresa_core_map_migracao
    ON saude.empresa_core_map (migracao_id);

-- ============================================================
-- Tabelas de tracking da migração
-- ============================================================
CREATE TABLE IF NOT EXISTS saude.migracao_empresa_tracking (
    cnpj            CHAR(14) NOT NULL,
    migracao_id     VARCHAR(50) NOT NULL,
    criado_em       TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT pk_migracao_empresa_tracking PRIMARY KEY (cnpj, migracao_id),
    CONSTRAINT fk_tracking_empresa FOREIGN KEY (cnpj)
        REFERENCES core.empresa(cnpj)
);

CREATE TABLE IF NOT EXISTS saude.migracao_papel_tracking (
    cnpj            CHAR(14) NOT NULL,
    vertical        VARCHAR(20) NOT NULL,
    tipo            VARCHAR(30) NOT NULL,
    migracao_id     VARCHAR(50) NOT NULL,
    criado_em       TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT pk_migracao_papel_tracking PRIMARY KEY (cnpj, vertical, tipo, migracao_id),
    CONSTRAINT fk_tracking_papel FOREIGN KEY (cnpj, vertical, tipo)
        REFERENCES core.papel_vertical(cnpj, vertical, tipo)
);

CREATE TABLE IF NOT EXISTS saude.migracao_log (
    id              BIGSERIAL PRIMARY KEY,
    migracao_id     VARCHAR(50) NOT NULL,
    etapa           VARCHAR(50) NOT NULL,
    script          VARCHAR(100),
    linhas_afetadas INTEGER DEFAULT 0,
    mensagem        TEXT,
    criado_em       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_migracao_log_id
    ON saude.migracao_log (migracao_id);

COMMIT;
