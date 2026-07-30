# WiNS Hub — Staging isolado da Onda 1

## Endereços

- Frontend: `https://winshubcomercial.com.br:18443/demo/`
- API: `https://winshubcomercial.com.br:18443/api/v1/`
- Health sanitizado: `https://winshubcomercial.com.br:18443/healthz`
- Keycloak: `https://winshubcomercial.com.br:18443/auth/`

O staging usa um processo Nginx isolado, configuração em `staging/nginx-host.conf`, porta TLS 18443 e upstreams somente em loopback: API em `127.0.0.1:18085` e Keycloak em `127.0.0.1:18086`. A porta Uvicorn não está exposta externamente. O Nginx de produção e a raiz pública não foram alterados.

## Controles validados

| Controle | Configuração | Evidência |
|---|---|---|
| TLS | TLS 1.2/1.3, certificado válido do domínio | handshake HTTPS aprovado |
| CORS | somente `https://winshubcomercial.com.br:18443` | origem permitida recebe ACAO; origem estranha não recebe |
| Timeout | connect 2s; API read/send 10s; SQL 8s | configuração ativa e consultas limitadas |
| Payload | 1 MiB | requisição de 1,1 MiB rejeitada com 413 |
| Rate limiting | 10 req/s, burst 20 | 50 requisições concorrentes: 23 respostas 429 |
| Request ID | gerado no proxy e propagado à API | cabeçalho/erro correlacionável |
| Health | resposta sem versão, banco, host ou credencial | `{"status":"ok"}` |
| SPA | `try_files` para `/demo/index.html` | refresh direto preservado |

Artefato publicado: `/root/wins_hub_unificado/staging-root/demo/`. Configuração de staging: `/root/wins_hub_unificado/staging/nginx-host.conf` e `/root/wins_hub_unificado/staging/keycloak/realm-wins-hub.json`.
