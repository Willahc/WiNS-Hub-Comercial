--
-- PostgreSQL database dump
--

-- Dumped from database version 16.4
-- Dumped by pg_dump version 16.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: regras_prioridade_campos; Type: TABLE DATA; Schema: engenharia; Owner: -
--

COPY engenharia.regras_prioridade_campos (id, campo_canonico_id, ordem_prioridade, regra_conflito, observacao, versao, ativo, criado_em) FROM stdin;
1	CC-017	{pncp_obras,obrasgov_100k,aneel_transmissao,pncp_civil_100k,bndes_financiamento}	Maior valor vence (CAPEX consolidado > financiamento > parcela)	CAPEX real: PNCP edital > ObrasGov investimento > ANEEL leilao	2.0	t	2026-07-15 18:21:03.017329-03
2	CC-018	{bndes_financiamento}	Unica fonte; usar direto	Financiamento BNDES nao e CAPEX; manter separado	2.0	t	2026-07-15 18:21:03.017329-03
3	CC-022	{pncp_*,dou_100k}	PNCP e a unica fonte com CNPJ do orgao contratante	Atualmente tratado como executora — CORRIGIR para contratante	2.0	t	2026-07-15 18:21:03.017329-03
4	CC-026	{obrasgov_100k,cadastro_fornecedores}	Unica com CNPJ executora explicito	obrasgov tem executores[].codigo	2.0	t	2026-07-15 18:21:03.017329-03
5	CC-028	{bndes_financiamento}	Unica fonte; usar direto	Nao confundir com executora	2.0	t	2026-07-15 18:21:03.017329-03
6	CC-030	{aneel_siga,ibama_sislic}	Usar a mais completa	aneel_siga tem CNPJ via cruzamento CEG-Agentes	2.0	t	2026-07-15 18:21:03.017329-03
7	CC-032	{aneel_transmissao,anp}	Lookup hardcoded e fallback BrasilAPI	CNPJ nao vem no CSV; inferido por nome	2.0	t	2026-07-15 18:21:03.017329-03
8	CC-035	{pncp_*,obrasgov_100k,aneel_siga,anm,eletrobras_100k}	PNCP tem municipio mais confiavel (unidade do orgao)	Municipio da obra, nao da sede	2.0	t	2026-07-15 18:21:03.017329-03
9	CC-037	{pncp_*,obrasgov_100k,aneel_transmissao,aneel_siga,ibama_sislic,eletrobras_100k}	Direto da fonte com maior confiabilidade	UF da obra, nao da sede	2.0	t	2026-07-15 18:21:03.017329-03
10	CC-039	{sistema}	Sempre inferir do contexto da fonte e do campo usado	Regra: se veio de unidadeOrgao = LOCAL_OBRA; se de bndes = SEDE_EMPRESA	2.0	t	2026-07-15 18:21:03.017329-03
11	CC-042	{sistema}	Regra de classificacao por fonte	Fonte com maior A1% tem precedencia	2.0	t	2026-07-15 18:21:03.017329-03
12	CC-043	{obrasgov_100k,ibama_sislic,bndes_financiamento,pncp_*}	Usar classificacao nativa antes de inferir	Evitar keyword match se fonte ja tem setor nativo	2.0	t	2026-07-15 18:21:03.017329-03
\.


--
-- Name: regras_prioridade_campos_id_seq; Type: SEQUENCE SET; Schema: engenharia; Owner: -
--

SELECT pg_catalog.setval('engenharia.regras_prioridade_campos_id_seq', 12, true);


--
-- PostgreSQL database dump complete
--

