CREATE TRIGGER audita_plano_sem_pagamento AFTER INSERT OR UPDATE OF plano ON engenharia.prestadores FOR EACH ROW EXECUTE FUNCTION engenharia.trg_audita_plano_sem_pagamento();

