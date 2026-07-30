# WiNS Hub — Onda 1 — Reconciliação

Não houve carga nem tabela canônica materializada. “Extraído” significa universo selecionável pela consulta da API; “exibido” é o tamanho da primeira janela atualmente carregada pelo frontend.

| Entidade | Origem | Extraído pela regra | Válido | Rejeitado | Canônico lógico | Deduplicado | Disponível na API | Exibido inicialmente |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Obras | 35.690 | 16.633 visíveis | 16.633 | 19.057 não visíveis | 16.633 | 16.633 | 16.633 | 100 |
| Projetos | 0 na view mestre | 16.633 obras projetadas | 16.633 | 0 | 16.633 projeções | 16.633 | 16.633 | 100 |
| Empresas | 4.825.673 | 636.404 `vivo=true` | 636.404 pela regra ativa; 3.987.863 CNPJs válidos no total | 4.189.269 inativas no recorte | 636.404 | 636.404 por PK CNPJ | 636.404 | 100 |
| Fornecedores | 4.094.527 | 4.094.206 situação `02` | 3.383.997 CNPJs válidos no total físico | 321 fora da situação ativa; CNPJ inválido preservado com qualidade | 4.094.206 | 4.094.206 por PK CNPJ | 4.094.206 | 50 na tela própria |
| Decisores | 17.914 | 12.941 não excluídos | 12.941 vinculados a obra | 4.973 excluídos | 12.941 | índice ativo obra+nome | 12.941 | 50 |
| Oportunidades | 1.314.135 matches | 687.087 ligados a obra visível | 687.087 | 627.048 ligados a obra não visível | 687.087 | PK obra+CNPJ | 687.087 | até 100 com score mínimo 70 |
| Pontos do mapa | 35.690 obras | 16.633 visíveis | somente precisão municipal quando município resolve | sem coordenada exata: 35.690 | 16.633 features potenciais | por UUID | 16.633 | 100 |

## Explicação das diferenças

- Obras: diferença exata de 19.057 por `visivel IS NOT TRUE`.
- Empresas: diferença de 4.189.269 por `vivo IS NOT TRUE` quando o filtro ativo é solicitado.
- Fornecedores: a API usa estritamente `situacao_cadastral='02'`; não mistura a coluna legada `situacao`.
- Decisores: 4.973 possuem `excluido_em` e não são publicados.
- Oportunidades: somente matches de obras visíveis são publicados.
- Frontend: usa paginação controlada; não transfere milhões de linhas ao navegador.

Tolerância para registros não filtrados é zero: totais físicos foram reconciliados diretamente. Diferenças da API são todas regras explícitas acima.
