BEGIN;

CREATE TABLE IF NOT EXISTS engenharia.decisor_contact_discovery (
  cnpj text NOT NULL,
  nome text NOT NULL,
  dominio text NOT NULL,
  cargo text,
  email_confirmado text,
  email_status text NOT NULL,
  candidatos_testados jsonb NOT NULL DEFAULT '[]'::jsonb,
  telefone_publico text,
  telefone_fonte text,
  fonte text NOT NULL,
  consultado_em timestamptz NOT NULL DEFAULT now(),
  erro text,
  PRIMARY KEY (cnpj, nome, dominio)
);

CREATE INDEX IF NOT EXISTS idx_decisor_contact_discovery_status
  ON engenharia.decisor_contact_discovery (email_status);

CREATE TABLE IF NOT EXISTS engenharia.decisor_document_searches (
  cnpj text NOT NULL,
  nome text NOT NULL,
  dominio text NOT NULL DEFAULT '',
  cargo text,
  consulta text NOT NULL,
  status text NOT NULL,
  email_encontrado text,
  telefone_encontrado text,
  fonte_url text,
  evidencia text,
  resultados_analisados integer NOT NULL DEFAULT 0,
  pesquisado_em timestamptz NOT NULL DEFAULT now(),
  erro text,
  PRIMARY KEY (cnpj, nome, dominio)
);

CREATE INDEX IF NOT EXISTS idx_decisor_document_searches_status
  ON engenharia.decisor_document_searches (status);

COMMIT;
