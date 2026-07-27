# Captação diária de obras — Engenharia

## Decisão operacional

Pipeline canônico: `engineering_capture.runner` → adaptadores de fonte somente leitura
→ validação mínima → normalização → deduplicação → classificação CIVIL/INDUSTRIAL
→ validação de valor com `Decimal` → captura bruta versionada → persistência
invisível em `engenharia.obras` → Portão existente → métricas.

O legado `/opt/winshub/comercial` é fonte auxiliar desativada, conforme
`/opt/winshub/LEGADO_FORA_DE_ESCOPO.md`. Seus scripts não são chamados porque
gravam diretamente em `obras` antes do hook V2. Reativá-los criaria escrita
paralela e violaria o fluxo canônico.

## Captadores ativos no runner canônico

| Nome | Comando/adaptador | Fonte | Tipo | Frequência anterior | Última execução conhecida | Saída/destino | Deduplicação/atualização | Dependências | Risco | Vertical |
|---|---|---|---|---|---|---|---|---|---|---|
| PNCP Civil 100k | `PncpCivilSource` | API PNCP | Civil | diária | 2026-07-17 01:24 BRT | `capturas_brutas` e `obras` | ID PNCP + hash; atualização apenas mais recente/confiável | HTTPS, PostgreSQL | baixo após adaptador | Engenharia |
| ObrasGov 100k | `ObrasGovSource` | API pública ObrasGov | Civil/industrial | diária | 2026-07-17 01:26 BRT | `capturas_brutas` e `obras` | `id_projeto_investimento` + hash; atualização apenas mais recente/confiável | HTTPS, PostgreSQL | baixo após adaptador | Engenharia |

## Inventário legado — excluído da ativação

Todos os itens abaixo estavam no orquestrador legado ou no diretório de scripts.
Quando não há log individual, a última execução é `desconhecida`. A saída usual
era `engenharia.obras` por `INSERT/UPSERT` direto; deduplicação usual era
`id_externo`, sem garantia cross-source. Status atual: desabilitado.

| Captador | Fonte/tipo | Última execução conhecida | Regra anterior / dependências | Motivo de exclusão e risco | Vertical |
|---|---|---:|---|---|---|
| `captar_ibama` | IBAMA SISLIC/licenças | 2026-07-17 01:00 | upsert `id_externo`; CSV/HTML | licença sem capex confiável; escrita direta; alto | Engenharia/revisão |
| `captar_bndes` | BNDES/financiamentos | 2026-07-17 01:01 | upsert; CSV oficial | financiamento não implica obra; classificação/valor precisa adaptação; alto | Engenharia |
| `captar_aneel` | ANEEL SIGA/energia | 2026-07-17 01:03 | upsert e reconciliação própria; CSV | pipeline/dedup paralelo; alto | Engenharia |
| `captar_antaq` | ANTAQ/terminais | 2026-07-17 01:03 | upsert; API/planilha | valor e escopo não normalizados canonicamente; alto | Engenharia/Logística |
| `captar_cvm` | CVM/fatos relevantes | 2026-07-17 01:03 | upsert; ZIP CVM | notícia societária não implica obra; alto | Engenharia/revisão |
| `captar_suframa_cas_industrial` | SUFRAMA/projetos industriais | 2026-07-17 01:04 | upsert; documentos CAS | candidato futuro, mas grava direto; médio | Engenharia |
| `captar_noticias_setoriais` | RSS/notícias + modelo | 2026-07-17 01:08 | hash notícia; LLM | valor/modelo e confiabilidade não homologados; alto | Multivertical |
| `captar_pncp_obras` | PNCP piso legado | 2026-07-17 01:10 | ID PNCP | sobrepõe PNCP Civil e escreve direto; duplicidade | Engenharia |
| `captar_recife_licenciamento_100k` | licenciamento Recife | 2026-07-17 01:26 | ID municipal | valor de licença requer validação documental; médio | Engenharia |
| `captar_curitiba_alvaras_100k` | alvarás Curitiba | 2026-07-17 01:41 | ID municipal | valor derivado/alvará não homologado; médio | Engenharia |
| `captar_geosampa_habitacao_popular_100k` | GeoSampa/alvarás | 2026-07-17 01:41 | ID municipal | valor estimado sem política ativa; médio | Engenharia |
| `captar_pncp_consulta` | PNCP consulta | 2026-07-17 01:42 | ID PNCP | sobreposição cross-source com PNCP Civil; alto | Engenharia |
| `captar_pncp_defesa` | PNCP defesa | 2026-07-17 01:44 | ID PNCP | aquisições/defesa podem não ser obra; alto | Engenharia/outra |
| `captar_dou_inlabs` | DOU/InLabs | 2026-07-17 01:44 | hash documento; credenciais | valor ausente e credencial externa; alto | Multivertical |
| `captar_eletrobras_ri` | RI Eletrobras | 2026-07-17 01:44 | hash URL; Playwright | anúncio sem valor documental uniforme; alto | Engenharia |
| `captar_anp` | ANP/óleo e gás | 2026-07-17 01:44 | upsert | registro regulatório não é necessariamente obra; alto | Engenharia |
| `captar_doe_rj` | DOE RJ | 2026-07-17 01:45 | hash URL/documento | texto genérico e valor ausente; alto | Multivertical |
| `captar_doe_mg` | DOE MG | 2026-07-17 01:46 | hash URL/documento | texto genérico e valor ausente; alto | Multivertical |
| `captar_doe_rs` | DOE RS | 2026-07-17 01:46 | hash URL/documento | texto genérico e valor ausente; alto | Multivertical |
| `captar_doe_pr` | DOE PR | 2026-07-17 01:46 | hash URL/documento | texto genérico e valor ausente; alto | Multivertical |
| `captar_doe_pa` | DOE PA | 2026-07-17 01:49 | hash URL/documento | texto genérico e valor ausente; alto | Multivertical |
| `captar_doe_ms` | DOE MS | 2026-07-17 01:50 | hash URL/documento | texto genérico e valor ausente; alto | Multivertical |
| `captar_doe_go` | DOE GO | 2026-07-17 01:50 | hash URL/documento | texto genérico e valor ausente; alto | Multivertical |
| `captar_dnit` | DNIT | 2026-07-17 01:50 | ID externo, insert direto | scaffold/valor não comprovado; alto | Engenharia |
| `captar_doe_sp` | DOE SP | 2026-07-17 01:50 | scaffold | backend pendente; alto | Multivertical |
| `captar_google_alerts` | Google Alerts | 2026-07-17 04:50 | hash notícia | backlog/notícia sem valor confiável; alto | Multivertical |
| `captar_pncp_full` | PNCP completo | 2026-07-17 01:53 | ID PNCP | sobreposição com adaptador canônico; alto | Engenharia |
| `captar_der_sp` | BEC/DER SP | 2026-07-17 01:53 | insert direto | fonte renomeada/sem contrato canônico; alto | Engenharia |
| `captar_cdhu_sp` | CDHU SP | 2026-07-17 01:53 | insert direto | valor/escopo não homologados; médio | Engenharia |
| `captar_sabesp_sp` | SABESP | 2026-07-17 01:53 | insert direto | pode incluir material/manutenção; alto | Engenharia |
| `captar_antt_rod_v2` | ANTT rodoviário | 2026-07-17 01:53 | insert direto | mistura operação/concessão e obra; alto | Engenharia/Logística |
| `captar_saneamento` | PAC saneamento | 2026-07-17 01:53 | insert direto | candidato futuro; falta adaptador canônico | Engenharia |
| `captar_transparencia` | Portal Transparência | 2026-07-17 01:53 | insert direto | despesa/contrato não implica obra; alto | Multivertical |
| `captar_bndes_saneamento` | BNDES saneamento | 2026-07-17 01:53 | wrapper BNDES | duplica fonte BNDES; alto | Engenharia |
| `captar_antt_ferro_pic` | ANTT ferrovia | 2026-07-17 01:53 | upsert | precisa separar investimento de obrigação operacional | Engenharia/Logística |
| `captar_aneel_transmissao` | ANEEL transmissão | 2026-07-17 01:53 | upsert | pipeline paralelo; precisa adaptar valor | Engenharia |
| `captar_debentures_infra` | CVM/debêntures | 2026-07-17 01:54 | upsert | captação financeira não prova obra | Engenharia/revisão |
| `captar_agenciainfra` | notícias infraestrutura | 2026-06-18 02:02 | upsert notícia | aposentado por baixo yield/NULL | Multivertical |
| `captar_cimm` | notícias indústria | 2026-06-18 02:02 | upsert notícia | aposentado por baixo yield/NULL | Engenharia/revisão |
| `captar_anm` | ANM/mineração | 2026-06-16 02:23 | estimativa tipológica | desativado: royalty/produção, não obra | Engenharia/rejeitado |
| `captar_industrial_priv` | web privada industrial | 2026-06-25 11:03 | LLM + candidato | estimativa/modelo sem política homologada | Engenharia/revisão |
| `captar_bec_sp` | compras BEC SP | desconhecida | script legado | compra pode não ser obra; valor/escopo não homologados | Multivertical |
| `captar_bndes_saude` | BNDES saúde | desconhecida | wrapper BNDES | outra vertical | Saúde |

## Regras

- Classificação preserva valor original, classificação original, regra,
  confiança e versão `engineering-scope-value-v1`.
- Só `CIVIL` e `INDUSTRIAL` seguem.
- Só `PUBLICADO` ou `DOCUMENTAL`, em BRL, com `Decimal >= 100000.00`.
- `AUSENTE` é rejeitado; moeda sem conversor oficial vai para revisão.
- Nenhum fallback fixo e nenhuma estimativa está habilitada na v1.
- A ordem é: captar, validar mínimo, normalizar, deduplicar candidato,
  classificar, validar valor, rejeitar, enriquecer, persistir/atualizar, Portão.
- Novas obras entram `fase=CAPTADA`, `status=anunciado`,
  `visivel=false`, `status_portao=EM_ANALISE`, preservando as constraints do
  Portão existente.
- Histórico usa `obras_atualizacoes_log`; fonte mais fraca/null não substitui
  dado mais confiável.

## Agendamento, lock e resiliência

- Unit: `winshub-engineering-capture.service`.
- Timer: `winshub-engineering-capture.timer`.
- Variáveis de banco: arquivo operacional existente
  `/root/wins_agro_v1/.env`; nenhuma credencial é copiada ou versionada.
- Agenda: `01:00 America/Sao_Paulo`, explícita mesmo com host em UTC.
- Lock duplo: `flock` no host e advisory lock PostgreSQL.
- Timeout global: 2 horas; HTTP: 60 s, até 3 tentativas, backoff progressivo,
  429 e 5xx retryable. Falha de uma fonte não interrompe a outra.
- Checkpoint diário é a janela sobreposta de três dias mais idempotência por fonte.
- O adaptador ObrasGov usa a API pública atual
  `api-publica.obrasgov.gestao.gov.br`; o endpoint legado
  `api.obrasgov.gestao.gov.br` passou a responder `429`.
- Em 2026-07-27, o PNCP resolveu DNS, completou TLS com certificado válido e
  aceitou a requisição, mas não enviou bytes de resposta dentro do timeout:
  indisponibilidade classificada como `TIMEOUT`, sem mock ou troca de fonte.

## Logs, métricas e alertas

- JSONL: `/var/log/winshub/engineering-capture/`.
- Journal: `journalctl -u winshub-engineering-capture.service`.
- Rotação: diária, 30 arquivos comprimidos.
- Métricas: tabelas `engineering_capture_runs` e
  `engineering_capture_source_runs`.
- Rejeições sanitizadas: `engineering_capture_rejections`.
- `OnFailure` envia alerta crítico ao syslog. O runner alerta lock, disco
  abaixo de 15 GB, falha por fonte e execução total sem sucesso. Falha isolada
  gera `PARTIAL_SUCCESS`, sem esconder a fonte indisponível.

## Dependência do Portão

A restauração do schema consolidou as tabelas e funções em `engenharia`, mas
seis funções mantiveram referências literais ao antigo `wins_v2`. A migration
`20260727_repair_engineering_gate_trigger_up.sql` corrige somente essas
referências para os objetos canônicos já existentes (`portao_config`,
`portao_fila`, `pipeline_inbox` e funções auxiliares). Nenhum schema vazio é
criado e nenhum trigger é removido. O rollback é bloqueado se uma implementação
completa e real de `wins_v2` não estiver disponível.

## Operação

Dry-run:

```bash
python3 -m engineering_capture.runner --dry-run --days 3 --max-pages 2
```

Execução manual controlada:

```bash
systemctl start winshub-engineering-capture.service
journalctl -fu winshub-engineering-capture.service
```

Pausar e reativar:

```bash
systemctl disable --now winshub-engineering-capture.timer
systemctl enable --now winshub-engineering-capture.timer
```

Rollback do agendamento:

```bash
systemctl disable --now winshub-engineering-capture.timer
```

O rollback não apaga obras nem tabelas. Reverter schema exige change separado e
backup validado.
