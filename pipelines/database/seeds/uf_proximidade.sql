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
-- Data for Name: uf_proximidade; Type: TABLE DATA; Schema: engenharia; Owner: -
--

COPY engenharia.uf_proximidade (uf_obra, uf_fornec, peso, tipo) FROM stdin;
AC	AC	1.0	mesma
AL	AL	1.0	mesma
AM	AM	1.0	mesma
AP	AP	1.0	mesma
BA	BA	1.0	mesma
CE	CE	1.0	mesma
DF	DF	1.0	mesma
ES	ES	1.0	mesma
GO	GO	1.0	mesma
MA	MA	1.0	mesma
MG	MG	1.0	mesma
MS	MS	1.0	mesma
MT	MT	1.0	mesma
PA	PA	1.0	mesma
PB	PB	1.0	mesma
PE	PE	1.0	mesma
PI	PI	1.0	mesma
PR	PR	1.0	mesma
RJ	RJ	1.0	mesma
RN	RN	1.0	mesma
RO	RO	1.0	mesma
RR	RR	1.0	mesma
RS	RS	1.0	mesma
SC	SC	1.0	mesma
SE	SE	1.0	mesma
SP	SP	1.0	mesma
TO	TO	1.0	mesma
SP	MG	0.6	vizinha
SP	RJ	0.6	vizinha
SP	PR	0.6	vizinha
SP	MS	0.6	vizinha
MG	SP	0.6	vizinha
MG	RJ	0.6	vizinha
MG	ES	0.6	vizinha
MG	BA	0.6	vizinha
MG	GO	0.6	vizinha
RJ	SP	0.6	vizinha
RJ	MG	0.6	vizinha
RJ	ES	0.6	vizinha
PR	SP	0.6	vizinha
PR	SC	0.6	vizinha
PR	MS	0.6	vizinha
SC	PR	0.6	vizinha
SC	RS	0.6	vizinha
RS	SC	0.6	vizinha
ES	MG	0.6	vizinha
ES	RJ	0.6	vizinha
ES	BA	0.6	vizinha
BA	MG	0.6	vizinha
BA	ES	0.6	vizinha
BA	PE	0.6	vizinha
BA	SE	0.6	vizinha
BA	GO	0.6	vizinha
BA	TO	0.6	vizinha
BA	PI	0.6	vizinha
GO	MG	0.6	vizinha
GO	BA	0.6	vizinha
GO	TO	0.6	vizinha
GO	MT	0.6	vizinha
GO	MS	0.6	vizinha
GO	DF	0.6	vizinha
DF	GO	0.6	vizinha
MS	SP	0.6	vizinha
MS	PR	0.6	vizinha
MS	MT	0.6	vizinha
MS	GO	0.6	vizinha
MT	MS	0.6	vizinha
MT	GO	0.6	vizinha
MT	RO	0.6	vizinha
MT	PA	0.6	vizinha
MT	TO	0.6	vizinha
PE	BA	0.6	vizinha
PE	AL	0.6	vizinha
PE	PB	0.6	vizinha
PE	PI	0.6	vizinha
PE	CE	0.6	vizinha
CE	PE	0.6	vizinha
CE	PI	0.6	vizinha
CE	RN	0.6	vizinha
CE	PB	0.6	vizinha
PA	MT	0.6	vizinha
PA	TO	0.6	vizinha
PA	MA	0.6	vizinha
PA	AM	0.6	vizinha
PA	AP	0.6	vizinha
PA	RR	0.6	vizinha
TO	BA	0.6	vizinha
TO	GO	0.6	vizinha
TO	MT	0.6	vizinha
TO	PA	0.6	vizinha
TO	MA	0.6	vizinha
TO	PI	0.6	vizinha
\.


--
-- PostgreSQL database dump complete
--

