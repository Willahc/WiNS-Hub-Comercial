# Manifesto dos Pipelines Legados — WiNS Hub Engenharia

## 1. Backup da Produção (wins_agro — VPS Maior)

| Campo | Valor |
|-------|-------|
| Arquivo | `/root/backups_db/wins_agro_20260727_validado.dump` |
| Formato | pg_dump -Fc (custom) |
| Tamanho | 2,8 GB |
| SHA-256 | `002c2e3126b52ffca83b85e5d98ab354892b6225e2a6f73584543a1ab3328a98` |
| Objetos | 3.415 TOC entries |
| Tabelas | 355 |
| Funções | 53 |
| Views | 44 |
| Excluído | `cnpj.stg_*` (dados intermediários re-geráveis) |
| Validação | `pg_restore --list` OK |
| Data | 2026-07-27 13:39 UTC |

### Causa dos backups 255KB na VPS menor
- Disco da VPS menor (`/dev/sda1`) **100% cheio** (48 GB)
- `scp` grava parcialmente o arquivo (255KB) antes de falhar com "write remote: Failure"
- Backup local na VPS maior **funciona normalmente** (~2,9 GB/dia)
- Backup GPG cifrado **não pode ser decriptado na VPS maior** (chave privada offsite)

### Backups locais existentes (VPS Maior — /root/backups_db/)
| Data | Tamanho | Status |
|------|---------|--------|
| 22/07 | 2,9 GB | Local OK, offsite falhou |
| 23/07 | 2,9 GB | Local OK, offsite falhou |
| 24/07 | — | **Falhou** (GPG: No space left on device durante cifragem) |
| 25/07 | 2,9 GB | Local OK, offsite falhou |
| 26/07 | 2,9 GB | Local OK, offsite falhou |
| 27/07 | 2,9 GB | Local OK + validado |

## 2. Pacote Preservado (VPS Menor → VPS Maior)

| Campo | Valor |
|-------|-------|
| Origem | `william@187.127.253.42:/root/wins_hub` |
| Destino | `/root/wins_hub_preserved_20260727.tar.gz` |
| Tamanho | 23 MB |
| SHA-256 | `03daaed0808a32d10caeed9b437d6555167e8a88a5e21ed6c36ab69568cd5a07` |
| Arquivos | 1.361 (excluídos .git/objects, __pycache__, .env, logs, backups, dumps, certs) |
| Python | 342 scripts |
| Shell | 28 scripts |
| SQL | 85 scripts |
| JS/CSS | 18 |
| HTML | 17 |

### Estrutura do pacote
```
wins_hub/
├── app/                    (103 MB — código principal)
│   ├── main.py             (481 KB — backend monolítico)
│   ├── scripts/            (6,8 MB — CAPTADORES + MATCHMAKER + ENRICHMENT)
│   ├── services/           (serviços auxiliares)
│   ├── routes/             (rotas da API)
│   ├── sales_intelligence/ (camadas de IA comercial)
│   ├── frontend/           (SPA frontend)
│   └── utils/              (utilitários)
├── scripts/                (scripts de deploy/cron)
├── sql/                    (migrations + rollbacks)
├── docs/                   (documentação)
├── nginx/                  (config reverse proxy)
└── .claude/skills/         (skills do Claude)
```

## 3. Extração do Banco

### Schema engenharia
| Arquivo | Objetos |
|---------|---------|
| `database/schema/engenharia_schema.sql` | 141 tabelas, 52 sequences, 243 índices, 19 triggers, 6 views, 99 comentários |

### Funções (41 extraídas)
| Arquivo | Descrição |
|---------|-----------|
| `database/functions/calcular_score_match_v2.sql` | **Engine de matching** — 103 linhas PL/pgSQL |
| `database/functions/calcular_confianca_match_v2.sql` | Confiança do match |
| `database/functions/calcular_confianca_match.sql` | Confiança legada |
| `database/functions/recompute_classificacao_obra.sql` | Reclassificação de obras |
| `database/functions/fn_enqueue_enrichment.sql` | Enfileiramento de enrichment |
| `database/functions/regenerar_matches_v2_para_prestador.sql` | Regeneração de matches |
| +35 outras funções | triggers, validação, portão, etc. |

### Seed Tables (regras de matching)
| Tabela | Registros | Finalidade |
|--------|-----------|------------|
| `setor_cnae_compatibility` | ~200 | Compatibilidade setor obra × CNAE fornecedor |
| `uf_proximidade` | ~50 | Proximidade territorial UF-obra × UF-fornecedor |
| `ufs_vizinhas` | ~30 | UFs vizinhas |
| `setor_categorias` | ~50 | Categorias de setor |
| `cnae_oficial` | ~1.300 | CNAEs oficiais |
| `regras_prioridade_campos` | ~30 | Prioridade de campos de enriquecimento |
| `portao_config` | ~10 | Config do Portão de qualidade |
| `planos_pricing` | ~5 | Planos de precificação |
| `captadores` | ~20 | Registro de fontes de captação |
| `categorias_servico` | ~150 | Categorias de serviço |

## 4. Scripts Recuperados por Categoria

### Captadores (52 scripts)
```
captar_aneel.py, captar_anm.py, captar_anp.py, captar_antaq.py,
captar_bndes.py, captar_cvm.py, captar_ibama.py, captar_dou_inlabs.py,
captar_pncp_*.py, captar_obrasgov_100k.py, captar_noticias_setoriais.py,
captar_google_alerts.py, captar_doe_*.py, captar_dnit.py, etc.
```

### Matching (4 scripts)
| Script | Função |
|--------|--------|
| `matchmaker_worker.py` | Worker de matching (engine principal) |
| `matchmaking_backfill.py` | Backfill de matches |
| `run_manual_matchmaking.py` | Matchmaking manual |
| `regerar_matches_orfas.py` | Regenerar matches órfãos |

### Enriquecimento (20+ scripts)
| Script | Função | API Externa |
|--------|--------|-------------|
| `enrichment_auto_job.py` | Pipeline canônico 8-passos (85 KB) | Hunter, Serper, Anthropic |
| `enrich_decisores_bucket1_5.py` | Decisores OURO/PRATA/BRONZE | Hunter |
| `enrich_linkedin_bucket2.py` | Busca LinkedIn | Serper |
| `enrich_emails_patterns.py` | Padrões de e-mail | — |
| `enriquecer_fila.py` | Fila prospecção Mari | Hunter |
| `drain_queue.py` | Drenagem evento-driven | — |
| `serper_haiku_decisor_sc.py` | Decisor via Serper+Haiku | Serper, Anthropic |
| +13 outros | | |

### Orchestration
| Script | Função |
|--------|--------|
| `orchestrator.py` | Orquestrador noturno (sequencia captadores + match + enrich) |

## 5. Dependências Externas

| Serviço | Uso | Chave necessária |
|---------|-----|------------------|
| **Hunter.io** | Email finding (domain search, email finder) | API Key |
| **Serper.dev** | Google Search API (decisores, LinkedIn) | API Key |
| **Anthropic Claude** | LLM (classificação, análise, enriquecimento) | API Key |
| **BrasilAPI** | CNPJ lookup (público) | — |
| **Resend** | Email delivery | API Key |
| **OpenAI** | LLM alternativo | API Key |
| **Receita Federal** | Dados cadastrais (público) | — |
| **Fonte públicas** | ANEEL, BNDES, CVM, IBAMA, ANM, PNCP, ANTAQ, DOUs | — |

## 6. Últimas Execuções

| Pipeline | Última execução | Status |
|----------|-----------------|--------|
| Orchestrator noturno | 2026-07-17 02:09 | **erro** (após 69 min) |
| MATCHMAKING_V2 | 2026-07-17 | sucesso (1.780 novos matches) |
| Descritor sintético | 2026-07-17 | sucesso (1.602 obras) |
| Enriquecimento decisor | 2026-07-17 | sucesso |
| Captadores (6+) | 2026-07-17 | sucesso |

## 7. Riscos

| Risco | Severidade | Mitigação |
|-------|-----------|-----------|
| Disco VPS menor 100% — sem acesso ao DB legado | ALTA | Dados já migrados para wins_agro |
| Chave GPG privada offsite — backups não decriptáveis | MÉDIA | Backup fresco em claro validado |
| Dependências externas (Hunter, Serper, Anthropic) podem expirar | MÉDIA | Monet + renovação automática |
| Nenhum pipeline roda desde 17/07 | ALTA | Este manifesto documenta o estado |
| Scripts contêm credenciais hardcoded em .bak's | BAIXA | Excluídos do tar.gz; revisão adicional |

