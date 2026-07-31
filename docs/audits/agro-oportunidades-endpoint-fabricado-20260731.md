# Evidência Técnica — Endpoint /agro/oportunidades/calculadas com dados fabricados

Data: 2026-07-31
Autor: auditoria de semântica de dados — vertical Agro 360 (worktree limpa `fix/agro-layout-semantica-dados-clean`)

## Causa raiz

O endpoint `GET /api/v1/agro/oportunidades/calculadas` (backend `wins_hub_unificado`, rota em
`apps/api/routes.py` ~linha 675 → `Wave1Repository.agro_oportunidades_calculadas` em
`apps/api/wave1_repository.py` ~linha 2672) retorna uma lista **hardcoded** de 5 oportunidades
(`opp_agro_001` a `opp_agro_005`) com nomes de decisores, e-mails, telefones, códigos CAR,
CNPJs, produtos recomendados e scores fabricados. Não há persistência, evidência, fonte,
data de cálculo nem versão de algoritmo — os filtros `categoria`/`uf`/`min_score` apenas
filtram a lista em memória.

## Resposta observada (porta 18085, data 2026-07-31)

Registros fabricados: `opp_agro_001`…`opp_agro_005`, com campos como
`decisor_nome: "Carlos Alberto de Mendonça"`, `contato: "carlos.mendonca@boavistaagro.com.br"`,
`imovel: "Fazenda Boa Vista · CAR MT-5107909-84A1"`, `cnpj: "18.245.910/0001-84"`, `score: 96`,
`produto_recomendado: "Fertilizante Formulão NPK NPK 04-14-08 (Big Bags 1.000 kg)"`.

## Tratamento aplicado (frontend, política fail-closed)

1. Nenhum card retornado por esse endpoint é renderizado enquanto cada item não satisfizer o
   contrato de dado real em `src/pages/agroOportunidadesContract.ts`:
   `id, entidade_agro, codigo_car, cnpj, evidencia, regra_geracao, composicao_score, fonte,
   data_calculo, versao_algoritmo, decisor, limitacoes`.
2. Teste que impede a apresentação do conjunto fabricado como dado real:
   `src/tests/agroOportunidadesContract.test.ts` (asserts `isMotorOportunidadesReal(fixture)` é falso).
3. A página `/agro/oportunidades` exibe estado informativo "Motor de Oportunidades Agro em
   validação" com a mensagem de desativação do conjunto ilustrativo.
4. O dashboard `/agro` mantém a verdade "Oportunidades ainda não calculadas para este recorte."
   e o card de acesso ao módulo exibe o badge "Em validação".

## Pendência real (backend, fora do escopo desta rodada)

Substituir a lista hardcoded por um motor real persistido que retorne itens com o contrato
acima, ou retornar lista vazia. Não transformar fixtures em respostas vazias sem essa
evidência técnica preservada e sem o teste de regressão do contrato.

## Critérios de reativação (cada oportunidade deve possuir)

- ID persistido;
- entidade Agro real;
- código CAR ou CNPJ comprovado;
- evidência da necessidade;
- regra de geração documentada;
- composição explicável do score;
- fonte;
- data de cálculo;
- versão do algoritmo;
- decisor classificado como comprovado, sugerido, sócio ou contato;
- limitações.
