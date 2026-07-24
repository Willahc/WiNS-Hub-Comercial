# WiNS Hub — Matriz origem–destino

| Domínio lógico | Origem real preferencial | Alternativas/staging | Chave de integração | Destino no Hub | Estado |
|---|---|---|---|---|---|
| Empresas | `core.empresa` | fornecedores, transportadoras, embarcadores, CNES | CNPJ normalizado | Empresas, Empresa 360°, todas verticais | canônico candidato; reconciliação pendente |
| Pessoas/decisores | `core.decisor` + `core.decisor_vinculo` | decisores de obra, fazenda e saúde | pessoa protegida + vínculo + fonte | Pessoas, Empresa 360°, Comercial | PII; governança pendente |
| Contatos | `core.contato` | contatos embutidos por vertical | CNPJ+tipo+valor normalizado | Empresa 360°, Comercial | deduplicação/validade pendentes |
| Proveniência | `canonical_mvp.atributo_fonte` | colunas `fonte_*` | entidade+atributo+fonte | Empresa 360° | base existe; contrato API ausente |
| Territórios | `referencia.municipio` + `canonical_mvp.empresa_geografia` | IBGE/GeoJSON/MapBiomas | código IBGE | Mapa e Territorial | boa base; camadas não unificadas |
| Obras | `engenharia.obras` | clone `wins_hub_staging.public.obras` | UUID + `id_externo` reconciliado | Engenharia/obra/mapa | disponível; 432 duplicidades de chave de negócio |
| Projetos | obras como aproximação | `vw_projetos_mestre` (0) | a definir | Engenharia | entidade projeto real ausente |
| Fornecedores | `engenharia.fornecedores` + `core.empresa` | clone staging | CNPJ | Engenharia/Empresas | sobreposição massiva |
| Contratos/licitações | campos/fontes em obras | scripts/exports legados | identificador público | detalhe da obra | entidades próprias ausentes |
| Cronogramas | fase/datas em obras | atualizações de obra | obra+marco | detalhe da obra | cronograma estruturado ausente |
| Oportunidades Engenharia | `matches_v2`/views de matching | impacto econômico | obra+empresa+versão do modelo | Oportunidades/Comercial | regras e versão canônica pendentes |
| Fazendas/propriedades | `prospeccao.imovel_rural` | `fazenda_area`, `fazenda_nacional` | CAR/SIGEF/matrícula/CNPJ | Agro/mapa/territorial | resolução de identidade pendente |
| Produtores | proprietário/vínculo em prospecção | decisores de fazenda | documento protegido | Agro/Pessoas | PII e unicidade pendentes |
| Técnicos | `v_tecnico_full`/`tecnico_crea` | CSVs veterinários | conselho+UF ou CNPJ/CPF | Agro/Pessoas | profissão nula em 48.176 linhas |
| Rebanhos | `rebanho_municipio` | indicadores IBGE | município+ano | Agro/territorial | agregado, não operacional |
| Animais | `fazenda.animal` | `mercado.reprodutor` | ID/registro | Agro/genética | somente 8 animais operacionais |
| Genética/genealogia | `mercado.reprodutor` | touro central/oferta | registro+programa | Agro/genética | 118.793 registros; qualidade variável |
| Transportadoras | `log.transportadora` | RNTRC staging | CNPJ+RNTRC | Logística/Empresa 360° | reconciliação 151.729 × 1.124.684 |
| Veículos | RNTRC agregado | staging | placa/identificador inexistente no canônico | Logística | entidade individual ausente |
| Rotas | infraestrutura DNIT/OSM/PRF | `route_plan` (0) | rota/corredor | Logística/mapa | referência existe; rotas operacionais não |
| Cargas/fretes | campos prováveis em embarcador/match | COMEX agregado | frete/carga inexistente | Logística | entidades transacionais ausentes |
| Capacidade logística | RNTRC/ativos agregados | Caminhão Vazio | transportadora/tipo | Logística | estimada, não disponibilidade em tempo real |
| Oportunidades Logística | `log.match` | export fila comercial | match ID | Oportunidades/Comercial | 49.120 candidatos; não contratos |
| Estabelecimentos Saúde | `saude.estabelecimentos` | clone staging | CNES | Saúde/Empresa 360° | disponível; deduplicação CNES/CNPJ pendente |
| Leitos/capacidade | `saude.cnes_capacidade` | CNES | município | Saúde/territorial | 5.570 agregados municipais |
| Indicadores Saúde | schemas Saúde | DataSUS/ANS derivados | município+período | Saúde/territorial | boa cobertura municipal; periodicidade desigual |
| Oportunidades Saúde | `oportunidade_investimento` | indicadores municipais | município+modelo | Oportunidades | score analítico, não pipeline comercial |
| Eventos | logs de atualização por vertical | `eventos_pipeline` (0) | evento+fonte | Eventos/timeline | modelo transversal ausente |
| Pipeline comercial | endpoints/tabelas do legado comercial | matches verticais | conta+oportunidade+atividade | Comercial | não há contrato transversal homologado |

Princípio de integração: preservar a fonte e sua data, reconciliar identidade antes de unir linhas e nunca somar staggings clonados como entidades novas.
