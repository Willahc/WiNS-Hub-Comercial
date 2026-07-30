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
-- Data for Name: ufs_vizinhas; Type: TABLE DATA; Schema: engenharia; Owner: -
--

COPY engenharia.ufs_vizinhas (uf, uf_vizinha) FROM stdin;
AC	AM
AC	RO
AM	AC
AM	RO
AM	RR
AM	PA
AM	MT
AP	PA
PA	AM
PA	AP
PA	RR
PA	MA
PA	TO
PA	MT
RO	AC
RO	AM
RO	MT
RR	AM
RR	PA
TO	PA
TO	MA
TO	PI
TO	BA
TO	GO
TO	MT
AL	PE
AL	SE
AL	BA
BA	SE
BA	AL
BA	PE
BA	PI
BA	TO
BA	GO
BA	MG
BA	ES
CE	PI
CE	PB
CE	PE
CE	RN
MA	PA
MA	TO
MA	PI
PB	RN
PB	CE
PB	PE
PE	PB
PE	CE
PE	PI
PE	BA
PE	AL
PI	MA
PI	TO
PI	BA
PI	PE
PI	CE
RN	CE
RN	PB
SE	AL
SE	BA
DF	GO
DF	MG
GO	TO
GO	BA
GO	MG
GO	MS
GO	MT
GO	DF
MS	MT
MS	GO
MS	MG
MS	SP
MS	PR
MT	AM
MT	PA
MT	RO
MT	TO
MT	GO
MT	MS
ES	BA
ES	MG
ES	RJ
MG	BA
MG	GO
MG	DF
MG	MS
MG	SP
MG	RJ
MG	ES
RJ	MG
RJ	ES
RJ	SP
SP	MG
SP	RJ
SP	PR
SP	MS
PR	SP
PR	MS
PR	SC
RS	SC
SC	PR
SC	RS
\.


--
-- PostgreSQL database dump complete
--

