# Release bloqueada: agro-radar-stages-v2

Status: **REPROVADA — NÃO APLICAR**

## Candidatos declarados

- Backend: `a20c968203ce0b70dfdb76db9a34e9aa5a313d89`
- Frontend: `bc59ef97382d0871d61f6dbd7caf2d0d0dccdbc0`

## Imagem rejeitada

- Tag proposta: `wins-hub-api:agro-radar-a20c968`
- ID aplicado: `sha256:0a20cf612946e7d2c8411409fd12d8fc77b711d146bd46d5afedbf550b3344af`
- Revisão OCI: `a20c968203ce0b70dfdb76db9a34e9aa5a313d89`
- Criada em: `2026-08-02T11:56:11.861327243Z`

A tag foi reconstruída posteriormente e atualmente pode resolver para outro ID. O ID acima é o registrado no artifact do apply e deve prevalecer na auditoria da ocorrência.

## Falha e rollback

- Janela observada: `2026-08-02T11:56:44Z` a `2026-08-02T12:07:49Z`
- Rotas com regressão 5xx: `/api/v1/agro/pessoas-vinculos`, Logística, Saúde e Visão Geral.
- Backup: `/srv/winshub/backups/releases/agro-radar-stages-v2-20260802T115605Z`
- Container anterior preservado: `wins_agro_v1-hub-api-1-release-backup-20260802T115605Z`
- Imagem anterior registrada: `wins-hub-api:6ee8f0e5bea8cf738b466b73766dd88f350128bf`
- Rollback: `rollback-complete`
- SPA restaurado comprovado por hashes do backup e pelo artifact da release anterior: `c48411b96d1d283c3aa2f6c21d615f13cfafbf48`

## Motivo do bloqueio

O backend reconstruído introduziu regressões fora do escopo do Radar. A causa técnica por rota permanece sujeita à auditoria forense da imagem funcional; não se atribui a falha apenas a permissões sem explicar a divergência de comportamento entre as imagens.

O manifesto ativo foi restaurado para backend `6ee8f0e5bea8cf738b466b73766dd88f350128bf` e frontend `c48411b96d1d283c3aa2f6c21d615f13cfafbf48`. Esta release não pode voltar a ser apontada pelo manifesto nem receber apply.

Nenhum segredo é registrado neste documento.
