BEGIN;

DROP VIEW IF EXISTS engenharia.vw_fila_revisao_duplicadas;

UPDATE engenharia.obras
   SET status_portao = 'EM_ANALISE_MANUAL',
       visivel = false,
       portao_motivo = NULL
 WHERE status_portao = 'REVISAO_DUPLICIDADE';

COMMIT;
