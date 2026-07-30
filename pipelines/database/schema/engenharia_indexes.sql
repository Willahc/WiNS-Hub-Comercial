CREATE INDEX decisor_jobs_user_atualizado_idx ON engenharia.decisor_jobs USING btree (user_id, atualizado_em DESC);

