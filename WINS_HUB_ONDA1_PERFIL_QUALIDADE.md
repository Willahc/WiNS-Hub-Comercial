# WiNS Hub — Onda 1 — Perfil de qualidade

Medição executada diretamente em `wins_agro` em 21/07/2026, entre 12:33 e 12:40 UTC, com transações somente leitura. “Ativo” é uma regra explícita por entidade, não apenas `COUNT(*)`.

## Contagens revalidadas

| Entidade | Sistema / schema / objeto | Escopo e filtro | Total | Ativos | Inativos | Sem identificador | Duplicidade do identificador |
|---|---|---|---:|---:|---:|---:|---:|
| Obras | WiNS Engenharia / `engenharia.obras` | total físico; ativo=`visivel IS TRUE` | 35.690 | 16.633 | 19.057 | 0 sem UUID | 0 UUID; 0 `id_externo` repetido e 432 `id_externo` nulos |
| Empresas | WiNS Core / `core.empresa` | total físico; ativo=`vivo IS TRUE` | 4.825.673 | 636.404 | 4.189.269 | 0 sem CNPJ | 0 por CNPJ, protegido por PK |
| Fornecedores | WiNS Engenharia / `engenharia.fornecedores` | total físico; API ativa=`situacao_cadastral='02'` | 4.094.527 | 4.094.206 | 321 | 0 sem CNPJ | 0 por CNPJ, protegido por PK |
| Decisores | WiNS Engenharia / `engenharia.decisores_obra` | total físico; ativo=`excluido_em IS NULL` | 17.914 | 12.941 | 4.973 | 0 sem ID | 0 por ID; 247 repetições por obra+nome+cargo no total histórico |

Últimas atualizações observadas: obras 17/07/2026 01:51 BRT; empresas 18/07/2026 10:32 BRT; fornecedores 17/07/2026 01:08 BRT; decisores 17/07/2026 11:47 BRT.

## Engenharia

| Métrica | Registros | Percentual |
|---|---:|---:|
| Sem nome | 0 | 0,00% |
| Sem município | 10.177 | 28,51% |
| Sem UF | 537 | 1,50% |
| Sem coordenada própria | 35.690 | 100,00% |
| Coordenada própria inválida | não aplicável | a tabela não contém latitude/longitude |
| Sem qualquer status (`status`, `fase`, licença) | 18 | 0,05% |
| Sem valor ou valor não positivo | 24 | 0,07% |
| Sem prazo aproximável por anúncio/publicação | 1.755 | 4,92% |
| Duplicada por UUID ou `id_externo` preenchido | 0 | 0,00% |
| Sem empresa/CNPJ relacionado | 13.337 | 37,37% |

O mapa usa centroide municipal de `referencia.municipio` e marca `geoPrecision=municipality`; não apresenta essa coordenada como localização exata da obra.

## Empresas

Validade de CNPJ foi calculada sobre os 4.825.673 valores por normalização e verificação dos dois dígitos, via fluxo somente leitura: 3.987.863 válidos (82,64%), 837.810 inválidos (17,36%) e zero ausentes.

| Métrica | Registros |
|---|---:|
| Razão social ausente | 1.046.106 |
| Duplicidade por CNPJ | 0 |
| Duplicidade por nome normalizado+município | 344.914 linhas além da primeira |
| Município ausente | 4.466.566 |
| Endereço territorial ausente (IBGE e município) | 4.142.976 |
| Empresas sem contato associado | até 604.856; 4.220.817 CNPJs distintos aparecem em `core.contato` |

## Fornecedores

Validade de CNPJ: 3.383.997 válidos (82,65%), 710.530 inválidos (17,35%), zero ausentes.

| Métrica | Registros |
|---|---:|
| Razão social ausente | 931.242 |
| Duplicidade por CNPJ | 0 |
| Duplicidade por nome normalizado+município | 208.236 linhas além da primeira |
| Endereço completo ausente | 3.123.518 |
| Município ausente | 116.996 |
| Telefone e email ausentes simultaneamente | 173.041 |

## Decisores e privacidade

| Métrica | Registros |
|---|---:|
| Sem nome | 0 |
| Sem cargo | 1.578 |
| Sem obra vinculada | 0 |
| Sem email | 7.659 |
| Sem telefone | 4.761 |
| Sem fonte | 0 |
| Duplicidade por obra+nome+cargo | 247 no histórico; índice único obra+nome protege ativos |
| Sem vínculo empresarial indireto via obra | 0 sem obra; 13.337 obras não possuem CNPJ empresarial |
| Registros contendo dado pessoal | 17.914 |
| Dados pessoais sensíveis do art. 5º, II, identificados estruturalmente | 0; os campos são pessoais e restritos, mas não há categoria sensível explícita |

Contatos são classificados como públicos quando possuem fonte pública identificada e desconhecidos quando a classificação não é comprovável. Telefone e email são mascarados para o perfil padrão; acesso integral requer a permissão `decisores:sensitive` e gera log com request ID.
