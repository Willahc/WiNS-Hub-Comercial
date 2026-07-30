# WiNS Hub — Onda 1 — Resolução de identidade

As regras executáveis estão em `apps/api/identity_resolution.py`; três testes automatizados cobrem CNPJ, organização provável e pessoa ambígua.

## Empresas e fornecedores

Ordem aplicada:

1. CNPJ com 14 dígitos e dígitos verificadores válidos: mesmo CNPJ = confirmado; CNPJs válidos diferentes = conflitante.
2. Identificador original idêntico no mesmo contrato de origem = confirmado.
3. Nome normalizado sem acento/pontuação + município = provável.
4. Nome + endereço normalizado = provável.
5. Nome + telefone ou domínio = possível.
6. Sem evidência suficiente = não resolvido.

A API não materializa fusões dos 837.810 CNPJs inválidos do Core nem dos 710.530 inválidos de fornecedores. Eles permanecem identificáveis pela origem e não são unidos automaticamente.

## Decisores

Critérios: empresa, cargo, nome normalizado, email, telefone e fonte. Mesmo nome em empresas diferentes é `conflicting`; mesma empresa+nome sem contato é no máximo `possible`; confirmação exige mesma empresa e email ou telefone. Pessoas ambíguas permanecem separadas.

## Resultados e pendências

- CNPJ é único fisicamente em `core.empresa` e `engenharia.fornecedores`.
- Existem 344.914 repetições por nome+município em empresas e 208.236 em fornecedores; isso não autoriza fusão.
- Há 247 repetições históricas por obra+nome+cargo em decisores; ativos são protegidos por índice único obra+nome.
- A reconciliação online desta onda preserva os registros e classifica evidência; não executa merge, update ou exclusão.
