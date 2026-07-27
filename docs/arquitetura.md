# Arquitetura do WiNS Hub

## Diagrama de infraestrutura

```
                            Internet
                               |
                         [DNS: winshubcomercial.com.br]
                         [DNS: winshubagro.cloud]
                               |
                         [Cloudflare/CDN] (opcional)
                               |
                     +---------+---------+
                     |                   |
              [nginx host:80/443]   [nginx docker:80/443]
                     |            (winshubagro.cloud)
          +----------+----------+
          |          |          |
     [shell estático]     [certbot]
     /opt/winshub/shell   TLS renewal
          |
   +------+------+------+------+
   |      |      |      |      |
  /agro  /saude /log  /engenharia
   :80    :80    :80    :81
   |      |      |      |
   v      v      v      v
hub_agro hub_saude hub_log hub_engenharia
 :18083   :18080   :18082   :18081
   |                         
   v                         
[FastAPI] ←─── [PostgreSQL 16 + PostGIS]
   |                    |  :5432
   v                    v
[frontend/]     [canonical_mvp]
 Jinja2+Alpine   [4.8M empresas]
```

## Stack

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Reverse proxy | nginx | 1.31 |
| Backend | Python (FastAPI) | 3.12 |
| Banco | PostgreSQL + PostGIS | 16 / 3.4 |
| Frontend | Jinja2 + Alpine.js + Leaflet + Chart.js | — |
| PWA | Service Worker + manifest | — |
| Autenticação | JWT (HS256) + bcrypt + TOTP + WebAuthn | — |
| Orquestração | Docker Compose | v2 |
| TLS | Let's Encrypt (certbot) | — |
| Container runtime | Docker | — |

## Banco de dados

### Schemas principais

| Schema | Finalidade | Tamanho |
|--------|-----------|---------|
| `core` | Dados cadastrais centrais (empresa, contato) | ~1.5 GB |
| `canonical_mvp` | Modelo canônico empresa 360° | ~400 MB |
| `prospeccao` | Prospecção, leads, auditoria | ~200 MB |
| `catalogo` | Catálogo genético (raças, touros, DEPs) | ~50 MB |
| `mercado` | Preços, ofertas, avaliações | ~30 MB |
| `fazenda` | Dados de fazenda, animais, manejo | ~200 MB |
| `foundation` | Multi-tenancy (usuários, organizações) | ~10 MB |
| `log` | Transportadoras e embarcadores | ~80 MB |
| `saude` | Estabelecimentos de saúde | ~120 MB |
| `engenharia` | Obras e fornecedores | ~60 MB |

### Tabelas críticas (canonical_mvp)

| Tabela | Registros | Finalidade |
|--------|-----------|-----------|
| `entidade_empresa` | 4.825.673 | Empresas canônicas |
| `papel_vertical` | 4.732.572 | Papéis nas 4 verticais |
| `atributo_fonte` | ~13M | Proveniência de atributos |
| `empresa_geografia` | 376.444 | Dados geográficos enriquecidos |
| `vw_empresa_360` | (view) | Visão consolidada com geografia |

## Fluxo de requisição

```
Usuário → winshubcomercial.com.br/agro/
  → nginx rewrite → / (remove prefixo)
  → proxy_pass → hub_agro_api (127.0.0.1:18083)
  → FastAPI (main.py)
    → middleware (auth check)
    → router (empresa_360, simulador, etc.)
    → service (lógica de negócio)
    → repository (SQL)
    → PostgreSQL
  → TemplateResponse (HTML) ou JSONResponse (API)
  → nginx add_header (security headers)
  → Usuário
```

## Empresa 360° — Fluxo de dados

```
Fontes originais (core.empresa, log.*, saude.*)
  → [FASE B4 + B81] → canonical_mvp.entidade_empresa
  → [FASE B81]      → canonical_mvp.empresa_geografia
  → [FASE B83]      → canonical_mvp.vw_empresa_360 (view)
  → [API]           → GET /api/empresa/{cnpj}
  → [Frontend]      → empresa_360.html (Alpine.js)
```

## Segurança

- **Autenticação**: JWT com bcrypt + TOTP (opcional) + WebAuthn
- **Sessão**: httponly, secure, samesite=lax, 8h
- **Rate limit**: login (10/min), API (20/s), simulador (10/min), CSV (2/min)
- **Headers**: HSTS, CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy
- **Banco**: wins_app (DML limitado), sem superuser na aplicação
- **Backup**: cifrado GPG assimétrico, offsite
- **Auditoria**: prospeccao.audit_log (login, export, consultas)
