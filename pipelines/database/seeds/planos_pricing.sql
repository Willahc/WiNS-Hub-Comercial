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
-- Data for Name: planos_pricing; Type: TABLE DATA; Schema: engenharia; Owner: -
--

COPY engenharia.planos_pricing (id, plano, periodo, preco_centavos, saldo_centavos, desconto_pct, ativo) FROM stdin;
1	ESSENCIAL	mensal	29700	29700	0	f
2	ESSENCIAL	trimestral	84700	89100	5	f
3	ESSENCIAL	semestral	160400	178200	10	f
4	ESSENCIAL	anual	285200	356400	20	f
5	PROFISSIONAL	mensal	69700	69700	0	f
6	PROFISSIONAL	trimestral	198700	209100	5	f
7	PROFISSIONAL	semestral	376400	418200	10	f
8	PROFISSIONAL	anual	669100	836400	20	f
9	ENTERPRISE	mensal	199700	250000	0	f
10	ENTERPRISE	trimestral	569200	750000	5	f
11	ENTERPRISE	semestral	1078400	1500000	10	f
12	ENTERPRISE	anual	1917100	3000000	20	f
13	SETOR	mensal	49700	49700	0	t
14	NACIONAL	mensal	149700	149700	0	t
\.


--
-- Name: planos_pricing_id_seq; Type: SEQUENCE SET; Schema: engenharia; Owner: -
--

SELECT pg_catalog.setval('engenharia.planos_pricing_id_seq', 14, true);


--
-- PostgreSQL database dump complete
--

