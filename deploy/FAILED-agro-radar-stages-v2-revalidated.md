# Release bloqueada: agro-radar-stages-v2-revalidated

Status: **REPROVADA — PRODUÇÃO RESTAURADA**

## Ocorrência

O gate diferencial de backend passou com zero `FAIL_*`, inclusive com paridade
de Pessoas & Vínculos e das rotas preservadas e com os três 500 preexistentes
classificados como `KNOWN_BASELINE_FAILURE`. Os 90 testes backend e os 137
testes frontend também passaram.

Após o apply, a validação visual encontrou uma falha funcional que os testes e
o gate HTTP não cobriam: ao abrir a aba Candidatas, o frontend
`bc59ef97382d0871d61f6dbd7caf2d0d0dccdbc0` enviou
`stage=CANDIDATAS`. O contrato backend aceita `CANDIDATE`, e a chamada retornou
HTTP 422, com erro no console em desktop e mobile.

## Decisão e rollback

- classificação: `FAIL_CONTRACT_CHANGE` / falha do Radar;
- produção candidata observada de `2026-08-03T17:21:56Z` a
  `2026-08-03T17:24:47Z`;
- backup: `/srv/winshub/backups/releases/agro-radar-stages-v2-revalidated-20260803T172102Z`;
- rollback: `rollback-complete-visual-radar-422`;
- backend restaurado: `6ee8f0e5bea8cf738b466b73766dd88f350128bf`;
- frontend restaurado: `c48411b96d1d283c3aa2f6c21d615f13cfafbf48`.

O gate frontend agora bloqueia explicitamente essa serialização inválida de
estágio. Os commits candidatos foram preservados sem modificação. Nenhuma base
foi criada, nenhuma permissão ou Basic Auth foi alterada e nenhum SQL destrutivo
foi executado.
