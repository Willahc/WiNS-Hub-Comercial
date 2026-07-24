# WiNS Hub — Contagens reais por fonte

Data do inventário: 2026-07-21 UTC. Método: `COUNT(*)` executado no PostgreSQL com `default_transaction_read_only=on`; arquivos CSV contados por linhas de dados. As réplicas de staging não são somadas aos totais de domínio.

## Bancos e objetos

| Banco | Papel | Tabelas | Views | Objetos contados |
|---|---|---:|---:|---:|
| `wins_agro` | base operacional multivertical | 342 | 45 | 387 |
| `wins_hub_staging` | staging de Engenharia | 60 | 1 | 61 |
| `wins_saude_staging` | staging de Saúde | 19 | 3 | 22 |
| `caminhao_vazio_staging` | staging de Logística | 75 | 10 | 85 |
| **Total físico** | sem partições filhas | **496** | **59** | **555** |

## Contagens prioritárias canônicas

| Domínio | Objeto canônico | Registros reais | Observação |
|---|---|---:|---|
| Transversal | `core.empresa` | 4.825.673 | PK CNPJ |
| Transversal | `core.contato` | 8.052.470 | contatos; contém dados pessoais |
| Transversal | `core.decisor` | 133.939 | pessoas únicas por CPF; dado pessoal |
| Transversal | `core.decisor_vinculo` | 202.512 | vínculos pessoa–empresa |
| Transversal | `canonical_mvp.atributo_fonte` | 13.337.848 | proveniência por atributo |
| Transversal | `canonical_mvp.empresa_geografia` | 376.444 | atuação territorial |
| Engenharia | `engenharia.obras` | 35.690 | 16.633 marcadas visíveis |
| Engenharia | `engenharia.fornecedores` | 4.094.527 | cadastro RFB e contatos |
| Engenharia | `engenharia.decisores_obra` | 17.914 | decisores ligados a obras; PII |
| Engenharia | `engenharia.empresas_clientes` | 786 | contas/clientes |
| Engenharia | `engenharia.fornecedor_setores` | 47.112 | classificação setorial |
| Engenharia | `engenharia.matches_obra_prestador` | 9.485.069 | view de matching, não somar como entidade |
| Engenharia | `engenharia.matches_v2` | 1.314.135 | oportunidades candidatas/matches |
| Engenharia | `engenharia.obras_atualizacoes_log` | 2.138 | eventos de atualização |
| Engenharia | `engenharia.obras_impacto_economico` | 3.393 | indicadores de impacto |
| Agro | `prospeccao.imovel_rural` | 8.291.331 | propriedades/imóveis; CPF/CNPJ e proprietário |
| Agro | `prospeccao.fazenda_area` | 6.072.499 | áreas ligadas a CNPJ/CAR |
| Agro | `prospeccao.fazenda_nacional` | 227.516 | materialização comercial |
| Agro | `prospeccao.v_tecnico_full` | 53.270 | técnicos agregados |
| Agro | subconjunto veterinários | 776 | `profissao='veterinario'` na view |
| Agro | subconjunto zootecnistas | 476 | `profissao='zootecnista'` na view |
| Agro | `prospeccao.tecnico_crea` | 6.934 | técnicos CREA; CPF/CNPJ e contatos |
| Agro | `mercado.reprodutor` | 118.793 | 55.397 machos; 62.588 fêmeas; 808 sem sexo |
| Agro | `mercado.touro_central` | 3.200 | touros associados a centrais |
| Agro | `mercado.touro_oferta` | 2.924 | ofertas de touros |
| Agro | `mercado.v_touros_nelore_pivot` | 102.381 | view analítica |
| Agro | `mercado.v_touros_angus_pivot` | 1.693 | view analítica |
| Agro | `fazenda.animal` | 8 | animais operacionais individualizados |
| Agro | `fazenda.cruzamento` | 2 | registros reprodutivos |
| Agro | `analytics.vw_abate_vacas_uf` | 289 | agregado de vacas abatidas; não são indivíduos |
| Logística | `log.transportadora` | 151.729 | transportadoras operacionais |
| Logística | `log.embarcador` | 52.473 | embarcadores operacionais |
| Logística | `log.match` | 49.120 | oportunidades de frete/matching |
| Logística | `log.route_plan` | 0 | lacuna: nenhuma rota operacional salva |
| Logística | `log_staging.rntrc_transportadores` | 1.124.684 | staging RNTRC |
| Logística | `log_staging.cnpj_logisticos_agregado` | 1.739.732 | staging cadastral |
| Logística | `log_staging.dnit_obras` | 16.743 | infraestrutura viária |
| Logística | `log_staging.dnit_pavimento` | 3.611.496 | segmentos/pavimentos |
| Logística | `log_staging.comex_agregado` | 464.253 | fluxo COMEX agregado |
| Logística | `log_staging.pois_caminhoneiro` | 459.549 | pontos de apoio |
| Logística | `log_staging.prf_risco_rota` | 145.898 | risco viário |
| Saúde | `saude.estabelecimentos` | 623.208 | CNES enriquecido; contatos e decisores |
| Saúde | `saude.decisores_prontos` | 446.036 | linhas desnormalizadas; não pessoas únicas |
| Saúde | `saude.medicos` | 26.613 | médicos registrados na fonte |
| Saúde | `saude.cnes_capacidade` | 5.570 | municípios; 647.287 leitos, 412.413 SUS, 70.405 UTI |
| Saúde | `saude.oportunidade_investimento` | 5.570 | oportunidades municipais calculadas |
| Saúde | `saude.operadoras_ans` | 1.112 | operadoras |
| Saúde | `saude.profissionais_cbo` | 0 | lacuna |
| Saúde | `saude.equipes_saude_familia` | 0 | lacuna |
| Saúde | `saude.agentes_comunitarios` | 0 | lacuna |

## Réplicas e duplicidades físicas conhecidas

- `wins_hub_staging.public.obras` contém 35.690 linhas, iguais em cardinalidade a `wins_agro.engenharia.obras`.
- `wins_hub_staging.public.fornecedores` contém 4.094.527 linhas e `decisores_obra`, 17.914: clones de Engenharia.
- `wins_saude_staging.public.estabelecimentos` contém 623.208 linhas e `cnes_capacidade`, 5.570: clones de Saúde.
- `caminhao_vazio_staging` repete conjuntos nos schemas `public`, `rota` e `rota_core`; RNTRC aparece com 1.124.684 linhas em mais de um schema. Não se deve somar esses schemas.

## Arquivos de dados utilizáveis

| Arquivo | Registros | Papel |
|---|---:|---|
| `/opt/winshub/log/app/exports/raw_rntrc/transportadores_rntrc_05_2026.csv` | 1.124.684 | origem RNTRC |
| `/opt/winshub/caminhao-vazio/data/osm_pois_caminhoneiro.csv` | 459.557 | POIs de apoio; difere em 8 linhas do staging |
| `/opt/winshub/log/app/exports/comercial/fila_comercial_inteligente.csv` | 49.120 | export dos matches logísticos |
| `/root/wins_agro_v1/deliverables/call_list_master_20260616.csv` | 159.793 | lista de prospecção; contém contatos |
| `/root/wins_agro_v1/deliverables/decisores_por_fazenda.csv` | 41.990 | decisores de fazendas; PII |
| `/root/wins_agro_v1/exports/veterinarios_pet_brasil.csv` | 44.226 | export amplo de estabelecimentos/profissionais |
| `/root/wins_agro_v1/exports/veterinarios_enriquecimento_gratuito.csv` | 44.226 | derivado enriquecido |
| `/root/wins_agro_v1/exports/veterinarios_localizacao.csv` | 44.226 | derivado geográfico |
| `/root/wins_agro_v1/exports/veterinarios_bairros.csv` | 44.226 | derivado territorial |
| `/root/wins_agro_v1/prospeccao-campanella/prospeccao_campanella_enriquecida_v3.csv` | 870 | campanha comercial |

## Backups utilizáveis localizados

- `/root/backups/wins_agro_deploy_20260714_182008/prod_dump.dump` — 668.816.348 bytes.
- `/opt/winshub/caminhao-vazio/backups/planejador_rota_mvp_20260711_000838/pg_rota_schemas.sql.gz` — 178.643.830 bytes.
- Três dumps SQL gzip adicionais do Caminhão Vazio, entre 85 MB e 93 MB. Não foram restaurados nesta fase.

As contagens acima não significam prontidão de integração: várias fontes são réplicas, agregados ou dados de prospecção sem contrato canônico.
