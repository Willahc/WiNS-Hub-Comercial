 CREATE OR REPLACE FUNCTION engenharia.fn_flip_noticia_to_manual_pos_enrich()                                   +
  RETURNS trigger                                                                                               +
  LANGUAGE plpgsql                                                                                              +
 AS $function$                                                                                                  +
 DECLARE                                                                                                        +
   v_obra obras%ROWTYPE;                                                                                        +
 BEGIN                                                                                                          +
   -- Só roda se o decisor inserido/atualizado não está excluído                                                +
   IF NEW.excluido_em IS NOT NULL THEN                                                                          +
     RETURN NEW;                                                                                                +
   END IF;                                                                                                      +
                                                                                                                +
   SELECT * INTO v_obra FROM obras WHERE id = NEW.obra_id;                                                      +
                                                                                                                +
   -- Condições: NOTICIA + cnpj válido + agora tem ao menos 1 decisor ativo                                     +
   IF v_obra.fonte_tipo = 'NOTICIA'                                                                             +
      AND v_obra.cnpj IS NOT NULL AND LENGTH(v_obra.cnpj) = 14                                                  +
      AND (v_obra.visivel IS NULL OR v_obra.visivel = TRUE) THEN                                                +
     UPDATE obras                                                                                               +
     SET fonte_tipo = 'MANUAL',                                                                                 +
         validacao_obra_at = COALESCE(validacao_obra_at, NOW()),                                                +
         observacoes_validacao = COALESCE(observacoes_validacao||' | ','')                                      +
           || 'auto_flip_noticia_manual_' || TO_CHAR(NOW(),'YYYYMMDD')                                          +
           || ': decisor+cnpj enrichados (drain_queue/manual)'                                                  +
     WHERE id = NEW.obra_id;                                                                                    +
     -- Recompute em chamada subsequente (não pode chamar aqui — trigger em decisores triggera trigger em obras)+
     PERFORM recompute_classificacao_obra(NEW.obra_id);                                                         +
   END IF;                                                                                                      +
                                                                                                                +
   RETURN NEW;                                                                                                  +
 END;                                                                                                           +
 $function$                                                                                                     +
 

