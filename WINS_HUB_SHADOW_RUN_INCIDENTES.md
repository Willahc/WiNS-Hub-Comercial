# WiNS Hub — Shadow Run — Registro de Incidentes

> Documento vivo — atualizado em tempo real durante o shadow run.

---

## Classificação

| Severidade | Descrição | Ação |
|:----------:|-----------|:----:|
| **P0** | Segurança, perda de dados, indisponibilidade total | Interromper shadow run IMEDIATAMENTE |
| **P1** | Função crítica indisponível | Interromper shadow run até correção |
| **P2** | Degradação importante | Monitorar, corrigir em até 48h |
| **P3** | Falha menor ou visual | Corrigir conforme disponibilidade |

---

## Incidentes Registrados

### Dia 01 — 2026-07-21

#### INC-001: Staging inacessível externamente (ERR_CONNECTION_TIMED_OUT)
- **Severidade**: P1 (função crítica — ambiente inteiro indisponível)
- **Causa**: UFW (firewall do sistema) com política `DEFAULT DENY`. Apenas portas 22, 80 e 443 liberadas. Porta 18443 bloqueada.
- **Sintoma**: `ERR_CONNECTION_TIMED_OUT` ao acessar `https://winshubcomercial.com.br:18443/demo/` externamente. Localmente (loopback) funcionava perfeitamente.
- **Correção**: `ufw allow 18443/tcp` — liberada porta 18443 no UFW.
- **Ajustes adicionais no Nginx**:
  - `worker_processes`: 1 → `auto`
  - `worker_connections`: 512 → 1024
  - Rate limit: `10r/s burst=20` → `50r/s burst=100` (API), `burst=50` (auth)
  - `proxy_read_timeout`: 10s → 30s (API)
  - `keepalive`: 16/8 → 32/16
  - Adicionado `ssl_session_cache` e `ssl_session_timeout`
- **Duração**: ~2h (início previsto 13:15 UTC → restaurado 14:49 UTC)
- **Impacto**: Shadow run atrasado. Nenhum piloto conseguiu acessar o ambiente antes da correção.
- **Ações preventivas**:
  - Criar checklist de liberação de porta no UFW ao provisionar novo serviço
  - Adicionar validação externa automática pós-deploy

---

## Resumo

| Dia | P0 | P1 | P2 | P3 | Total |
|:---|:--:|:--:|:--:|:--:|:-----:|
| 01 | 0 | 1 | 0 | 0 | 1 |
| **Total** | **0** | **1** | **0** | **0** | **1** |
