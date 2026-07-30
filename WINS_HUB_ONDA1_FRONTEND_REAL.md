# WiNS Hub — Onda 1 — Frontend real

Foi criado o modo de build explícito `wave1` (`npm run build:wave1`). Nesse modo, os módulos homologados usam HTTP real e não possuem fallback silencioso. O build padrão mantém os adapters anteriores para telas fora da Onda 1.

## Telas conectadas

| Tela/rota | Fonte real | Estado |
|---|---|---|
| `/engenharia` | obras + oportunidades + empresas derivadas | conectada; primeira janela de 100 obras |
| `/engenharia/mapa` | obras + centroide municipal | conectada; precisão municipal sinalizada |
| `/engenharia/obras` | obras visíveis | conectada; carregamento, vazio e erro controlado |
| `/engenharia/obras/{id}` | detalhe real por UUID | conectada |
| `/engenharia/empresas` | empresas relacionadas às obras da janela | conectada |
| `/empresas` | `core.empresa` | conectada no modo wave1 |
| `/empresas/{cnpj}` | Empresa 360° real | conectada; contatos pessoais não expostos |
| `/fornecedores` | fornecedores ativos | nova tela real, busca server-side |
| `/decisores` | decisores ativos | nova tela real; email/telefone mascarados |
| `/oportunidades` | matches de obras visíveis | conectada; valor fica zero/não homologado |

As demais verticais e módulos permanecem em mock controlado, conforme solicitado. O topo identifica `DADOS REAIS · ONDA 1` no modo real. Engenharia exibe fonte, total na origem, última atualização e aviso de parcialidade.

## Mocks removidos

- Removidos do caminho de execução `wave1`: fixtures de Engenharia, empresas, Empresa 360° e oportunidades relacionadas.
- Não removidos fisicamente: fixtures e adapters de contingência continuam disponíveis no build padrão/offline.
- Mocks de Logística, Agro, Saúde, eventos globais, territorial e configurações não foram alterados.

## Validação visual local

Foram capturadas oito telas em 1366×768/full page com Chromium real. Não houve erro de console nas rotas capturadas. Arquivos em `screenshots/onda1-real/`.

O bundle foi gerado em `/root/wins_hub_unificado/dist`. Não houve publicação externa nem cutover nesta onda; a API real permanece local/staging técnico.
