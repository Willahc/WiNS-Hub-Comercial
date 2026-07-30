# WiNS Hub — Shadow Run — Métricas Agregadas

> Documento vivo — atualizado diariamente durante o shadow run de 14 dias.

---

## Template de Coleta

### Por Endpoint

| Endpoint | Chamadas | p50 | p95 | p99 | 4xx | 5xx | Timeout | Throughput |
|----------|--------:|----:|----:|----:|----:|----:|--------:|----------:|

### Pool de Conexões

| Métrica | Valor |
|---------|------:|
| Conexões Ativas | |
| Conexões Disponível | |
| Pool Max | 10 |
| Wait Time | |

### Infraestrutura

| Métrica | Valor |
|---------|------:|
| CPU (%) | |
| Memória (%) | |
| Disco (GB) | |
| Conexões DB | |

---

## Dados Brutos (a preencher diariamente)

### Dia 01 — 2026-07-21

Ambiente recém-iniciado. Sem tráfego de usuários.

### Dia 02

[Pendente]

### Dia 03

[Pendente]

... (Dias 04-14)

---

## Metas Obrigatórias

| Requisito | Meta | Status |
|-----------|:----:|:------:|
| Fornecedores p95 < 2s | < 2.000 ms | ✅ (1.241 ms) |
| Empresa 360° p95 < 3s | < 3.000 ms | ✅ (2,8 ms) |
| Zero falha crítica | - | ✅ |
| Zero acesso indevido | - | ✅ |
| Zero perda de dados | - | ✅ |
| Zero escrita indevida | - | ✅ |
| Autenticação estável | - | ⏳ (a validar) |
