# WiNS Hub — Shadow Run — Reconciliação de Dados

> Documento vivo — atualizado diariamente.

---

## Metodologia

Comparação diária entre:

- **Origem** (core.empresa, engenharia.fornecedores, engenharia.obras)
- **API Nova** (wave1 — `https://winshubcomercial.com.br:18443/api/v1/`)
- **Legado** (wins_agro_v1 — sistema em produção)
- **Frontend** (demo)

Classificação das divergências:

- **Esperada por regra**: diferença documentada e aprovada
- **Erro de origem**: dado fonte está incorreto
- **Erro de transformação**: pipeline canônico falhou
- **Erro de API**: endpoint retornou dado errado
- **Erro de frontend**: exibição incorreta
- **Não resolvida**: pendente de investigação

---

## Dia 01 — 2026-07-21

### Baseline

| Tabela | Contagem | Origem | API | Diferença |
|--------|---------:|:------:|:---:|:---------:|
| `engenharia.fornecedores` | 4.094.527 | ✅ | ✅ | 0 |
| `engenharia.obras` | 35.690 | ✅ | ✅ | 0 |
| `canonical_mvp.entidade_empresa` | 4.825.673 | ✅ | ✅ | 0 |
| `canonical_mvp.atributo_fonte` | 13.337.848 | ✅ | N/A | - |
| `canonical_mvp.papel_vertical` | 4.732.572 | ✅ | N/A | - |

### Divergências

Nenhuma divergência encontrada no dia 01.

### Notas

- A API wave1 é read-only (usuário `wins_hub_api_ro`)
- Nenhuma escrita é feita pelo novo sistema
- A reconciliação é puramente de leitura
