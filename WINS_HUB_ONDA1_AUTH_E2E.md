# WiNS Hub — Homologação de autenticação E2E da Onda 1

Execução em 2026-07-21 contra o frontend e a API do staging TLS, com realm isolado `wins-hub-staging` e client público `wins-hub-spa`.

| Cenário | Resultado |
|---|---|
| Login pelo frontend | Aprovado; retorno autenticado em `/demo/engenharia` |
| Logout | Aprovado; sessão encerrada |
| Refresh token | Aprovado (200); após logout, refresh rejeitado (400) |
| Expiração | Aprovado; token expirado rejeitado com 401 |
| Sem token | 401 |
| Token inválido | 401 |
| Role autorizada | `engenharia` acessa obras (200) |
| Role insuficiente | usuário sem `decisores` recebe 403 |
| Permissões por endpoint | `engenharia`, `empresa360`, `decisores`, `decisores:sensitive` aplicadas |
| Acesso direto por URL | Aprovado em `/demo/engenharia` |
| Token no `localStorage` | Ausente; token mantido em memória pelo cliente Keycloak |
| Console do navegador | zero erros na jornada E2E |

Contatos de decisores permanecem mascarados sem `decisores:sensitive`. Acesso aos campos integrais registra subject e natureza sensível no log da API. Senhas, tokens e segredos de teste não constam neste relatório.
