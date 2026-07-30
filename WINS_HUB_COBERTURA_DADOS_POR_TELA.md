# WiNS Hub — Cobertura de dados por tela

Todas as 20 rotas publicadas usam hoje `MockHubAdapter` ou `engineeringService` com fixtures. Logo, **cobertura real renderizada atual = 0%** nas telas de dados. A coluna potencial mede campos de tela que podem ser atendidos pelas fontes já encontradas, antes de governança e integração.

| # | Rota | Fontes/campos reais disponíveis | Ausências principais | Endpoint existente | Endpoint necessário | Adapter atual | Mock | Real atual | Potencial |
|---:|---|---|---|---|---|---|---|---:|---:|
| 1 | `/demo/` | empresas, obras, propriedades, logística, CNES, indicadores | eventos transversais e KPIs homologados | API unificada `/dashboard/kpis` só em código | `/api/v1/overview` agregado | `MockHubAdapter` | sim | 0% | 70% |
| 2 | `/demo/eventos` | logs de obras e atualizações por fonte | modelo transversal de evento | `/eventos` só em API não implantada | eventos paginados/filtros | `MockHubAdapter` | sim | 0% | 35% |
| 3 | `/demo/mapa` | coordenadas de imóveis, empresas, CNES, logística; município IBGE | contrato de camadas e clusters | Agro `/api/map`; logística parcial | `/api/v1/map/features` | `MockHubAdapter` | sim | 0% | 78% |
| 4 | `/demo/oportunidades` | matches Engenharia/Logística e scores Saúde/Agro | oportunidade canônica e estágio único | `/oportunidades` só em código | lista+detalhe unificados | `MockHubAdapter` | sim | 0% | 68% |
| 5 | `/demo/empresas` | 4.825.673 empresas, contatos, papéis, geografias | busca/facetas unificadas e ACL de PII | Agro `/api/empresas`; legado fornecedores | `/api/v1/empresas` implantado | `MockHubAdapter` | sim | 0% | 88% |
| 6 | `/demo/comercial` | contas, matches, pipeline legado, atividades parciais | pipeline multivertical homologado | vários `/api/vendas/*` e `/api/perfil/pipeline` | `/api/v1/comercial/*` | `MockHubAdapter` | sim | 0% | 58% |
| 7 | `/demo/engenharia` | obras, fornecedores, decisores, valores, fases, matches | KPI/contrato unificado | `/api/obras`, dashboard legado | `/api/v1/engenharia/dashboard` | `engineeringService` | sim | 0% | 90% |
| 8 | `/demo/logistica` | transportadoras, embarcadores, matches, DNIT/OSM/PRF/COMEX | veículos, fretes e rotas operacionais | API 18082 e Caminhão Vazio | `/api/v1/logistica/dashboard` | `MockHubAdapter` | sim | 0% | 68% |
| 9 | `/demo/agro` | propriedades, técnicos, rebanhos, genética, território | produção por propriedade consistente | ampla API Agro | `/api/v1/agro/dashboard` adapter | `MockHubAdapter` | sim | 0% | 82% |
| 10 | `/demo/saude` | CNES, leitos, médicos, indicadores municipais | profissionais CBO/ESF/ACS | API Saúde local | `/api/v1/saude/dashboard` | `MockHubAdapter` | sim | 0% | 83% |
| 11 | `/demo/territorial` | IBGE, geografia, indicadores das quatro verticais | recorte temporal e normalização | Agro território parcial | `/api/v1/territorios/{ibge}` | `MockHubAdapter` | sim | 0% | 80% |
| 12 | `/demo/configuracoes` | preferências locais apenas | perfil/permissão/sessão reais | auth legada fragmentada | `/api/v1/me`, preferências, permissões | auth mock/local | sim | 0% | 20% |
| 13 | `/demo/login` | autenticação legada Agro/Comercial | identidade unificada e estados reais | endpoints legados distintos | `/api/v1/auth/*` homologado | auth mock | sim | 0% | 25% |
| 14 | `/demo/eventos/:id` | atualização de obra e fontes | evento transversal com relações | `/eventos/{id}` só em código | detalhe de evento real | `MockHubAdapter` | sim | 0% | 35% |
| 15 | `/demo/oportunidades/:id` | scores, justificativas e empresas em matches | ID/estágio canônicos | nenhum detalhe unificado | `/api/v1/oportunidades/{id}` | `MockHubAdapter` | sim | 0% | 65% |
| 16 | `/demo/empresas/:id` | cadastro, contatos, papéis, geografias, fontes, vínculos | histórico/eventos transversais e ACL | Agro Empresa 360°; legado intel | `/api/v1/empresas/{cnpj}/360` | `MockHubAdapter` | sim | 0% | 86% |
| 17 | `/demo/engenharia/obras/:id` | quase todos os campos de obra, decisores, matches e impacto | cronograma estruturado, contratos/licitações | `/api/obras/{id}/detalhe` | adapter tipado Hub | `engineeringService` | sim | 0% | 88% |
| 18 | `/demo/engenharia/mapa` | obras com município; parte sem localização | 10.177 obras sem município e coordenada não canônica | `/api/obras` | geo endpoint com bbox/clustering | `engineeringService` | sim | 0% | 62% |
| 19 | `/demo/engenharia/obras` | 35.690 obras, filtros/fases/status/valor | semântica unificada de status | `/api/obras` | endpoint paginado tipado | `engineeringService` | sim | 0% | 94% |
| 20 | `/demo/engenharia/empresas` | 4.094.527 fornecedores + clientes + core | resolução fornecedor/empresa | fornecedores legado | `/api/v1/engenharia/empresas` | `engineeringService` | sim | 0% | 91% |

**Resultado:** disponibilidade potencial média aproximada de 68,1%, mas cobertura real publicada é 0% porque nenhum adapter HTTP real está selecionado. Percentuais potenciais são avaliação campo-a-campo, não declaração de prontidão.
