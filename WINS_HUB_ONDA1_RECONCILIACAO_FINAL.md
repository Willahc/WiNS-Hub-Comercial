# WiNS Hub — Reconciliação final da Onda 1

Contagens reconfirmadas diretamente no PostgreSQL em 2026-07-21. Não houve migração ou alteração de registros.

| Entidade | Total origem | Regra para ativo/visível | Total API elegível | Diferença explicada |
|---|---:|---|---:|---:|
| Obras | 35.690 | `visivel IS TRUE` | 16.633 | 19.057 não visíveis pela curadoria/portão da origem |
| Empresas | 4.825.673 | `vivo IS TRUE` | 636.404 | 4.189.269 fora do conjunto vivo |
| Fornecedores | 4.094.527 | `situacao_cadastral='02'` | 4.094.206 | 321 fora da situação cadastral ativa |
| Decisores | 17.914 | `excluido_em IS NULL` | 12.941 | 4.973 excluídos logicamente |
| Matches | 1.314.135 | match ligado a obra com `visivel IS TRUE` | 687.087 | 627.048 vinculados a obras não visíveis |

## Fluxo origem → frontend

- Obras: 35.690 origem → 16.633 elegíveis → API paginada → até 100 no recorte carregado do frontend. A diferença exibida é paginação, não perda; o total da origem visível acompanha a resposta.
- Empresas: 4.825.673 origem → filtro opcional de atividade; o endpoint informa total do recorte e entrega páginas de até 100.
- Fornecedores: 4.094.527 origem → 4.094.206 ativos por padrão → busca/filtros → página limitada.
- Decisores: 17.914 origem → 12.941 ativos → autorização e mascaramento → página limitada.
- Oportunidades: 1.314.135 matches → 687.087 ligados às 16.633 obras visíveis → filtros por obra/CNPJ/score → página limitada. Valores comerciais não são derivados do score.

Localização é classificada em três estados: `exact` (reservado a coordenada comprovada), `municipality` (centroide municipal, exibido como localização aproximada) e `unknown` (ausente). Nesta onda, os pontos fornecidos pelo mapa são municipais ou ausentes; nenhum centroide é apresentado como endereço exato.

`vw_projetos_mestre` permanece vazia. A rota de projetos é explicitamente uma projeção de obras, preserva a fonte e não inventa contrato, fase ou valor.
