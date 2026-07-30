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
-- Data for Name: captadores; Type: TABLE DATA; Schema: engenharia; Owner: -
--

COPY engenharia.captadores (id, nome, fonte_id, script_path, versao, hash_script, ativo, criado_em) FROM stdin;
1	captar_aneel_siga	3	captadores/aneel_siga.py	2.0.0	\N	t	2026-07-15 18:21:03.017329-03
3	captar_anm	5	captadores/anm.py	2.0.0	\N	t	2026-07-15 18:21:03.017329-03
5	captar_antt_ferro_pic	7	captadores/antt_ferro_pic.py	2.0.0	\N	t	2026-07-15 18:21:03.017329-03
6	captar_antt_rod_legado	8	captadores/antt_rod_legado.py	2.0.0	\N	t	2026-07-15 18:21:03.017329-03
7	captar_bndes_financiamento	9	captadores/bndes_financiamento.py	2.0.0	\N	t	2026-07-15 18:21:03.017329-03
8	captar_cadastro_fornecedores	10	captadores/cadastro_fornecedores.py	2.0.0	\N	t	2026-07-15 18:21:03.017329-03
9	captar_curitiba_alvaras	11	captadores/curitiba_alvaras.py	2.0.0	\N	t	2026-07-15 18:21:03.017329-03
10	captar_dou	12	captadores/dou.py	2.0.0	\N	t	2026-07-15 18:21:03.017329-03
11	captar_eletrobras	13	captadores/eletrobras.py	2.0.0	\N	t	2026-07-15 18:21:03.017329-03
12	captar_geosampa	14	captadores/geosampa.py	2.0.0	\N	t	2026-07-15 18:21:03.017329-03
13	captar_ibama_sislic	15	captadores/ibama_sislic.py	2.0.0	\N	t	2026-07-15 18:21:03.017329-03
14	captar_inpi	16	captadores/inpi.py	2.0.0	\N	t	2026-07-15 18:21:03.017329-03
15	captar_noticias_obras	17	captadores/noticias_obras.py	2.0.0	\N	t	2026-07-15 18:21:03.017329-03
16	captar_noticias_prefacio	18	captadores/noticias_prefacio.py	2.0.0	\N	t	2026-07-15 18:21:03.017329-03
17	captar_obrasgov	19	captadores/obrasgov.py	2.0.0	\N	t	2026-07-15 18:21:03.017329-03
19	captar_pncp_civil	21	captadores/pncp_civil.py	2.0.0	\N	t	2026-07-15 18:21:03.017329-03
20	captar_recife_licenciamento	22	captadores/recife_licenciamento.py	2.0.0	\N	t	2026-07-15 18:21:03.017329-03
1557	captar_pncp_consulta	1559	pipeline/captar_pncp_consulta	pipeline-v2	\N	t	2026-07-17 01:41:57.195006-03
30	captar_ibama	15	pipeline/captar_ibama	pipeline-v2	\N	t	2026-07-16 14:17:25.222136-03
1560	captar_pncp_full	1562	pipeline/captar_pncp_full	pipeline-v2	\N	t	2026-07-17 01:51:46.049612-03
2	captar_aneel_transmissao	4	captadores/aneel_transmissao.py	2.0.0	\N	t	2026-07-15 18:21:03.017329-03
33	captar_bndes	55	pipeline/captar_bndes	pipeline-v2	\N	t	2026-07-16 14:17:25.501192-03
39	captar_cvm	41	pipeline/captar_cvm	pipeline-v2	\N	t	2026-07-16 14:17:25.993182-03
42	captar_dou_inlabs	44	pipeline/captar_dou_inlabs	pipeline-v2	\N	t	2026-07-16 14:17:26.221282-03
45	captar_recife_licenciamento_100k	47	pipeline/captar_recife_licenciamento_100k	pipeline-v2	\N	t	2026-07-16 14:17:26.476119-03
1640	captar_pncp_civil_100k	21	pipeline/captar_pncp_civil_100k	pipeline-v2	\N	t	2026-07-17 08:25:58.518093-03
1644	captar_doe_pa	1646	pipeline/captar_doe_pa	pipeline-v2	\N	t	2026-07-17 08:25:59.275897-03
4	captar_anp	50	captadores/anp.py	2.0.0	\N	t	2026-07-15 18:21:03.017329-03
1645	captar_noticia_moneytimes	1647	pipeline/captar_noticia_moneytimes	pipeline-v2	\N	t	2026-07-17 08:25:59.614115-03
18	captar_pncp_obras	20	captadores/pncp_obras.py	2.0.0	\N	t	2026-07-15 18:21:03.017329-03
24	captar_obrasgov_100k	19	pipeline/captar_obrasgov_100k	pipeline-v2	\N	t	2026-07-16 14:17:24.725271-03
27	captar_aneel	3	pipeline/captar_aneel	pipeline-v2	\N	t	2026-07-16 14:17:24.964376-03
36	captar_antaq	38	pipeline/captar_antaq	pipeline-v2	\N	t	2026-07-16 14:17:25.748923-03
\.


--
-- Name: captadores_id_seq; Type: SEQUENCE SET; Schema: engenharia; Owner: -
--

SELECT pg_catalog.setval('engenharia.captadores_id_seq', 1645, true);


--
-- PostgreSQL database dump complete
--

