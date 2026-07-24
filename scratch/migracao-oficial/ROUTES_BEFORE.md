# Mapeamento de Rotas Anterior — Pré-Migração

## Rotas Nginx Anteriores
- `/` -> Não configurado no Nginx HTTPS 18443 (retornava erro ou 404 Nginx)
- `/demo/` -> Servia a SPA antiga de `/root/wins_hub_unificado/staging-root/demo`
- `/mockups-v2/` -> Servia o protótipo de `/root/wins_hub_unificado/mockups-v2/dist`
- `/api/v1/` -> Proxy para API unificada na porta 18085
- `/api/` -> Proxy para API legada na porta 18083
- `/auth/` -> Proxy para Keycloak na porta 18086

## Rotas React Router em /demo/ (Anteriores)
- `/demo/login`
- `/demo/visao-geral`
- `/demo/engenharia`
- `/demo/engenharia/obras`
- `/demo/engenharia/obras/:id`
- `/demo/agro`
- `/demo/logistica`
- `/demo/saude`
- `/demo/relacionamentos`
- `/demo/empresa-360`
- `/demo/territorial`
- `/demo/busca`
