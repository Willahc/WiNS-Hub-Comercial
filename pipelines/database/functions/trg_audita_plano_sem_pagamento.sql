 CREATE OR REPLACE FUNCTION engenharia.trg_audita_plano_sem_pagamento()                                 +
  RETURNS trigger                                                                                       +
  LANGUAGE plpgsql                                                                                      +
 AS $function$                                                                                          +
 BEGIN                                                                                                  +
     IF COALESCE(NEW.plano, 'GRATUITO') <> 'GRATUITO'                                                   +
        AND NEW.plano IS DISTINCT FROM OLD.plano                                                        +
        AND NOT EXISTS (                                                                                +
            SELECT 1 FROM pagamentos p                                                                  +
            WHERE p.prestador_id = NEW.id                                                               +
              AND p.tipo = 'plano'                                                                      +
              AND p.status_local = 'aprovado'                                                           +
        )                                                                                               +
     THEN                                                                                               +
         INSERT INTO plano_alteracoes_suspeitas (prestador_id, plano_antigo, plano_novo, contexto)      +
         VALUES (NEW.id, OLD.plano, NEW.plano, TG_OP || ' em prestadores.plano sem pagamento aprovado');+
     END IF;                                                                                            +
     RETURN NEW;                                                                                        +
 END;                                                                                                   +
 $function$                                                                                             +
 

