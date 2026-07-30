# WiNS Hub — Inventário de fontes reais

## Escopo e método

Inventário somente leitura realizado em 2026-07-21. Foram inspecionados PostgreSQL/PostGIS, schemas, tabelas, views, APIs, CSV, XLSX, JSON, GeoJSON, ETLs, staging, backups e sistemas legados. Nenhuma credencial é reproduzida. Nenhuma migração, DDL, view, tabela ou alteração de dados foi executada.

## Sistemas encontrados

| Sistema | Local/serviço | Banco | Situação |
|---|---|---|---|
| WiNS Agro v1 | `/root/wins_agro_v1`; API local 18083 | `wins_agro` | ativo; também hospeda os schemas canônicos transversais e das quatro verticais |
| WiNS Engenharia/Comercial legado | `/opt/winshub/comercial`; API local 18081 | `wins_agro` e staging | ativo; API extensa de obras, fornecedores, decisores e matches |
| WiNS Logística | `/opt/winshub/log`; API local 18082 | `wins_agro` | ativo |
| Caminhão Vazio | `/opt/winshub/caminhao-vazio` | `caminhao_vazio_staging` | caso interno de Logística; não é quinta vertical |
| WiNS Saúde | serviço local 18080 | `wins_agro` e `wins_saude_staging` | ativo |
| WiNS Hub unificado | `/root/wins_hub_unificado` | sem API unificada implantada | SPA publicada usa mocks; código de API parcial existe |

PostgreSQL 16.4 com PostGIS 3.4.3. Extensões relevantes: PostGIS, pg_trgm, unaccent, pgcrypto, uuid-ossp, earthdistance e cube.

## Inventário por domínio

| Origem / objeto | PK ou chave | Atualização observada | Campos principais | Qualidade / duplicidade | PII | Destino |
|---|---|---|---|---|---|---|
| `wins_agro.engenharia.obras` | `id` UUID; negócio `id_externo` | até 2026-07-17 | nome, empresa/CNPJ, setor, município/UF, valor, fase, status, licença, necessidades, fonte, datas, executora | 35.690; 16.633 visíveis; 10.177 sem município; 24 sem valor; 27 sem fase; 13.337 sem CNPJ; 23.343 sem data; 432 repetições de `id_externo` | decisor/telefone/email embutidos | Engenharia, mapa, eventos, oportunidades |
| `engenharia.fornecedores` | `cnpj` | julho/2026 | RFB, CNAE, endereço, contatos, situação, porte, capital | 4.094.527; cadastro massivo, exige deduplicação com `core.empresa` | contatos | Empresas, Empresa 360°, Engenharia |
| `engenharia.decisores_obra` | `id`; negócio obra+nome+cargo | julho/2026 | obra, nome, cargo, LinkedIn, email, telefone, confiança | 17.914; fonte manual/pública; requer política de confiança e exclusão | sim | Pessoas, Empresa 360°, obra |
| `engenharia.matches_*` | IDs próprios/compostos | julho/2026 | obra, fornecedor, score, cadeia, necessidade | até 9.485.069 linhas em view; múltiplas versões sobrepostas | indireta | Oportunidades/Comercial |
| `prospeccao.imovel_rural` | `id`; negócios CAR/SIGEF/matrícula | julho/2026 | propriedade, proprietário, CPF/CNPJ, município, coordenadas, áreas, NDVI, rebanhos, score | 8.291.331; mistura identificadores e fontes; requer regra de imóvel único | sim | Agro, mapa, territorial, Empresa 360° |
| `prospeccao.fazenda_area` | `fazenda_area_id` | julho/2026 | CNPJ básico, CAR, município IBGE, área, fonte | 6.072.499; fonte explicitamente sem CPF | não direta | Agro/territorial |
| `prospeccao.v_tecnico_full` | CNPJ14 quando presente | julho/2026 | nome, categoria, profissão, município, UF, CRMV, contatos | 53.270; profissão nula em 48.176; somente 776 veterinários e 476 zootecnistas classificados | sim | Agro, Pessoas, Comercial |
| `mercado.reprodutor` | `id`; registro como negócio | julho/2026 | raça, sexo, genealogia, genotipagem, origem, central | 118.793; 808 sem sexo; mistura machos e fêmeas | não | Agro/genética |
| `fazenda.animal` | `id` | julho/2026 | animal, sexo, genealogia, reprodução | somente 8 animais; não representa o universo nacional | não | operação Agro |
| `log.transportadora` | `id`; CNPJ/RNTRC | julho/2026 | empresa, RNTRC, corredor, contatos, origem/destino, geo, CRM | 151.729; precisa reconciliar com RNTRC staging de 1.124.684 | sim | Logística, Empresa 360°, Comercial |
| `log.embarcador` | `id`; CNPJ | julho/2026 | empresa, setor/carga, corredor, demanda, contatos, geo | 52.473; enriquecimento parcial | sim | Logística, Empresa 360° |
| `log.match` | `id`; transportadora+embarcador+corredor | julho/2026 | rota, scores, justificativa, estágio, próxima ação | 49.120; é match comercial, não frete contratado | possível | Oportunidades/Comercial |
| `log.route_plan` | `id` | — | plano de rota | 0 registros | não | Logística/mapa |
| `saude.estabelecimentos` | `id`; CNES como negócio | junho-julho/2026 | CNES/CNPJ, tipo, esfera, endereço/geo, capacidades, contato, decisor | 623.208; view de decisores tem repetição por estabelecimento | sim | Saúde, Empresa 360°, mapa |
| `saude.cnes_capacidade` | `municipio_cod` | 2026-06-22 | população, leitos total/SUS/UTI, equipamentos | 5.570 municípios; agregado municipal, não por estabelecimento | não | Saúde/territorial |
| `saude.oportunidade_investimento` | município | junho/2026 | indicadores e score municipal | 5.570; oportunidade analítica, não pipeline comercial | não | Saúde/oportunidades |
| `core.empresa` | `cnpj` | 2026-07-19 | cadastro, porte, capital, status, endereço, município, fonte | 4.825.673; canônico candidato | não direta | Empresa 360° transversal |
| `core.contato` | `id`; negócio CNPJ+tipo+valor | julho/2026 | CNPJ, tipo, valor, confiança, fonte | 8.052.470; precisa LGPD, validade e deduplicação | sim | Empresas/Pessoas/Comercial |
| `core.decisor` | `cpf` | julho/2026 | nome, qualificação, faixa etária, fonte | 133.939; CPF como PK exige forte controle | sim sensível | Pessoas/Empresa 360° |
| `canonical_mvp.atributo_fonte` | composta por entidade/atributo/fonte | julho/2026 | valor, origem, confiança, datas | 13.337.848; base útil para proveniência | pode conter | Empresa 360° |

## APIs reais encontradas

- API unificada em código, ainda não implantada: `/api/v1/health`, `/dashboard/kpis`, `/eventos`, `/eventos/{id}`, `/indicadores`, `/empresas`, `/empresas/{id}`, `/oportunidades`. Não cobre mapas, verticais, obra, comercial, login nem detalhes de oportunidade.
- Agro: endpoints reais para overview, fazendas, animais, touros, matrizes, técnicos, mapa, território, genética, Empresa 360° e operações de campo.
- Engenharia/Comercial legado: endpoints reais para obras e detalhe, fornecedores, decisores, matches, impacto, pipeline, autenticação e administração. O contrato não coincide com os tipos da SPA.
- Logística/Caminhão Vazio: stats, dashboard, transportadores, COMEX, postos, pontos de apoio, risco e municípios. Não há endpoint operacional de rotas salvas porque `log.route_plan` está vazio.
- OpenAPI/documentação automática retorna 404 nos quatro serviços ativos; contratos precisam ser extraídos do código e formalizados.

## Arquivos, ETLs e staging

- Foram encontrados 802 scripts `.py`, `.sql` ou `.sh` fora de backups/node_modules, incluindo cargas de fazendas, decisores, técnicos, genética, território, Engenharia, Saúde e Logística. Há sobreposição entre scripts de carga, auditoria e exportação; não existe um orquestrador único comprovado.
- Há arquivos MapBiomas XLSX, exports agro/comerciais CSV, masters JSON, GeoJSON municipais de Saúde e exports RNTRC/COMEX/DNIT/OSM de Logística.
- Diretórios `wins_hub_staging`, `wins_saude_staging`, `log_staging` e `caminhao_vazio_staging` contêm cópias e estágios, não fontes canônicas independentes.
- Cinco backups PostgreSQL/SQL comprimidos utilizáveis foram localizados. Eles não foram restaurados nem validados por checksum lógico nesta fase.

## Classificação de qualidade

- **Boa/estruturada:** `core.empresa`, obras com PK, CNES, capacidade municipal, RNTRC bruto, referências territoriais.
- **Média/requer reconciliação:** fornecedores, propriedades, técnicos, transportadoras, embarcadores e matches.
- **Baixa/incompleta:** rotas operacionais (zero), projetos mestre (zero), eventos de pipeline (zero), sinais de oportunidade (zero), profissionais CBO/ESF/ACS (zero), animais individuais nacionais (apenas 8).

O ambiente possui dados reais relevantes, mas não há evidência para declarar integração completa ou sistema 100% pronto.
