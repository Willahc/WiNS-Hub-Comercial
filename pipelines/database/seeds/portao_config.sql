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
-- Data for Name: portao_config; Type: TABLE DATA; Schema: engenharia; Owner: -
--

COPY engenharia.portao_config (chave, valor, atualizado_em, nota) FROM stdin;
PORTAO_VERSAO	portao-v5.0.0	2026-07-17 09:00:36.30029-03	Versão da matriz de regras
PORTAO_OBRAS_ENABLED	true	2026-07-17 09:02:13.526372-03	Master switch do Portão
PORTAO_OBRAS_NEW_CAPTURES_ENABLED	true	2026-07-17 09:02:13.526372-03	Protege novas capturas (invisível até decisão)
AUTO_ENRICH_AFTER_GATE_ENABLED	true	2026-07-17 09:02:13.526372-03	Enriquece automaticamente após APROVADA
PORTAO_OBRAS_AGENT_ENABLED	false	2026-07-17 09:02:13.526372-03	Agente de análise EM_ANALISE
PORTAO_OBRAS_HISTORICAL_ENABLED	true	2026-07-17 09:18:37.161916-03	Aplicar Portão no histórico (lotes)
PORTAO_SANITIZACAO_LOTE	0	2026-07-17 09:18:37.161916-03	contador de lotes da sanitizacao historica
\.


--
-- PostgreSQL database dump complete
--

