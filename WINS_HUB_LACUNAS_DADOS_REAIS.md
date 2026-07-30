# WiNS Hub — Lacunas de dados reais

## Bloqueios críticos

1. **SPA sem dados reais:** `MockHubAdapter` é instanciado diretamente e Engenharia importa fixtures no service. Toda tela publicada exibe 0% de dados reais.
2. **API unificada não implantada e incompleta:** o código atual cobre apenas saúde técnica, KPIs, eventos, indicadores, empresas e lista de oportunidades; não há contratos completos para mapas, verticais, obra, oportunidade detalhada, comercial, territorial ou autenticação.
3. **Eventos transversais ausentes:** `engenharia.eventos_pipeline` e `engenharia.sinais_oportunidade` têm zero registros. Logs de atualização não equivalem a um catálogo de eventos.
4. **Identidade duplicada entre fontes:** empresa aparece em `core.empresa`, fornecedores, transportadoras, embarcadores e CNES. Staggings clonam conjuntos inteiros. Não há regra homologada de survivorship por atributo.
5. **PII sem política de consumo do Hub:** CPF, nomes, emails, telefones, LinkedIn, CRM/CRMV e vínculos existem em escala. Faltam finalidade, base legal, perfis de acesso, mascaramento, retenção e auditoria homologados.

## Lacunas por domínio

### Engenharia

- 10.177 de 35.690 obras sem município; 13.337 sem CNPJ; 23.343 sem data de publicação; 432 repetições de `id_externo`.
- `vw_projetos_mestre`, `obras_validadas`, `eventos_pipeline` e `sinais_oportunidade` estão vazios.
- Contrato, licitação e cronograma não existem como entidades estruturadas; há apenas campos dispersos e texto.
- Não há coordenada canônica direta para todas as obras.

### Agro

- 8.291.331 imóveis precisam de resolução CAR/SIGEF/matrícula/documento; pessoa e propriedade estão misturadas.
- Entre 53.270 linhas da view técnica, 48.176 não têm profissão classificada; somente 776 veterinários e 476 zootecnistas são identificáveis por profissão.
- Há 118.793 reprodutores no mercado, mas apenas 8 animais na operação de fazenda; não existe base nacional individual de vacas. O número 62.588 representa fêmeas em `mercado.reprodutor`, não “vacas” confirmadas.
- Produção, rebanho e capacidade são majoritariamente agregados municipais, não fatos por propriedade.

### Logística

- `log.route_plan` tem zero linhas; não existem rotas operacionais persistidas.
- Não há entidades canônicas de veículo, carga e frete contratado.
- 49.120 matches são oportunidades estimadas, não fretes realizados.
- RNTRC staging (1.124.684) e transportadoras operacionais (151.729) requerem reconciliação.
- Caminhão Vazio está corretamente identificado como conjunto/caso de Logística, mas dados repetem-se em `public`, `rota` e `rota_core`.

### Saúde

- `profissionais_cbo`, `equipes_saude_familia` e `agentes_comunitarios` estão vazios.
- Capacidade/leitos são agregados para 5.570 municípios; falta granularidade comprovada por estabelecimento.
- 446.036 linhas em `decisores_prontos` não podem ser tratadas como 446.036 pessoas únicas.
- Oportunidade de investimento é score territorial, não oportunidade comercial validada.

### Transversais

- Ausência de IDs globais estáveis para evento, oportunidade, pessoa, empresa e território ao atravessar verticais.
- Datas de atualização têm semânticas diferentes: captura, importação, enriquecimento, publicação e manutenção.
- OpenAPI está desabilitado nos serviços ativos; contratos e versionamento não são verificáveis automaticamente.
- Backups foram localizados, mas não restaurados/testados; sua utilizabilidade é física, não uma certificação de recuperação.
- Arquivos JSON/XLSX/CSV possuem várias cópias em backups e diretórios de campanha; não devem ser somados.

## Números que não podem ser declarados

- “Quantidade de vacas” nacional individual: indisponível. Há 62.588 fêmeas na tabela de reprodutores e agregados de abate, mas isso não prova categoria vaca.
- “Quantidade de veículos”: indisponível como entidade individual canônica.
- “Quantidade de rotas reais”: zero planos salvos; infraestrutura e corredores não são rotas realizadas.
- “Quantidade de contratos/licitações”: indisponível como entidade estruturada.
- “Quantidade de eventos”: indisponível transversalmente.
- “Sistema 100% pronto”: falso; a publicação permanece totalmente mockada.

## Riscos de qualidade

- somar clones de staging e inflar totais;
- usar CPF/contato sem autorização e mascaramento;
- confundir match/score com oportunidade comercial aceita;
- confundir agregado municipal com entidade individual;
- assumir atualidade por timestamp de manutenção, sem SLA da fonte;
- usar fallback silencioso entre HTTP e mock, ocultando falha de integração.
