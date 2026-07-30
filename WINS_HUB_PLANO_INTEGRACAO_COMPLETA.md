# WiNS Hub — Plano de integração completa

Este plano começa **depois** da aprovação do inventário. Nenhuma etapa abaixo foi executada nesta fase.

## 1. Homologar contratos e fontes canônicas

- Confirmar `core.empresa`, `core.decisor`, `core.contato`, `canonical_mvp.atributo_fonte` e `referencia.municipio` como núcleo transversal.
- Eleger uma fonte canônica por entidade vertical e registrar staggings apenas como origem técnica.
- Definir semântica de evento, oportunidade, projeto, contrato, licitação, rota, veículo, carga, frete e capacidade.
- Formalizar dicionário, responsável, SLA, atualização e política de qualidade por fonte.

**Critério de saída:** contratos de dados versionados, chaves e regras de survivorship aprovadas.

## 2. Governança de identidade e PII

- Definir IDs globais sem expor CPF; normalizar CNPJ, CNES, CAR, RNTRC, CRM/CRMV e IBGE.
- Aprovar finalidade, base legal, perfis, mascaramento, retenção, exclusão e trilha de auditoria.
- Aplicar confiança e proveniência por atributo; impedir fallback silencioso.

**Critério de saída:** matriz de acesso e regras LGPD homologadas antes de qualquer consumo pela SPA.

## 3. Construir adapters reais por domínio

- Implementar `HttpHubAdapter` com seleção explícita por ambiente.
- Engenharia: obras, mapa, detalhe, empresas, decisores, eventos derivados e oportunidades.
- Agro: propriedades, técnicos, genética, produção/rebanhos e território.
- Logística: transportadoras, embarcadores, infraestrutura e matches; manter Caminhão Vazio como caso interno.
- Saúde: estabelecimentos, capacidade, indicadores e oportunidades analíticas.
- Transversal: Empresa 360°, eventos, oportunidades, territorial e comercial.

**Critério de saída:** schemas tipados e testes de contrato contra dados reais, sem fallback para fixture.

## 4. Fechar lacunas de dados

- Engenharia: reconciliar 432 chaves de obra, geocodificar/validar localizações e estruturar cronogramas, contratos e licitações.
- Agro: resolver imóveis duplicados, classificar profissões e separar animais operacionais de catálogo genético.
- Logística: criar contrato de veículo/carga/frete/rota e carregar rotas somente após fonte homologada.
- Saúde: obter profissionais CBO, ESF/ACS e granularidade de capacidade por estabelecimento.
- Transversal: materializar eventos e oportunidades com tipo, estágio, evidência, fonte, confiança e data.

**Critério de saída:** métricas de completude, unicidade, atualidade e cobertura atingem limites acordados.

## 5. Validar tela por tela

- Testar as 20 rotas com telemetria do adapter e prova de origem por registro.
- Validar paginação, filtros, mapas, detalhes, links transversais, estados vazio/erro/loading/acesso negado.
- Demonstrar que nenhum dado renderizado veio de mock; fixtures ficam apenas em teste/desenvolvimento controlado.
- Testar perfis de acesso para PII e exportações.

**Critério de saída:** cobertura real por tela medida em produção de homologação, console sem erro e zero fallback silencioso.

## 6. Migração e cutover — somente com autorização posterior

- Executar ensaio em ambiente isolado, reconciliação de contagens e rollback validado.
- Fazer carga incremental idempotente, observabilidade e alertas de freshness.
- Remover mocks do bundle publicado apenas após homologação funcional e de dados.
- Cutover da raiz permanece fora do escopo até aprovação explícita.

## Ordem sugerida por valor e prontidão

1. Engenharia (fontes mais aderentes às telas).
2. Empresa 360°/Empresas e Territorial (núcleo transversal).
3. Saúde (boa cobertura agregada e CNES).
4. Agro (alto volume, maior complexidade de identidade).
5. Logística (boa prospecção, lacuna transacional de rotas/fretes).
6. Eventos, oportunidades e Comercial transversais após os IDs canônicos.

## Bloqueios para iniciar implementação

- decisão formal das fontes canônicas e responsáveis;
- política LGPD e perfis de acesso para dados pessoais;
- definição dos contratos ausentes;
- autorização para implantar a API unificada e criar artefatos de integração;
- ambiente de homologação de dados separado da publicação `/demo/`.
