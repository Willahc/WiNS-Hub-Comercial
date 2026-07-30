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
-- Data for Name: categorias_servico; Type: TABLE DATA; Schema: engenharia; Owner: -
--

COPY engenharia.categorias_servico (id, codigo, nome, descricao, cnaes, icone, ordem, essencial, ativo, criado_em) FROM stdin;
1	CONS_ENG	Consultoria e Engenharia	Projetos, gerenciamento, fiscalizacao, EPCM	{7112000,7111100}	\N	10	t	t	2026-04-29 18:49:22.262216-03
2	TOPO_GEO	Topografia e Geodesia	Levantamento topografico, georreferenciamento	{7119799}	\N	20	t	t	2026-04-29 18:49:22.262216-03
3	SOND_GEO	Sondagem e Geotecnia	Estudos de solo, fundacoes, ensaios geotecnicos	{7112000,4313400}	\N	30	t	t	2026-04-29 18:49:22.262216-03
4	DEMO_TER	Demolicao e Preparo de Terreno	Demolicao, limpeza, regularizacao	{4311801}	\N	40	t	t	2026-04-29 18:49:22.262216-03
5	TERRA_MOV	Terraplanagem	Movimentacao de terra, escavacao, aterro	{4312600,4313400}	\N	50	t	t	2026-04-29 18:49:22.262216-03
6	FUND_EST	Fundacao e Estacas	Estacas, blocos, sapatas, radiers	{4313400,4391600}	\N	60	t	t	2026-04-29 18:49:22.262216-03
7	ESTRU_CON	Estrutura de Concreto	Concreto armado, formas, lajes, pre-moldados	{4319300}	\N	70	t	t	2026-04-29 18:49:22.262216-03
8	ESTRU_MET	Estrutura Metalica	Galpoes, trelicas, chapas, modulos	{2512000,4329103}	\N	80	t	t	2026-04-29 18:49:22.262216-03
10	PAVIM_VIA	Pavimentacao e Vias	Asfalto, concreto, patios, estradas	{4211101}	\N	100	t	t	2026-04-29 18:49:22.262216-03
11	IMPER_COB	Impermeabilizacao	Coberturas, lajes, fundacoes, reservatorios	{4330404}	\N	110	t	t	2026-04-29 18:49:22.262216-03
12	ACAB_REV	Acabamento e Revestimento	Pintura, revestimento, gesso, dry-wall	{4330402}	\N	120	t	t	2026-04-29 18:49:22.262216-03
13	INST_ELE	Instalacoes Eletricas	Cabeamento, quadros, SDAI, iluminacao	{4321500,2731700}	\N	130	t	t	2026-04-29 18:49:22.262216-03
14	INST_HID	Instalacoes Hidraulicas	Agua, esgoto, drenagem, incendio	{4322301}	\N	140	t	t	2026-04-29 18:49:22.262216-03
15	HVAC_CLI	Climatizacao HVAC	Ar condicionado, ventilacao, exaustao	{4322399,2823200}	\N	150	t	t	2026-04-29 18:49:22.262216-03
19	UTIL_IND	Utilidades Industriais	Vapor, ar comprimido, gases, agua gelada	{2821601}	\N	190	t	t	2026-04-29 18:49:22.262216-03
34	ENER_SOL	Energia Solar EPC	Modulos fotovoltaicos, inversores, trackers	{3511500}	\N	340	t	t	2026-04-29 18:49:22.262216-03
36	BIOM_GER	Geracao a Biomassa	Caldeiras, turbinas a vapor, bagaco	{3511500}	\N	360	t	t	2026-04-29 18:49:22.262216-03
37	BIOG_MET	Biogas e Biometano	Biodigestores, reatores, purificacao	{3520401}	\N	370	t	t	2026-04-29 18:49:22.262216-03
43	ARMA_SIL	Armazens e Silos	Galpoes, silos metalicos, moegas	{5211701}	\N	430	t	t	2026-04-29 18:49:22.262216-03
49	TRAT_EFL	Tratamento de Efluentes	ETE, biodigestores, lagoas, flotadores	{3812100}	\N	490	t	t	2026-04-29 18:49:22.262216-03
48	PROC_ALI	Processamento de Alimentos	Linhas de corte, embalagem, CIP	{2825900,4634601,2121101,4632001}	\N	480	t	t	2026-04-29 18:49:22.262216-03
17	INST_AUT	Instrumentacao e Automacao	CLPs, SCADA, sensores, DCS	{2651500,2759799,3250701}	\N	170	t	t	2026-04-29 18:49:22.262216-03
22	TUBU_IND	Tubulacao Industrial	Piping, isometricos, testes hidrostaticos	{2599399,4329199,7112000,3311200}	\N	220	t	t	2026-04-29 18:49:22.262216-03
23	ICAT_PES	Icamento e Transporte Pesado	Guindastes, gruas, SPMTs	{5229099,4923001,7112000,3316301}	\N	230	t	t	2026-04-29 18:49:22.262216-03
25	ISOL_TER	Isolamento Termico	Isolamento de tubulacoes, dutos, equipamentos	{4329199,4330499,1710900,7112000}	\N	250	t	t	2026-04-29 18:49:22.262216-03
20	MONT_IND	Montagem Industrial	Montagem de equipamentos e skids	{3311200,3312102,3321000,4292802,4329199,7112000}	\N	200	t	t	2026-04-29 18:49:22.262216-03
21	CALD_SOL	Caldeiraria e Soldagem	Vasos de pressao, tubulacoes, tanques	{2512000,2521700,2599399,3311200,7112000}	\N	210	t	t	2026-04-29 18:49:22.262216-03
24	MANU_IND	Manutencao Industrial	Manutencao preventiva, preditiva, corretiva	{2599399,3311200,3314710,3314719,3314799,3319800,7112000}	\N	240	t	t	2026-04-29 18:49:22.262216-03
59	SEG_TRA	Seguranca do Trabalho	EPIs, NRs, CIPA, treinamentos, brigada	{8299799}	\N	590	t	t	2026-04-29 18:49:22.262216-03
60	MEIO_AMB	Meio Ambiente e Licenciamento	EIA/RIMA, PRAD, monitoramento	{7490104}	\N	600	t	t	2026-04-29 18:49:22.262216-03
61	GEST_RES	Gestao de Residuos	Coleta, tratamento, co-processamento	{3812100}	\N	610	t	t	2026-04-29 18:49:22.262216-03
62	SAUDE_OC	Saude Ocupacional	PCMSO, medicina do trabalho, ergonomia	{8650099}	\N	620	t	t	2026-04-29 18:49:22.262216-03
63	SERV_AMB	Servicos Ambientais	Remediacao, passivo ambiental	{3812100}	\N	630	t	t	2026-04-29 18:49:22.262216-03
64	UTIL_FAC	Utilities e Facilidades	Refeitorio, alojamento, facilities	{5590699}	\N	640	t	t	2026-04-29 18:49:22.262216-03
56	ROD_AER	Rodovias e Aeroportos	Pavimentacao, sinalizacao, pistas	{5221400,5240101,4211101,7112000}	\N	560	t	t	2026-04-29 18:49:22.262216-03
16	SUBE_ALT	Subestacao e Alta Tensao	Subestacoes, transformadores, transmissao	{3514000,3513100}	\N	160	t	t	2026-04-29 18:49:22.262216-03
33	LINH_TRA	Linha de Transmissao	Torres, cabos, isoladores	{3513100,3514000,4221901}	\N	330	t	t	2026-04-29 18:49:22.262216-03
65	LOCA_EQU	Locacao de Equipamentos	Gruas, andaimes, formas, geradores	{7739099,7731400,7732201}	\N	650	t	t	2026-04-29 18:49:22.262216-03
35	ENER_EOL	Energia Eolica EPC	Torres eolicas, naceles, pas	{3512300,3511500,4221902}	\N	350	t	t	2026-04-29 18:49:22.262216-03
28	EMPI_FIL	Empilhamento e Filtragem	Filtros de prensa, empilhadores, pilhas a seco	{2814301,3312102,7112000,4313400}	\N	280	t	t	2026-04-29 18:49:22.262216-03
18	TELE_TI	Telecomunicacoes e TI	Fibra optica, redes, CCTV	{6110803,6190601,2731700,6190699}	\N	180	t	t	2026-04-29 18:49:22.262216-03
55	AUTO_MAN	Automacao de Manufatura	Robotica, AGVs, MES/ERP, Industry 4.0	{6202300,6203100,2622100,2631100}	\N	550	t	t	2026-04-29 18:49:22.262216-03
53	MECA_AGR	Mecanizacao Agricola	Colhedoras, tratores, implementos	{0113000,2833000,3311200,4623199}	\N	530	t	t	2026-04-29 18:49:22.262216-03
26	MINE_DRE	Mineroduto e Drenagem de Mina	Minerodutos, bombeamento, drenagem	{0810099,3812100,7112000,4313400}	\N	260	t	t	2026-04-29 18:49:22.262216-03
27	BRIT_BEN	Britagem e Beneficiamento	Britadores, peneiras, moinhos	{0810099,2814301,7112000,3311200}	\N	270	t	t	2026-04-29 18:49:22.262216-03
29	DESC_BAR	Descaracterizacao de Barragens	Geotecnia, monitoramento, drenagem	{7112000,4313400,4391600}	\N	290	t	t	2026-04-29 18:49:22.262216-03
30	PERF_DET	Perfuracao e Detonacao	Perfuratrizes, explosivos, plano de fogo	{4313400,2091600,7112000,0810099}	\N	300	t	t	2026-04-29 18:49:22.262216-03
31	TRAN_MIN	Transporte de Minerio	Correias transportadoras, caminhoes	{4930202,4930201,2815101,7112000}	\N	310	t	t	2026-04-29 18:49:22.262216-03
32	MONT_ELM	Montagem Eletromecanica	Geradores, turbinas, transformadores	{3511501,3511502,7112000,4321500,3311200}	\N	320	t	t	2026-04-29 18:49:22.262216-03
38	OFFS_ENG	Engenharia Offshore	Subsea, risers, FPSOs, plataformas	{1100600,7112000,4291000,2599399}	\N	380	t	t	2026-04-29 18:49:22.262216-03
39	DUTO_GAS	Dutos e Gasodutos	Oleodutos, gasodutos, integridade	{4222701,2599399,7112000,4329199}	\N	390	t	t	2026-04-29 18:49:22.262216-03
40	PROC_OGS	Sistemas de Processo Oil Gas	Separadores, compressores, FPSO	{2821601,2813700,7112000,3311200}	\N	400	t	t	2026-04-29 18:49:22.262216-03
41	PORT_DRA	Obras Portuarias e Dragagem	Cais, pieres, bercos, dragagem	{5030101,5030100,4291000,7112000,4313400}	\N	410	t	t	2026-04-29 18:49:22.262216-03
42	EQUI_MOV	Equipamentos de Movimentacao	Porteineres, reach-stackers, correias	{5030100,3316301,7112000,3311200}	\N	420	t	t	2026-04-29 18:49:22.262216-03
44	FERR_VIA	Via Permanente Ferroviaria	Trilhos, dormentes, patios, desvios	{4212000,3316301,7112000,4313400}	\N	440	t	t	2026-04-29 18:49:22.262216-03
45	TERM_POR	Terminais e Retroarea	Pavimentacao portuaria, cercamento	{5231102,5211701,4211101,7112000}	\N	450	t	t	2026-04-29 18:49:22.262216-03
51	USINA_EPC	Usina Sucroenergetica EPC	Moendas, evaporadores, destilaria	{2821601,1071600,7112000,3311200}	\N	510	t	t	2026-04-29 18:49:22.262216-03
52	ETAN_BIO	Etanol e Biocombustiveis	Destilarias, fermentacao, E2G	{1931400,1932200,1122401,3520401,7112000}	\N	520	t	t	2026-04-29 18:49:22.262216-03
54	AUTO_LIN	Linha de Producao Automotiva	Estamparia, solda, pintura, montagem	{2910701,3312102,7112000,3311200}	\N	540	t	t	2026-04-29 18:49:22.262216-03
9	OBRAS_ART	Obras de Arte Especiais	Pontes, viadutos, tuneis, contencoes	{4212000,4291000,7112000,4313400}	\N	90	t	t	2026-04-29 18:49:22.262216-03
57	SANE_AGU	Saneamento e Agua	ETAs, ETEs, redes de agua e esgoto	{3600601,4222001,7112000,4313400}	\N	570	t	t	2026-04-29 18:49:22.262216-03
58	DATA_CEN	Data Centers Infraestrutura	Eletrica, mecanica, TI, seguranca fisica	{6311900,4321500,7112000,6190699}	\N	580	t	t	2026-04-29 18:49:22.262216-03
46	FRIG_CAM	Camaras Frigorificas	Camaras, tuneis de congelamento, paineis	{4322399,3314707,7112000,4321500}	\N	460	t	t	2026-04-29 18:49:22.262216-03
47	ABAT_EQU	Equipamentos de Abate	Linhas de abate, evisceradores, chilling	{2825900,3314707,7112000,3311200}	\N	470	t	t	2026-04-29 18:49:22.262216-03
50	REFR_IND	Refrigeracao Industrial	Amonia, CO2, glicol, centrais	{2823200,4322399,7112000,4321500}	\N	500	t	t	2026-04-29 18:49:22.262216-03
66	OBR_CIV	Construção Civil / Alvenaria	Alvenaria, construção de edifícios e residências	{4399103,4120400,4110700}	\N	250	t	t	2026-05-21 15:15:47.364944-03
67	AR_COND	Climatização & Ar Condicionado	Instalação e manutenção de sistemas centrais	{4322302,4329101}	\N	260	f	t	2026-05-21 15:15:47.364944-03
68	SERR_MET	Serralheria & Esquadrias	Serralheria, esquadrias metálicas	{2542000,2599301}	\N	270	f	t	2026-05-21 15:15:47.364944-03
69	DES_TEC	Desenho Técnico & Perícia	Desenho técnico, perícia, topografia	{7119703,7119701,7119704}	\N	280	f	t	2026-05-21 15:15:47.364944-03
71	MINE_EXT	Mineração e Extração Mineral	\N	{0710301,0710302,0721001,0722801,0723301,0729401,0810001,0810002,0891600,0892401}	\N	265	t	t	2026-05-22 09:45:55.193544-03
70	PETR_OGE	Petróleo, Gás e E&P	\N	{0600001,0600002,0910600,1921700,1922501,1922502,3520401,3520402,4681801,4681802,4292801}	\N	410	t	t	2026-05-22 09:45:55.193544-03
\.


--
-- Name: categorias_servico_id_seq; Type: SEQUENCE SET; Schema: engenharia; Owner: -
--

SELECT pg_catalog.setval('engenharia.categorias_servico_id_seq', 71, true);


--
-- PostgreSQL database dump complete
--

