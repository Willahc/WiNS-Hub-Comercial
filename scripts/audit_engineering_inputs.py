#!/usr/bin/env python3
"""
Auditoria Orientada a Insumos — Módulo Engenharia
Gera arquivos em docs/audits/engineering-inputs/ sem modificar o frontend.
"""
import csv
import json
import os
import re
import unicodedata
import traceback
from datetime import datetime, timezone

import psycopg2

TARGET_DIR = os.environ.get("TARGET_DIR", "docs/audits/engineering-inputs")
DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "db"),
    "database": os.environ.get("DB_NAME", "wins_agro"),
    "user": os.environ.get("DB_USER", "wins_hub_api_ro"),
    "password": os.environ.get("DB_PASS", ""),
}


def _normalize(text: str) -> str:
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text).lower()
    return re.sub(r"[^a-z0-9\s]", " ", text)


# Palavras-chave para classificação de papel do CNAE (ordem importa)
PALAVRAS_PAPEL = [
    ("INSTALADOR", ["instalação", "instalacao", "instalador", "montagem", "implantação", "montagem eletromecanica", "subestacao"]),
    ("MANUTENCAO", ["manutenção", "manutencao", "reparação", "reparacao", "conserto", "conservação"]),
    ("LOCADOR_DE_MAQUINAS_E_EQUIPAMENTOS", ["aluguel", "locação", "locacao", "locadora", "leasing"]),
    ("EMPREITEIRA_ESPECIALIZADA", ["empreiteira", "empreitada", "subempreiteira"]),
    ("CONSTRUTORA", ["construção", "construcao", "edificações", "edificacao", "edificio", "obra civil", "obra pública"]),
    ("PROJETISTA_CONSULTORIA", ["consultoria", "projetos", "projetista", "engenharia", "topografia", "geotecnia", "sondagem", "desenho técnico", "perícia", "fiscalização", "gerenciamento", "assessoria"]),
]

PALAVRAS_OPERADOR = [
    "geração de energia", "transmissão de energia", "distribuição de energia",
    "geracao de energia", "transmissao de energia", "distribuicao de energia",
    "concessionária de", "concessionaria de", "operadora de", "concessionária",
    "concessionaria", "operadora", "saneamento", "abastecimento",
    "administração pública", "administracao publica", "prefeitura", "município",
    "estado", "governo", "autarquia", "fundação", "secretaria", "ministério",
]


# Mapeamento de disciplina agrupadora por categoria de serviço
DISCIPLINA_POR_SERVICO = {
    "CONS_ENG": "Engenharia / Consultoria",
    "TOPO_GEO": "Topografia / Geotecnia",
    "SOND_GEO": "Topografia / Geotecnia",
    "DEMO_TER": "Civil / Demolição",
    "TERRA_MOV": "Civil / Terraplenagem",
    "FUND_EST": "Civil / Fundações",
    "ESTRU_CON": "Civil / Estruturas",
    "ESTRU_MET": "Civil / Estruturas Metálicas",
    "OBRAS_ART": "Civil / Obras de Arte",
    "PAVIM_VIA": "Civil / Pavimentação",
    "IMPER_COB": "Civil / Impermeabilização",
    "ACAB_REV": "Civil / Acabamento",
    "INST_ELE": "Elétrica",
    "INST_HID": "Hidráulica / Saneamento",
    "HVAC_CLI": "Mecânica / Climatização",
    "SUBE_ALT": "Elétrica / Subestação",
    "INST_AUT": "Elétrica / Automação",
    "TELE_TI": "Telecomunicações / TI",
    "UTIL_IND": "Mecânica / Utilidades",
    "MONT_IND": "Mecânica / Montagem",
    "CALD_SOL": "Mecânica / Caldeiraria",
    "TUBU_IND": "Mecânica / Tubulação",
    "ICAT_PES": "Mecânica / Içamento",
    "MANU_IND": "Mecânica / Manutenção",
    "ISOL_TER": "Mecânica / Isolamento",
    "OBR_CIV": "Civil / Construção",
    "AR_COND": "Mecânica / Climatização",
    "MINE_DRE": "Mineração / Drenagem",
    "MINE_EXT": "Mineração / Extração",
    "SERR_MET": "Civil / Serralheria",
    "BRIT_BEN": "Mineração / Beneficiamento",
    "DES_TEC": "Engenharia / Técnico",
    "EMPI_FIL": "Mineração / Filtragem",
    "DESC_BAR": "Civil / Geotecnia",
    "PERF_DET": "Mineração / Perfuração",
    "TRAN_MIN": "Mineração / Transporte",
    "MONT_ELM": "Elétrica / Montagem Eletromecânica",
    "LINH_TRA": "Elétrica / Transmissão",
    "ENER_SOL": "Elétrica / Solar",
    "ENER_EOL": "Elétrica / Eólica",
    "BIOM_GER": "Elétrica / Biomassa",
    "BIOG_MET": "Mecânica / Biogás",
    "OFFS_ENG": "Civil / Offshore",
    "DUTO_GAS": "Mecânica / Dutos",
    "PROC_OGS": "Mecânica / Processo",
    "PETR_OGE": "Mecânica / Petróleo",
    "PORT_DRA": "Civil / Portuário",
    "EQUI_MOV": "Mecânica / Movimentação",
    "ARMA_SIL": "Civil / Armazenagem",
    "FERR_VIA": "Civil / Ferrovia",
    "TERM_POR": "Civil / Portuário",
    "FRIG_CAM": "Mecânica / Refrigeração",
    "ABAT_EQU": "Mecânica / Processamento",
    "PROC_ALI": "Mecânica / Alimentos",
    "TRAT_EFL": "Hidráulica / Efluentes",
    "REFR_IND": "Mecânica / Refrigeração",
    "USINA_EPC": "Mecânica / Açúcar e Álcool",
    "ETAN_BIO": "Mecânica / Bio combustíveis",
    "MECA_AGR": "Agrícola / Mecanização",
    "AUTO_LIN": "Industrial / Automotivo",
    "AUTO_MAN": "Industrial / Automação",
    "ROD_AER": "Civil / Rodovia/Aeroporto",
    "SANE_AGU": "Hidráulica / Saneamento",
    "DATA_CEN": "Elétrica / TI",
    "SEG_TRA": "Segurança",
    "MEIO_AMB": "Ambiental",
    "GEST_RES": "Ambiental / Resíduos",
    "SAUDE_OC": "Saúde",
    "SERV_AMB": "Ambiental",
    "UTIL_FAC": "Facilities",
    "LOCA_EQU": "Locação",
}


# Categorias preliminares de insumos por serviço
MAPA_INSUMOS = {
    "CONS_ENG": [("SERVICO", "Consultoria/Projeto", "compra")],
    "TOPO_GEO": [("EQUIPAMENTO", "Equipamentos de topografia", "compra"), ("CONSUMIVEL", "Marcadores e cones", "compra")],
    "SOND_GEO": [("MAQUINA", "Perfuratrizes/sondas", "locacao"), ("CONSUMIVEL", "Tubos de amostragem", "compra")],
    "DEMO_TER": [("MAQUINA", "Escavadeiras/bulldozers", "locacao"), ("CONSUMIVEL", "Detonadores/explosivos controlados", "compra")],
    "TERRA_MOV": [("MAQUINA", "Escavadeiras/tratores/pá carregadeira", "locacao"), ("MATERIAL", "Terra/aterro/compactação", "compra")],
    "FUND_EST": [("MATERIAL", "Concreto/aco/formas", "compra"), ("MAQUINA", "Bate-estacas/trincheiras", "locacao")],
    "ESTRU_CON": [("MATERIAL", "Concreto/aco/formas", "compra")],
    "ESTRU_MET": [("MATERIAL", "Aço estrutural/chapas/perfilados", "compra"), ("EQUIPAMENTO", "Soldadoras/ferramentas de corte", "locacao")],
    "OBRAS_ART": [("MATERIAL", "Concreto/aco/formas", "compra"), ("EQUIPAMENTO", "Formas e escoramentos", "locacao")],
    "PAVIM_VIA": [("MATERIAL", "Asfalto/concreto/brita", "compra"), ("MAQUINA", "Usinas/Pavimentadoras/rolos", "locacao")],
    "IMPER_COB": [("MATERIAL", "Impermeabilizantes/mantas", "compra")],
    "ACAB_REV": [("MATERIAL", "Revestimentos/pintura/gesso", "compra"), ("CONSUMIVEL", "Lixas/tintas/massas", "compra")],
    "INST_ELE": [("MATERIAL", "Cabos/condutores/quadros/disjuntores", "compra"), ("EQUIPAMENTO", "Transformadores/chaves", "compra")],
    "INST_HID": [("MATERIAL", "Tubos/conexões/válvulas/bombas", "compra"), ("EQUIPAMENTO", "Bombas hidráulicas", "compra")],
    "HVAC_CLI": [("EQUIPAMENTO", "Unidades de ar-condicionado/ventilação", "compra"), ("MATERIAL", "Dutos/isolantes", "compra")],
    "SUBE_ALT": [("EQUIPAMENTO", "Transformadores/chaves/cabines", "compra"), ("MATERIAL", "Cabos de alta tensão", "compra")],
    "INST_AUT": [("EQUIPAMENTO", "CLPs/sensores/controladores", "compra"), ("CONSUMIVEL", "Cabos de controle", "compra")],
    "TELE_TI": [("MATERIAL", "Cabos de fibra/conectores", "compra"), ("EQUIPAMENTO", "Racks/switches/CCTV", "compra")],
    "UTIL_IND": [("EQUIPAMENTO", "Compressores/geradores", "compra"), ("MATERIAL", "Tubulações/isolantes", "compra")],
    "MONT_IND": [("EQUIPAMENTO", "Equipamentos de montagem/skids", "compra"), ("LOCACAO", "Guindastes/gruas", "locacao")],
    "CALD_SOL": [("MATERIAL", "Aço/chapas/tubos", "compra"), ("EQUIPAMENTO", "Soldadoras", "locacao")],
    "TUBU_IND": [("MATERIAL", "Tubos/conexões/válvulas", "compra"), ("EQUIPAMENTO", "Máquinas de solda", "locacao")],
    "ICAT_PES": [("LOCACAO", "Guindastes/gruas/transportadores", "locacao"), ("CONSUMIVEL", "Cintas/lingas", "compra")],
    "MANU_IND": [("CONSUMIVEL", "Peças de reposição", "compra"), ("LOCACAO", "Ferramentas", "locacao")],
    "ISOL_TER": [("MATERIAL", "Isolantes térmicos", "compra"), ("CONSUMIVEL", "Adesivos/fixadores", "compra")],
    "OBR_CIV": [("MATERIAL", "Concreto/blocos/aco", "compra"), ("LOCACAO", "Andaimes/formas", "locacao")],
    "AR_COND": [("EQUIPAMENTO", "Ar condicionado/ventilação", "compra"), ("MATERIAL", "Dutos/isolantes", "compra")],
    "MINE_DRE": [("MATERIAL", "Tubos/bombas/geomembranas", "compra"), ("EQUIPAMENTO", "Bombas/drenos", "compra")],
    "MINE_EXT": [("MAQUINA", "Britadores/esteiras/carretas", "locacao"), ("CONSUMIVEL", "Mídias de desgaste", "compra")],
    "SERR_MET": [("MATERIAL", "Perfis metálicos/esquadrias", "compra"), ("EQUIPAMENTO", "Serradoras", "locacao")],
    "BRIT_BEN": [("MAQUINA", "Britadores/peneiras/moinhos", "locacao"), ("CONSUMIVEL", "Mídias/mantas", "compra")],
    "DES_TEC": [("SERVICO", "Desenho/perícia", "compra"), ("CONSUMIVEL", "Papel/plotagem", "compra")],
    "EMPI_FIL": [("EQUIPAMENTO", "Filtros/empilhadeiras", "compra"), ("LOCACAO", "Carregadeiras/empilhadeiras", "locacao")],
    "DESC_BAR": [("SERVICO", "Geotecnia/regularização", "compra"), ("MAQUINA", "Escavadeiras/retroescavadeira", "locacao")],
    "PERF_DET": [("MAQUINA", "Perfuratrizes", "locacao"), ("MATERIAL", "Explosivos/detonadores", "compra")],
    "TRAN_MIN": [("LOCACAO", "Caminhões fora-de-estrada/correias", "locacao"), ("CONSUMIVEL", "Pneus/correias", "compra")],
    "MONT_ELM": [("EQUIPAMENTO", "Geradores/turbinas/transformadores", "compra"), ("MATERIAL", "Cabos/conectores", "compra")],
    "LINH_TRA": [("MATERIAL", "Cabos de transmissão/isoladores", "compra"), ("EQUIPAMENTO", "Torres/montantes", "compra")],
    "ENER_SOL": [("EQUIPAMENTO", "Módulos fotovoltaicos/inversores", "compra"), ("MATERIAL", "Estruturas de fixação/cabos", "compra")],
    "ENER_EOL": [("EQUIPAMENTO", "Pás/torres/naceles", "compra"), ("MATERIAL", "Cabos/fundações", "compra")],
    "BIOM_GER": [("EQUIPAMENTO", "Caldeiras/turbinas", "compra"), ("MATERIAL", "Aço/tubulação", "compra")],
    "BIOG_MET": [("EQUIPAMENTO", "Biodigestores/recompressores", "compra"), ("MATERIAL", "Tubulação/válvulas", "compra")],
    "OFFS_ENG": [("EQUIPAMENTO", "Equipamentos offshore/subsea", "compra"), ("LOCACAO", "Plataformas/embarcações", "locacao")],
    "DUTO_GAS": [("MATERIAL", "Tubos de aço/cotovelos/válvulas", "compra"), ("MAQUINA", "Dobradeiras/Guindastes", "locacao")],
    "PROC_OGS": [("EQUIPAMENTO", "Separadores/compressores/bombas", "compra"), ("MATERIAL", "Tubulação/válvulas/instrumentação", "compra")],
    "PETR_OGE": [("EQUIPAMENTO", "Bombas/separadores/tubulação", "compra"), ("LOCACAO", "Plataformas/embarcações", "locacao")],
    "PORT_DRA": [("MAQUINA", "Dragas/bateadores", "locacao"), ("MATERIAL", "Concreto/aco/estacas", "compra")],
    "EQUI_MOV": [("LOCACAO", "Empilhadeiras/reach-stackers", "locacao"), ("CONSUMIVEL", "Pneus/lubrificantes", "compra")],
    "ARMA_SIL": [("MATERIAL", "Aço estrutural/telhas/cimentos", "compra"), ("EQUIPAMENTO", "Transportadores/elevadores", "compra")],
    "FERR_VIA": [("MATERIAL", "Trilhos/dormentes/lastro", "compra"), ("MAQUINA", "Equipamentos de via permanente", "locacao")],
    "TERM_POR": [("MATERIAL", "Concreto/asfalto/steel-fiber", "compra"), ("LOCACAO", "Compactadores/rolos", "locacao")],
    "FRIG_CAM": [("EQUIPAMENTO", "Câmaras frigoríficas/unidades condensadoras", "compra"), ("MATERIAL", "Painéis/isolantes", "compra")],
    "ABAT_EQU": [("EQUIPAMENTO", "Equipamentos de abate", "compra"), ("LOCACAO", "Ferramentas/utensílios", "locacao")],
    "PROC_ALI": [("EQUIPAMENTO", "Linhas de processamento/embalagem", "compra"), ("CONSUMIVEL", "Embalagens", "compra")],
    "TRAT_EFL": [("EQUIPAMENTO", "Bombas/filtros/reatores", "compra"), ("MATERIAL", "Tubulação/válvulas", "compra")],
    "REFR_IND": [("EQUIPAMENTO", "Compressores/trocadores", "compra"), ("MATERIAL", "Tubulação/isolantes", "compra")],
    "USINA_EPC": [("EQUIPAMENTO", "Moendas/evaporadores/destilaria", "compra"), ("MATERIAL", "Aço inox/tubulação", "compra")],
    "ETAN_BIO": [("EQUIPAMENTO", "Fermentadores/destiladores", "compra"), ("MATERIAL", "Aço inox/válvulas", "compra")],
    "MECA_AGR": [("MAQUINA", "Tratores/colhedoras/implementos", "compra"), ("LOCACAO", "Máquinas agrícolas", "locacao")],
    "AUTO_LIN": [("EQUIPAMENTO", "Robôs/esteiras/ferramentas", "compra"), ("CONSUMIVEL", "Solda/pintura", "compra")],
    "AUTO_MAN": [("EQUIPAMENTO", "CLPs/robôs/sensores", "compra"), ("CONSUMIVEL", "Cabos/componentes eletrônicos", "compra")],
    "ROD_AER": [("MATERIAL", "Asfalto/concreto/sinalização", "compra"), ("MAQUINA", "Pavimentadoras/rolos", "locacao")],
    "SANE_AGU": [("MATERIAL", "Tubos/conexões/bombas", "compra"), ("EQUIPAMENTO", "Bombas/estação de tratamento", "compra")],
    "DATA_CEN": [("EQUIPAMENTO", "Racks/UPS/switches", "compra"), ("MATERIAL", "Cabos/conectores", "compra")],
    "SEG_TRA": [("CONSUMIVEL", "EPIs/equipamentos de segurança", "compra")],
    "MEIO_AMB": [("SERVICO", "Licenciamento/consultoria ambiental", "compra"), ("CONSUMIVEL", "Coletas/amostragem", "compra")],
    "GEST_RES": [("EQUIPAMENTO", "Máquinas de processamento de resíduos", "compra"), ("MAQUINA", "Compactadores", "locacao")],
    "SAUDE_OC": [("SERVICO", "Medicina do trabalho", "compra"), ("CONSUMIVEL", "Materiais de exame", "compra")],
    "SERV_AMB": [("SERVICO", "Remediação/monitoramento", "compra"), ("CONSUMIVEL", "Reagentes/amostras", "compra")],
    "UTIL_FAC": [("SERVICO", "Facilities/limpeza/alimentação", "compra")],
    "LOCA_EQU": [("LOCACAO", "Equipamentos/andaimes/formas", "locacao")],
}


def classificar_cnae(codigo: str, descricao: str) -> str:
    """Classifica o papel do CNAE no ecossistema de obras."""
    codigo = (codigo or "").strip()
    desc_norm = _normalize(descricao)
    texto = f"{codigo} {desc_norm}"

    # 1. Verifica palavras de serviço técnico antes de classificar como operador
    for papel, palavras in PALAVRAS_PAPEL:
        for p in palavras:
            if p in desc_norm or p in texto:
                return papel

    # 2. Operadores / proprietários / contratantes
    if any(p in desc_norm for p in PALAVRAS_OPERADOR):
        return "OPERADOR_CONCESSIONARIO"

    if codigo.startswith("35") or codigo.startswith("36"):
        return "OPERADOR_CONCESSIONARIO"
    if codigo.startswith("84"):
        return "ORGAO_CONTRATANTE"
    if codigo.startswith("773"):
        return "LOCADOR_DE_MAQUINAS_E_EQUIPAMENTOS"

    if desc_norm and ("construção" in desc_norm or "construcao" in desc_norm):
        return "CONSTRUTORA"
    if desc_norm and ("serviço" in desc_norm or "servico" in desc_norm):
        return "ATIVIDADE_AUXILIAR"
    return "NAO_CLASSIFICADO"


def classificar_score(score):
    if score is None:
        return "NAO_CLASSIFICADO"
    if score >= 80:
        return "PROVAVEL"
    if score >= 60:
        return "POTENCIAL"
    return "NAO_CLASSIFICADO"


def status_tipologia(setor: str, nome: str, descricao: str, regra: str, confianca: str) -> str:
    if confianca == "ALTA":
        return "VALIDADA"
    if confianca in ("MÉDIA", "MEDIA"):
        return "PROVÁVEL"
    if setor or nome or descricao:
        return "AMBIGUA"
    return "NÃO_CLASSIFICADA"


def candidate_typology(setor: str, nome: str, descricao: str) -> dict:
    s = _normalize(setor or "")
    n = _normalize(nome or "")
    d = _normalize(descricao or "")
    texto = f"{s} {n} {d}"

    regras = [
        ("usina", "ENERGIA", "Geração"),
        ("subestação", "ENERGIA", "Subestação/Transmissão"),
        ("linha de transmissão", "ENERGIA", "Transmissão"),
        ("rede elétrica", "ENERGIA", "Distribuição"),
        ("solar", "ENERGIA", "Solar"),
        ("eólica", "ENERGIA", "Eólica"),
        ("rodovia", "INFRAESTRUTURA", "Rodovia"),
        ("ponte", "INFRAESTRUTURA", "Ponte/Viaduto"),
        ("viaduto", "INFRAESTRUTURA", "Ponte/Viaduto"),
        ("ferrovia", "LOGISTICO", "Ferrovia"),
        ("terminal", "LOGISTICO", "Terminal Portuário/Intermodal"),
        ("porto", "PORTUARIO", "Porto"),
        ("estação de tratamento", "SANEAMENTO", "ETE/ETA"),
        ("rede de água", "SANEAMENTO", "Rede de água"),
        ("rede de esgoto", "SANEAMENTO", "Rede de esgoto"),
        ("hospital", "SAUDE", "Hospital"),
        ("unidade básica", "SAUDE", "UBS"),
        ("escola", "EDUCACIONAL", "Educação"),
        ("universidade", "EDUCACIONAL", "Educação"),
        ("galpão", "INDUSTRIAL", "Galpão Industrial"),
        ("fábrica", "INDUSTRIAL", "Fábrica/Planta"),
        ("mineroduto", "MINERACAO", "Mineroduto"),
        ("mineração", "MINERACAO", "Mineração"),
        ("britagem", "MINERACAO", "Britagem"),
        ("data center", "TECNOLOGIA", "Data Center"),
        ("reforma", "OUTRO", "Reforma"),
        ("ampliação", "OUTRO", "Ampliação"),
    ]

    for palavra, tipo, sub in regras:
        if palavra in texto:
            confianca = "ALTA" if palavra in n else "MÉDIA"
            return {
                "tipologia_candidata": tipo,
                "subtipo_candidato": sub,
                "confianca": confianca,
                "regra": f"palavra-chave: {palavra}",
                "motivo": "identificado por palavra-chave no nome ou descrição",
                "status": status_tipologia(setor, nome, descricao, "palavra-chave", confianca),
            }

    return {
        "tipologia_candidata": (setor or "NÃO_CLASSIFICADA").upper(),
        "subtipo_candidato": (setor or "NÃO_CLASSIFICADO").upper(),
        "confianca": "BAIXA",
        "regra": "setor",
        "motivo": "tipologia derivada apenas do setor",
        "status": "NÃO_CLASSIFICADA",
    }


def dict_rows(cur):
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def export_csv(path, fieldnames, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row.get(k) for k in fieldnames})


def main():
    os.makedirs(TARGET_DIR, exist_ok=True)
    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # 1. Contagens corrigidas por universo (arquivos obrigatórios)
        for universo, cond in [
            ("obras_fisicas", "1=1"),
            ("obras_visiveis", "status_portao='APROVADA' AND visivel=true AND motivo_invisivel IS NULL"),
        ]:
            out_path = f"{TARGET_DIR}/{universo}_por_setor_fase_status.csv"
            copy_sql = f"""
                COPY (
                    SELECT setor,
                           COALESCE(fase, 'N/A') as fase,
                           COALESCE(status, 'N/A') as status_obra,
                           count(distinct id) as obras_distintas,
                           count(distinct municipio) as municipios_distintos,
                           count(distinct uf) as ufs_distintas,
                           sum(valor_estimado) as valor_total,
                           avg(valor_estimado) as valor_medio
                    FROM engenharia.obras
                    WHERE {cond}
                    GROUP BY setor, fase, status
                    ORDER BY obras_distintas DESC
                ) TO STDOUT WITH CSV HEADER;
            """
            with open(out_path, "w", encoding="utf-8") as f_out:
                cur.copy_expert(copy_sql, f_out)
            print(f"Gerado: {out_path}")

        # 2. Tipologias candidatas (visível)
        cur.execute("""
            SELECT id, setor, nome, descricao, fase, status, fonte, municipio, uf, valor_estimado
            FROM engenharia.obras
            WHERE status_portao='APROVADA' AND visivel=true AND motivo_invisivel IS NULL
            ORDER BY id;
        """)
        obras = dict_rows(cur)
        tipologias = []
        for o in obras:
            cand = candidate_typology(o["setor"], o["nome"], o["descricao"])
            row = {
                "id": o["id"],
                "setor": o["setor"],
                "tipologia_candidata": cand["tipologia_candidata"],
                "subtipo_candidato": cand["subtipo_candidato"],
                "status_tipologia": cand["status"],
                "confianca": cand["confianca"],
                "regra": cand["regra"],
                "motivo": cand["motivo"],
                "nome": o["nome"],
                "descricao": o["descricao"],
                "fase": o["fase"],
                "status_obra": o["status"],
                "fonte": o["fonte"],
                "municipio": o["municipio"],
                "uf": o["uf"],
                "valor_estimado": o["valor_estimado"],
            }
            tipologias.append(row)
        export_csv(
            f"{TARGET_DIR}/tipologias_candidatas.csv",
            [
                "id", "setor", "tipologia_candidata", "subtipo_candidato", "status_tipologia", "confianca",
                "regra", "motivo", "nome", "descricao", "fase", "status_obra", "fonte", "municipio", "uf", "valor_estimado"
            ],
            tipologias,
        )

        # 3. CNAEs observados em empresas presentes em matches_v2
        cur.execute("""
            SELECT f.cnae_principal,
                   max(coalesce(co.descricao, f.cnae_descricao, '')) as descricao,
                   count(distinct f.cnpj) as empresas_unicas,
                   count(distinct m.obra_id) as obras_relacionadas,
                   count(*) as matches_total,
                   count(*) FILTER (WHERE m.score >= 80) as matches_provaveis,
                   count(*) FILTER (WHERE m.score >= 60 AND m.score < 80) as matches_potenciais,
                   count(*) FILTER (WHERE m.score < 60 OR m.score IS NULL) as matches_nao_classificados
            FROM engenharia.matches_v2 m
            JOIN engenharia.fornecedores f ON f.cnpj = m.cnpj
            LEFT JOIN engenharia.cnae_oficial co ON co.codigo = f.cnae_principal
            WHERE f.situacao_cadastral = '02'
            GROUP BY f.cnae_principal
            ORDER BY empresas_unicas DESC;
        """)
        cnaes = dict_rows(cur)
        cnae_class = {}
        for c in cnaes:
            papel = classificar_cnae(c["cnae_principal"], c["descricao"])
            c["papel"] = papel
            c["status_validacao"] = "VALIDADO" if c["descricao"] else "DESCRICAO_AUSENTE"
            cnae_class[c["cnae_principal"]] = papel

        export_csv(
            f"{TARGET_DIR}/cnaes_empresas_matches.csv",
            [
                "cnae_principal", "descricao", "papel", "status_validacao", "empresas_unicas",
                "obras_relacionadas", "matches_total", "matches_provaveis", "matches_potenciais",
                "matches_nao_classificados"
            ],
            cnaes,
        )
        export_csv(
            f"{TARGET_DIR}/cnaes_classificados_por_papel.csv",
            [
                "cnae_principal", "descricao", "papel", "status_validacao", "empresas_unicas",
                "obras_relacionadas", "matches_total"
            ],
            cnaes,
        )

        # 4. Revisão da matriz setor_cnae_compatibility
        cur.execute("""
            SELECT sc.setor_obra, sc.cnae_codigo, co.descricao,
                   sc.peso, sc.fases_aplicaveis::text as fases_aplicaveis, sc.fonte
            FROM engenharia.setor_cnae_compatibility sc
            LEFT JOIN engenharia.cnae_oficial co ON co.codigo = sc.cnae_codigo
            ORDER BY sc.setor_obra, sc.cnae_codigo;
        """)
        matriz = dict_rows(cur)
        for row in matriz:
            papel = classificar_cnae(row["cnae_codigo"], row["descricao"] or "")
            row["papel_inferido"] = papel
            if papel in ("OPERADOR_CONCESSIONARIO", "ORGAO_CONTRATANTE", "PROPRIETARIO_INFRAESTRUTURA"):
                row["flag"] = "POSSIVEL_OPERADOR/PROPRIETARIO"
            elif papel == "NAO_CLASSIFICADO":
                row["flag"] = "PAPEL_AMBÍGUO"
            else:
                row["flag"] = "OK"
        export_csv(
            f"{TARGET_DIR}/setor_cnae_compatibility_revisao.csv",
            ["setor_obra", "cnae_codigo", "descricao", "peso", "fases_aplicaveis", "fonte", "papel_inferido", "flag"],
            matriz,
        )

        # 5. Tabela de mapeamento cnae -> categoria de serviço (evita join com arrays)
        cur.execute("SELECT codigo, nome, cnaes FROM engenharia.categorias_servico WHERE ativo=true ORDER BY ordem;")
        service_rows = dict_rows(cur)
        service_cnae = []  # list of (cnae, service_code, service_name)
        for row in service_rows:
            for cnae in row["cnaes"]:
                service_cnae.append({"cnae_codigo": str(cnae), "service_code": row["codigo"], "service_name": row["nome"]})

        cur.execute("DROP TABLE IF EXISTS _audit_service_cnae;")
        cur.execute("""
            CREATE TEMP TABLE _audit_service_cnae (
                cnae_codigo TEXT PRIMARY KEY,
                service_code TEXT,
                service_name TEXT
            ) ON COMMIT PRESERVE ROWS;
        """)
        for s in service_cnae:
            cur.execute("INSERT INTO _audit_service_cnae VALUES (%s, %s, %s) ON CONFLICT DO NOTHING;",
                        (s["cnae_codigo"], s["service_code"], s["service_name"]))

        # 6. Tabela versionada de cobertura (deve ser criada previamente com privilégios adequados)
        cur.execute("TRUNCATE engineering_service_provider_coverage;")

        cur.execute("""
            SELECT DISTINCT o.setor
            FROM engenharia.obras o
            WHERE o.status_portao='APROVADA' AND o.visivel=true AND o.motivo_invisivel IS NULL
              AND EXISTS (SELECT 1 FROM engenharia.matches_v2 m WHERE m.obra_id=o.id)
            ORDER BY o.setor;
        """)
        setores = [r[0] for r in cur.fetchall()]

        version = "v1.0"
        insert_sql = """
            INSERT INTO engineering_service_provider_coverage
                (sector, work_type_candidate, lifecycle_stage, discipline, service, cnae_code, cnae_role,
                 confirmed_provider_count, probable_provider_count, potential_provider_count,
                 unclassified_provider_count, obra_count, coverage_status, uf, evidence, source, rule_version)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        for setor in setores:
            print(f"Processando setor: {setor}")
            cur.execute("""
                SELECT o.setor, o.fase, dsc.service_code, dsc.service_name, f.cnae_principal,
                       count(distinct f.cnpj) FILTER (WHERE m.score >= 80) as probable,
                       count(distinct f.cnpj) FILTER (WHERE m.score >= 60 AND m.score < 80) as potential,
                       count(distinct f.cnpj) FILTER (WHERE m.score < 60 OR m.score IS NULL) as unclassified,
                       count(distinct o.id) as obra_count,
                       string_agg(distinct o.uf, ',' order by o.uf) as ufs
                FROM engenharia.obras o
                JOIN engenharia.matches_v2 m ON m.obra_id = o.id
                JOIN engenharia.fornecedores f ON f.cnpj = m.cnpj
                JOIN _audit_service_cnae dsc ON dsc.cnae_codigo = f.cnae_principal
                WHERE o.status_portao='APROVADA' AND o.visivel=true AND o.motivo_invisivel IS NULL
                  AND o.setor = %s
                GROUP BY o.setor, o.fase, dsc.service_code, dsc.service_name, f.cnae_principal
                ORDER BY o.setor, o.fase, dsc.service_code, f.cnae_principal;
            """, (setor,))

            for row in cur.fetchall():
                sector, fase, service_code, service_name, cnae, probable, potential, unclassified, obra_count, ufs = row
                role = cnae_class.get(cnae, "NAO_CLASSIFICADO")
                total_ = probable + potential
                if probable > 0:
                    status = "COBERTO_PROVAVEL"
                elif potential >= 5:
                    status = "COBERTO_POTENCIAL"
                elif potential > 0:
                    status = "COBERTURA_INSUFICIENTE"
                elif unclassified > 0:
                    status = "NÃO_AVALIADO"
                else:
                    status = "SEM_COBERTURA"
                discipline = DISCIPLINA_POR_SERVICO.get(service_code, "Geral")
                evidence = f"{total_} prestadores em {obra_count} obras visíveis do setor {sector}"
                cur.execute(insert_sql, (
                    sector, "tipologia_candidata_a_definir", fase, discipline, service_name, cnae, role,
                    0, probable, potential, unclassified, obra_count, status, ufs or "",
                    evidence, "engenharia.obras + matches_v2 + fornecedores + categorias_servico", version
                ))
            conn.commit()

        # Exporta matriz de cobertura
        cur.execute("""
            SELECT sector, work_type_candidate, lifecycle_stage, discipline, service, cnae_code, cnae_role,
                   confirmed_provider_count, probable_provider_count, potential_provider_count,
                   unclassified_provider_count, obra_count, coverage_status, uf, evidence, source, rule_version, calculated_at
            FROM engineering_service_provider_coverage
            ORDER BY sector, lifecycle_stage, service, cnae_code;
        """)
        coverage_rows = dict_rows(cur)
        export_csv(
            f"{TARGET_DIR}/cobertura_servicos_por_cnae.csv",
            [
                "sector", "work_type_candidate", "lifecycle_stage", "discipline", "service", "cnae_code", "cnae_role",
                "confirmed_provider_count", "probable_provider_count", "potential_provider_count",
                "unclassified_provider_count", "obra_count", "coverage_status", "uf", "evidence", "source", "rule_version", "calculated_at"
            ],
            coverage_rows,
        )

        # Gaps
        with open(f"{TARGET_DIR}/gaps_tecnicos_territoriais.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=[
                "sector", "lifecycle_stage", "discipline", "service", "cnae_code", "cnae_role",
                "probable_provider_count", "potential_provider_count", "obra_count", "coverage_status", "gap_type"
            ])
            writer.writeheader()
            for row in coverage_rows:
                if row["coverage_status"] in ("SEM_COBERTURA", "NÃO_AVALIADO"):
                    writer.writerow({
                        "sector": row["sector"], "lifecycle_stage": row["lifecycle_stage"], "discipline": row["discipline"],
                        "service": row["service"], "cnae_code": row["cnae_code"], "cnae_role": row["cnae_role"],
                        "probable_provider_count": row["probable_provider_count"],
                        "potential_provider_count": row["potential_provider_count"],
                        "obra_count": row["obra_count"], "coverage_status": row["coverage_status"],
                        "gap_type": "técnico/territorial"
                    })

        # 7. Categorias preliminares de insumos
        cur.execute("SELECT codigo, nome FROM engenharia.categorias_servico WHERE ativo=true ORDER BY ordem;")
        input_rows = []
        for row in cur.fetchall():
            codigo, nome = row
            insumos = MAPA_INSUMOS.get(codigo, [("NÃO_CLASSIFICADO", "", "n/a")])
            for cat, tipo, aquisicao in insumos:
                input_rows.append({
                    "service_code": codigo,
                    "service_name": nome,
                    "input_category": cat,
                    "input_type": tipo,
                    "purchase_or_rental": aquisicao,
                    "evidence": "derivado da disciplina/serviço, sem mapeamento de fornecedores",
                    "confidence": "preliminar",
                    "version": version,
                })
        export_csv(
            f"{TARGET_DIR}/categorias_preliminares_insumos.csv",
            [
                "service_code", "service_name", "input_category", "input_type",
                "purchase_or_rental", "evidence", "confidence", "version"
            ],
            input_rows,
        )

        # 8. Resumo
        cur.execute("SELECT count(distinct id) FROM engenharia.obras;")
        total_fisico = cur.fetchone()[0]
        cur.execute("SELECT count(distinct id) FROM engenharia.obras WHERE status_portao='APROVADA' AND visivel=true AND motivo_invisivel IS NULL;")
        total_visivel = cur.fetchone()[0]
        cur.execute("SELECT count(distinct cnpj) FROM engenharia.matches_v2;")
        cnpjs_matches = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM engineering_service_provider_coverage;")
        linhas_cobertura = cur.fetchone()[0]

        # Resumos de classificação
        total_cnaes = len(cnaes)
        cnaes_operador = sum(1 for c in cnaes if c["papel"] in ("OPERADOR_CONCESSIONARIO", "ORGAO_CONTRATANTE", "PROPRIETARIO_INFRAESTRUTURA"))
        total_provaveis = sum(c["matches_provaveis"] for c in cnaes)
        total_potenciais = sum(c["matches_potenciais"] for c in cnaes)
        total_nao_class = sum(c["matches_nao_classificados"] for c in cnaes)

        resumo = {
            "auditoria": "Auditoria Orientada a Insumos — Módulo Engenharia",
            "gerado_em": datetime.now(timezone.utc).isoformat(),
            "universo_fisico": total_fisico,
            "universo_visivel": total_visivel,
            "empresas_em_matches_v2": cnpjs_matches,
            "classificacao_prestadores": {
                "confirmado": 0,
                "provavel_matches": total_provaveis,
                "potencial_matches": total_potenciais,
                "nao_classificado_matches": total_nao_class,
                "provavel_regra": "score >= 80",
                "potencial_regra": "60 <= score < 80",
                "nao_classificado_regra": "score < 60 ou sem score",
            },
            "cnaes_unicos": total_cnaes,
            "cnaes_operador_proprietario_orgao": cnaes_operador,
            "linhas_matriz_cobertura": linhas_cobertura,
            "arquivos_gerados": [
                "obras_fisicas_por_setor_fase_status.csv",
                "obras_visiveis_por_setor_fase_status.csv",
                "tipologias_candidatas.csv",
                "cnaes_empresas_matches.csv",
                "cnaes_classificados_por_papel.csv",
                "setor_cnae_compatibility_revisao.csv",
                "cobertura_servicos_por_cnae.csv",
                "gaps_tecnicos_territoriais.csv",
                "categorias_preliminares_insumos.csv",
                "auditoria_metodologia.md",
                "auditoria_resumo.json",
            ],
        }
        with open(f"{TARGET_DIR}/auditoria_resumo.json", "w", encoding="utf-8") as f:
            json.dump(resumo, f, indent=2, default=str)

        metodologia = f"""# Auditoria Orientada a Insumos — Módulo Engenharia

## Objetivo
Corrigir a auditoria anterior, separando universos e classificando CNAEs antes de derivar insumos.

## Universos
- **Físico**: obras distintas na tabela `engenharia.obras`.
- **Visível estrito**: `status_portao = 'APROVADA' AND motivo_invisivel IS NULL AND visivel = true`.

Contagens foram feitas com `COUNT(DISTINCT id)` para evitar duplicação.

## Classificação de prestadores
- **CONFIRMADO**: reservado a vínculos documentais (contrato, licitação, documento oficial). Nenhum match foi marcado como confirmado, pois não há tabela de evidência documental.
- **PROVÁVEL**: `score >= 80` em `matches_v2`.
- **POTENCIAL**: `60 <= score < 80`.
- **NÃO_CLASSIFICADO**: `score < 60` ou ausente.

## Classificação de CNAE por papel
Regras baseadas no código e na descrição oficial. CNAEs de geração, transmissão, distribuição, saneamento, abastecimento e administração pública são classificados como operadores/proprietários, salvo quando a descrição indicar execução, instalação ou manutenção.

## Matriz de cobertura
Processamento por setor em lotes, inserindo na tabela `engineering_service_provider_coverage`. A unidade de análise é setor → fase → disciplina → serviço → CNAE. Prestadores únicos são contados por faixa de score e obras atendidas.

## Insumos
Categorias preliminares de insumos foram derivadas apenas das disciplinas/serviços, sem mapear empresas fornecedoras. Cada serviço pode gerar demanda por material, equipamento, máquina, locação ou consumível.

## Resultados (resumido)
- Obras físicas: {total_fisico}
- Obras visíveis: {total_visivel}
- Empresas em matches_v2: {cnpjs_matches}
- Linhas na matriz de cobertura: {linhas_cobertura}

## Próxima etapa
Validar a matriz de cobertura com especialistas técnicos, normalizar a tipologia das obras e, somente então, construir a base real de fornecedores de insumos.
"""
        with open(f"{TARGET_DIR}/auditoria_metodologia.md", "w", encoding="utf-8") as f:
            f.write(metodologia)

        conn.commit()
        print(f"Auditoria concluída. Arquivos salvos em {TARGET_DIR}/")
    except Exception as e:
        conn.rollback()
        print(f"Erro durante a auditoria: {e}")
        traceback.print_exc()
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
