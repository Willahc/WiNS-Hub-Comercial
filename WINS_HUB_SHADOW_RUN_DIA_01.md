# WiNS Hub — Shadow Run — Dia 01

## Data: 2026-07-21

---

## Status: ✅ ATIVO

O shadow run foi iniciado conforme autorizado. Segue o congelamento da base.

---

## Congelamento da Base

### Frontend
| Item | Valor |
|------|-------|
| Versão | 0.0.0 (wins_hub_unificado) |
| Build | `/root/wins_hub_unificado/dist/` → `staging-root/demo/` |
| Assets | index.html, assets/, favicon.svg, icons.svg, silent-check-sso.html |
| Prefixo | `/demo/` |

### API (Wave 1 — Unified)
| Item | Valor |
|------|-------|
| Aplicação | `wins_hub_unificado/apps/api/main.py` |
| Framework | FastAPI 0.139.2 |
| Workers | 2 |
| Porta | 127.0.0.1:18085 |
| Runtime | uvicorn 0.51.0 |
| DB User | `wins_hub_api_ro` (read-only) |
| Pool | SimpleConnectionPool(2, 10) |
| Timeout SQL | 8s |

### Schema do Banco
| Schema | Tabelas principais |
|--------|--------------------|
| `canonical_mvp` | entidade_empresa, papel_vertical, atributo_fonte, empresa_geografia |
| `engenharia` | fornecedores, obras, matches_v2, decisores_obra |
| `core` | empresa, papel_vertical |

### Volumes de Dados
| Tabela | Linhas |
|--------|-------:|
| `canonical_mvp.entidade_empresa` | 4.825.673 |
| `canonical_mvp.papel_vertical` | 4.732.572 |
| `canonical_mvp.atributo_fonte` | 13.337.848 |
| `engenharia.fornecedores` | 4.094.527 |
| `engenharia.obras` | 35.690 |

### Índices Existentes
| Índice | Tabela | Tipo | Tamanho |
|--------|--------|:----:|--------:|
| `idx_fornecedores_search_trgm` | engenharia.fornecedores | GIN trigram | 269 MB |
| `idx_forn_razao_social_trgm` | engenharia.fornecedores | GIN trigram (parcial) | 221 MB |
| `idx_forn_nome_fantasia_trgm` | engenharia.fornecedores | GIN trigram (parcial) | 63 MB |
| `idx_forn_cnae_descricao_trgm` | engenharia.fornecedores | GIN trigram (parcial) | 65 MB |
| `idx_af_entidade_status_cob` | canonical_mvp.atributo_fonte | B-tree covering | 789 MB |
| Demais índices | canônico/engenharia | B-tree/GIN | - |

### Infraestrutura
| Componente | Tecnologia | Status |
|------------|------------|:------|
| Nginx staging | nginx 1.31 | ✅ Porta 18443 |
| Keycloak | quay.io/keycloak/keycloak:26.3.3 | ✅ Porta 18086 |
| PostgreSQL | postgis/postgis:16-3.4-alpine | ✅ Porta 5432 |
| API Agro (legado) | FastAPI / wins_agro_v1 | ✅ Porta 18083 |
| Certbot | certbot/certbot:v5.6.0 | ✅ SSL ativo |

### Configuração do Nginx (Staging)
- **PID**: 1547950
- **Config**: `/root/wins_hub_unificado/staging/nginx-host.conf`
- **Listen**: 18443 SSL
- **Upstreams**: wave1_api → 127.0.0.1:18085, wave1_keycloak → 127.0.0.1:18086
- **SSL**: `/etc/letsencrypt/live/winshubcomercial.com.br/`

### Configuração do Keycloak
- **Admin**: gate-admin / Ht1ZhNQHflDHMXCsUGnbjIvxlHDLl8Vm5nt8TK0efJLfdRO4
- **Realm**: wins-hub
- **Client**: wins-hub-spa

### Data e Hora de Início
- **Data**: 2026-07-21
- **Hora**: 14:49 UTC (após correção de firewall — INC-001)
- **Responsável**: Gate de Performance Onda 1

---

## Endpoints Disponíveis

| Endpoint | URL | Status |
|----------|-----|:------|
| Frontend | `https://winshubcomercial.com.br:18443/demo/` | ✅ |
| API Health | `https://winshubcomercial.com.br:18443/api/v1/health` | ✅ |
| API Fornecedores | `https://winshubcomercial.com.br:18443/api/v1/fornecedores` | ✅ |
| API Empresas | `https://winshubcomercial.com.br:18443/api/v1/empresas` | ✅ |
| API Obras | `https://winshubcomercial.com.br:18443/api/v1/engenharia/obras` | ✅ |
| API Decisores | `https://winshubcomercial.com.br:18443/api/v1/decisores` | ✅ |
| API Oportunidades | `https://winshubcomercial.com.br:18443/api/v1/oportunidades` | ✅ |
| Keycloak Auth | `https://winshubcomercial.com.br:18443/auth/` | ✅ |

---

## Métricas do Dia 01

Não há chamadas de usuários reais — ambiente recém-iniciado.

### Pool de Conexões
| Métrica | Valor |
|---------|:------|
| API Workers | 2 |
| Pool Mínimo | 2 |
| Pool Máximo | 10 |
| Conexões Ativas | 0 |

### Performance (benchmark interno pré-shadow)
| Endpoint | p95 | Meta |
|----------|----:|:----:|
| Fornecedores (busca textual) | 1.241 ms | < 2.000 ms ✅ |
| Empresa 360° (lookup CNPJ) | 2,8 ms | < 3.000 ms ✅ |
| Obras (página 1) | 61 ms | - |
| Decisores (cargo) | 35 ms | - |

---

## Incidentes do Dia 01

| ID | Tipo | Descrição | Status |
|:--|:-----|:-----------|:-------|
| INC-001 | P1 | Staging inacessível externamente — UFW bloqueando porta 18443 | ✅ Corrigido (14:49 UTC) |

---

## Decisão de Continuidade: ✅ CONTINUAR

Incidente INC-001 corrigido (UFW liberado). Ambiente estável. Shadow run segue para Dia 02.

---

## Próximos Passos (Dia 02)

- Iniciar homologação interna
- Comparar dados com legado
- Validar filtros e permissões
- Monitorar logs de erro
