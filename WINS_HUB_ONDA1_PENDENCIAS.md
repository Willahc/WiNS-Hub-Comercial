# WiNS Hub — Onda 1 — Pendências e parecer

## Parecer

**HOMOLOGADA COM RESSALVAS** para execução local/staging técnico e apresentação controlada. **Não homologada para cutover ou exposição pública irrestrita.**

## Ressalvas obrigatórias

1. API real ainda não foi implantada em URL externa de staging; o frontend real foi validado localmente.
2. Autenticação real não está homologada. O token de desenvolvimento só funciona fora do modo forçado de produção.
3. Busca textual de fornecedores apresenta p95 de 6,05 s; os índices propostos precisam de aprovação antes de criação.
4. Empresa 360° pode levar cerca de 5,75 s por falta de índices de CNPJ nas obras.
5. Nenhuma obra possui coordenada própria. O mapa usa centroide municipal e 10.177 obras nem sequer possuem município.
6. `EngineeringProject` é projeção de obra porque a view mestre possui zero registros.
7. Matches não possuem valor comercial homologado; o frontend não inventa valor.
8. CNPJ inválido é relevante: 837.810 em empresas e 710.530 em fornecedores. Esses registros permanecem separados e sinalizados.
9. A política LGPD formal, retenção e autorização de contatos ainda depende de aprovação organizacional. A implementação atual mascara por padrão e audita a consulta.
10. Não foi executada carga, fusão materializada, migração, índice, publicação externa ou cutover.

## Próximas decisões necessárias — sem iniciar Onda 2

- aprovar os índices propostos e janela de criação/rollback;
- disponibilizar identidade real de staging e permissão `decisores:sensitive` apenas para perfis autorizados;
- definir URL de implantação da API Onda 1;
- homologar regra de valor de oportunidade e entidade Projeto;
- aprovar geocodificação de obra além do centroide municipal;
- definir SLA de atualização das quatro fontes da Onda 1.
