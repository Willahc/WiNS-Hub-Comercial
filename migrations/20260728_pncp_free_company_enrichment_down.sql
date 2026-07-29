BEGIN;
REVOKE INSERT, UPDATE ON engenharia.decisores_preservados FROM wins_app;
DROP TABLE IF EXISTS engenharia.pncp_company_officers;
DROP TABLE IF EXISTS engenharia.pncp_company_profiles;
COMMIT;
