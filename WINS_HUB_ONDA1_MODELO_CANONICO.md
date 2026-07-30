# WiNS Hub — Onda 1 — Modelo canônico

O modelo foi implementado em `apps/api/canonical_models.py` como contratos Pydantic. Nesta onda ele é uma camada canônica de leitura; nenhuma nova tabela ou carga foi criada.

## Envelope comum

Todas as entidades preservam `canonical_id`, `source_system`, `source_schema`, `source_table`, `source_id`, `source_updated_at`, `ingested_at`, `quality_score`, `confidence_level`, `active_status` e `provenance`. Identificadores originais nunca são apagados.

| Entidade | Identidade canônica | Origem da Onda 1 | Observação |
|---|---|---|---|
| `Company` | hash estável do CNPJ/origem | `core.empresa`, `vw_empresa_360` | cadastro transversal |
| `Supplier` | CNPJ válido; fallback hierárquico | `engenharia.fornecedores` | especialização de Company |
| `Person` | ID opaco da origem | decisores | não expõe CPF |
| `DecisionMaker` | pessoa+obra/empresa+fonte | `decisores_obra` | contatos classificados e mascarados |
| `Work` | UUID da obra preservado | `engenharia.obras` | entidade real disponível |
| `EngineeringProject` | projeção 1:1 de Work | obras | `vw_projetos_mestre` está vazia; resposta sinaliza `work_projection` |
| `Opportunity` | obra+CNPJ fornecedor | `matches_v2` | match provável, não venda fechada |
| `Relationship` | origem+destino+tipo | vínculos por CNPJ/obra | explícito e proveniente |
| `Address` | componente da entidade | Core/RFB | campos ausentes permitidos |
| `GeoLocation` | lat/lon+precisão | município IBGE | precisão municipal na Onda 1 |
| `SourceRecord` | sistema/schema/tabela/ID | todas | registro técnico de proveniência |

`confidence_level` aceita `confirmed`, `probable`, `possible`, `conflicting` e `unresolved`. `quality_score` mede completude observável; não substitui confiança de identidade.

## Mapeamento dos campos

- Obra: nome, empresa/CNPJ, setor, município/UF, valor, status/fase, datas, descrição e fonte.
- Empresa: razão social, nome fantasia, situação/vivo, porte, capital e território.
- Fornecedor: dados empresariais, CNAE/segmento e quantidade de matches.
- Decisor: nome, cargo, obra, CNPJ indireto, fonte e contatos mascarados.
- Oportunidade: obra, fornecedor, score, decomposição do score e data do modelo.

Campos inexistentes não recebem valores inventados. São `null`, “não informado” apenas na apresentação, e a resposta inclui `partialData`.
