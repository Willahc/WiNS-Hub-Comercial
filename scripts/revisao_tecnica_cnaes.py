#!/usr/bin/env python3
"""
Revisão Técnica Final dos CNAEs dos Prestadores — Módulo Engenharia

Gera arquivos em docs/audits/engineering-inputs/ sem modificar o frontend,
sem criar fornecedores de insumos e sem alterar a ingestão das obras.

Apenas audita os 76 CNAEs, revisa a classificação PROVÁVEL/POTENCIAL,
cruza com as 57 categorias de serviço e as tipologias candidatas,
revisa a matriz de cobertura e deriva categorias de insumos somente para
serviços aprovados.

Versão v2.2: evita OOM com agregação única leve (sem LATERAL) e cursores
server-side para streaming.
"""
import csv
import json
import os
import re
import shutil
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone

import psycopg2

TARGET_DIR = os.environ.get("TARGET_DIR", "docs/audits/engineering-inputs")
DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "db"),
    "database": os.environ.get("DB_NAME", "wins_agro"),
    "user": os.environ.get("DB_USER", "wins_hub_api_ro"),
    "password": os.environ.get("DB_PASS", ""),
}

VERSION = "v2.2"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _normalize(text: str) -> str:
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text).lower()
    return re.sub(r"[^a-z0-9\s]", " ", text)


def dict_rows(cur):
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def export_csv(path, fieldnames, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row.get(k) for k in fieldnames})


def get_disk_info():
    try:
        total, used, free = shutil.disk_usage("/")
        return {
            "total_gb": round(total / (1024 ** 3), 2),
            "used_gb": round(used / (1024 ** 3), 2),
            "free_gb": round(free / (1024 ** 3), 2),
            "used_pct": round(used / total * 100, 2),
            "alerta": used / total >= 0.85 or free / (1024 ** 3) < 15,
        }
    except Exception:
        return {}


# ---------------------------------------------------------------------------
# Mapeamento de disciplinas e insumos por serviço
# ---------------------------------------------------------------------------

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

SERVICE_TO_ROLE = {
    "CONS_ENG": "PROJETISTA_CONSULTORIA",
    "TOPO_GEO": "PROJETISTA_CONSULTORIA",
    "SOND_GEO": "PROJETISTA_CONSULTORIA",
    "DES_TEC": "PROJETISTA_CONSULTORIA",
    "MEIO_AMB": "PROJETISTA_CONSULTORIA",
    "INST_ELE": "INSTALADOR",
    "INST_HID": "INSTALADOR",
    "HVAC_CLI": "INSTALADOR",
    "SUBE_ALT": "INSTALADOR",
    "INST_AUT": "INSTALADOR",
    "TELE_TI": "INSTALADOR",
    "LINH_TRA": "INSTALADOR",
    "MONT_ELM": "INSTALADOR",
    "AR_COND": "INSTALADOR",
    "SANE_AGU": "INSTALADOR",
    "DATA_CEN": "INSTALADOR",
    "MANU_IND": "MANUTENÇÃO",
    "SEG_TRA": "MANUTENÇÃO",
    "SAUDE_OC": "MANUTENÇÃO",
    "SERV_AMB": "MANUTENÇÃO",
    "UTIL_FAC": "ATIVIDADE_AUXILIAR",
    "GEST_RES": "ATIVIDADE_AUXILIAR",
    "LOCA_EQU": "LOCAÇÃO_DE_EQUIPAMENTOS",
    "EQUI_MOV": "LOCAÇÃO_DE_EQUIPAMENTOS",
    "OBR_CIV": "CONSTRUTORA",
    "DEMO_TER": "PRESTADOR_EXECUÇÃO",
    "TERRA_MOV": "PRESTADOR_EXECUÇÃO",
    "FUND_EST": "PRESTADOR_EXECUÇÃO",
    "ESTRU_CON": "PRESTADOR_EXECUÇÃO",
    "ESTRU_MET": "PRESTADOR_EXECUÇÃO",
    "OBRAS_ART": "PRESTADOR_EXECUÇÃO",
    "PAVIM_VIA": "PRESTADOR_EXECUÇÃO",
    "IMPER_COB": "PRESTADOR_EXECUÇÃO",
    "ACAB_REV": "PRESTADOR_EXECUÇÃO",
    "SERR_MET": "PRESTADOR_EXECUÇÃO",
    "DESC_BAR": "PRESTADOR_EXECUÇÃO",
    "PORT_DRA": "PRESTADOR_EXECUÇÃO",
    "FERR_VIA": "PRESTADOR_EXECUÇÃO",
    "TERM_POR": "PRESTADOR_EXECUÇÃO",
    "OFFS_ENG": "PRESTADOR_EXECUÇÃO",
    "ROD_AER": "PRESTADOR_EXECUÇÃO",
    "MONT_IND": "PRESTADOR_EXECUÇÃO",
    "CALD_SOL": "PRESTADOR_EXECUÇÃO",
    "TUBU_IND": "PRESTADOR_EXECUÇÃO",
    "ICAT_PES": "PRESTADOR_EXECUÇÃO",
    "ISOL_TER": "PRESTADOR_EXECUÇÃO",
    "MINE_DRE": "PRESTADOR_EXECUÇÃO",
    "MINE_EXT": "PRESTADOR_EXECUÇÃO",
    "BRIT_BEN": "PRESTADOR_EXECUÇÃO",
    "PERF_DET": "PRESTADOR_EXECUÇÃO",
    "TRAN_MIN": "PRESTADOR_EXECUÇÃO",
    "ARMA_SIL": "PRESTADOR_EXECUÇÃO",
    "EMPI_FIL": "PRESTADOR_EXECUÇÃO",
    "PROC_ALI": "PRESTADOR_EXECUÇÃO",
    "TRAT_EFL": "PRESTADOR_EXECUÇÃO",
    "REFR_IND": "PRESTADOR_EXECUÇÃO",
    "USINA_EPC": "PRESTADOR_EXECUÇÃO",
    "ETAN_BIO": "PRESTADOR_EXECUÇÃO",
    "MECA_AGR": "PRESTADOR_EXECUÇÃO",
    "AUTO_LIN": "PRESTADOR_EXECUÇÃO",
    "AUTO_MAN": "PRESTADOR_EXECUÇÃO",
    "PROC_OGS": "PRESTADOR_EXECUÇÃO",
    "PETR_OGE": "PRESTADOR_EXECUÇÃO",
    "DUTO_GAS": "PRESTADOR_EXECUÇÃO",
    "BIOG_MET": "PRESTADOR_EXECUÇÃO",
    "BIOM_GER": "PRESTADOR_EXECUÇÃO",
    "ENER_SOL": "PRESTADOR_EXECUÇÃO",
    "ENER_EOL": "PRESTADOR_EXECUÇÃO",
    "FRIG_CAM": "PRESTADOR_EXECUÇÃO",
    "ABAT_EQU": "PRESTADOR_EXECUÇÃO",
    "UTIL_IND": "PRESTADOR_EXECUÇÃO",
}

MAPA_INSUMOS = {
    "CONS_ENG": [("SERVICO", "Consultoria/Projeto", "compra", "Obrigatória quando contratada")],
    "TOPO_GEO": [("EQUIPAMENTO", "Equipamentos de topografia", "compra", "Opcional"), ("CONSUMIVEL", "Marcadores e cones", "compra", "Opcional")],
    "SOND_GEO": [("MAQUINA", "Perfuratrizes/sondas", "locacao", "Obrigatória"), ("CONSUMIVEL", "Tubos de amostragem", "compra", "Obrigatória")],
    "DEMO_TER": [("MAQUINA", "Escavadeiras/bulldozers", "locacao", "Obrigatória"), ("CONSUMIVEL", "Detonadores/explosivos controlados", "compra", "Conforme necessidade")],
    "TERRA_MOV": [("MAQUINA", "Escavadeiras/tratores/pá carregadeira", "locacao", "Obrigatória"), ("MATERIAL", "Terra/aterro/compactação", "compra", "Obrigatória")],
    "FUND_EST": [("MATERIAL", "Concreto/aco/formas", "compra", "Obrigatória"), ("MAQUINA", "Bate-estacas/trincheiras", "locacao", "Conforme necessidade")],
    "ESTRU_CON": [("MATERIAL", "Concreto/aco/formas", "compra", "Obrigatória")],
    "ESTRU_MET": [("MATERIAL", "Aço estrutural/chapas/perfilados", "compra", "Obrigatória"), ("EQUIPAMENTO", "Soldadoras/ferramentas de corte", "locacao", "Conforme necessidade")],
    "OBRAS_ART": [("MATERIAL", "Concreto/aco/formas", "compra", "Obrigatória"), ("EQUIPAMENTO", "Formas e escoramentos", "locacao", "Conforme necessidade")],
    "PAVIM_VIA": [("MATERIAL", "Asfalto/concreto/brita", "compra", "Obrigatória"), ("MAQUINA", "Usinas/Pavimentadoras/rolos", "locacao", "Obrigatória")],
    "IMPER_COB": [("MATERIAL", "Impermeabilizantes/mantas", "compra", "Obrigatória")],
    "ACAB_REV": [("MATERIAL", "Revestimentos/pintura/gesso", "compra", "Obrigatória"), ("CONSUMIVEL", "Lixas/tintas/massas", "compra", "Obrigatória")],
    "INST_ELE": [("MATERIAL", "Cabos/condutores/quadros/disjuntores", "compra", "Obrigatória"), ("EQUIPAMENTO", "Transformadores/chaves", "compra", "Conforme necessidade")],
    "INST_HID": [("MATERIAL", "Tubos/conexões/válvulas/bombas", "compra", "Obrigatória"), ("EQUIPAMENTO", "Bombas hidráulicas", "compra", "Conforme necessidade")],
    "HVAC_CLI": [("EQUIPAMENTO", "Unidades de ar-condicionado/ventilação", "compra", "Obrigatória"), ("MATERIAL", "Dutos/isolantes", "compra", "Obrigatória")],
    "SUBE_ALT": [("EQUIPAMENTO", "Transformadores/chaves/cabines", "compra", "Obrigatória"), ("MATERIAL", "Cabos de alta tensão", "compra", "Obrigatória")],
    "INST_AUT": [("EQUIPAMENTO", "CLPs/sensores/controladores", "compra", "Obrigatória"), ("CONSUMIVEL", "Cabos de controle", "compra", "Obrigatória")],
    "TELE_TI": [("MATERIAL", "Cabos de fibra/conectores", "compra", "Obrigatória"), ("EQUIPAMENTO", "Racks/switches/CCTV", "compra", "Conforme necessidade")],
    "UTIL_IND": [("EQUIPAMENTO", "Compressores/geradores", "compra", "Obrigatória"), ("MATERIAL", "Tubulações/isolantes", "compra", "Obrigatória")],
    "MONT_IND": [("EQUIPAMENTO", "Equipamentos de montagem/skids", "compra", "Obrigatória"), ("LOCACAO", "Guindastes/gruas", "locacao", "Conforme necessidade")],
    "CALD_SOL": [("MATERIAL", "Aço/chapas/tubos", "compra", "Obrigatória"), ("EQUIPAMENTO", "Soldadoras", "locacao", "Conforme necessidade")],
    "TUBU_IND": [("MATERIAL", "Tubos/conexões/válvulas", "compra", "Obrigatória"), ("EQUIPAMENTO", "Máquinas de solda", "locacao", "Conforme necessidade")],
    "ICAT_PES": [("LOCACAO", "Guindastes/gruas/transportadores", "locacao", "Obrigatória"), ("CONSUMIVEL", "Cintas/lingas", "compra", "Obrigatória")],
    "MANU_IND": [("CONSUMIVEL", "Peças de reposição", "compra", "Obrigatória"), ("LOCACAO", "Ferramentas", "locacao", "Conforme necessidade")],
    "ISOL_TER": [("MATERIAL", "Isolantes térmicos", "compra", "Obrigatória"), ("CONSUMIVEL", "Adesivos/fixadores", "compra", "Obrigatória")],
    "OBR_CIV": [("MATERIAL", "Concreto/blocos/aco", "compra", "Obrigatória"), ("LOCACAO", "Andaimes/formas", "locacao", "Obrigatória")],
    "AR_COND": [("EQUIPAMENTO", "Ar condicionado/ventilação", "compra", "Obrigatória"), ("MATERIAL", "Dutos/isolantes", "compra", "Obrigatória")],
    "MINE_DRE": [("MATERIAL", "Tubos/bombas/geomembranas", "compra", "Obrigatória"), ("EQUIPAMENTO", "Bombas/drenos", "compra", "Conforme necessidade")],
    "MINE_EXT": [("MAQUINA", "Britadores/esteiras/carretas", "locacao", "Obrigatória"), ("CONSUMIVEL", "Mídias de desgaste", "compra", "Obrigatória")],
    "SERR_MET": [("MATERIAL", "Perfis metálicos/esquadrias", "compra", "Obrigatória"), ("EQUIPAMENTO", "Serradoras", "locacao", "Conforme necessidade")],
    "BRIT_BEN": [("MAQUINA", "Britadores/peneiras/moinhos", "locacao", "Obrigatória"), ("CONSUMIVEL", "Mídias/mantas", "compra", "Obrigatória")],
    "DES_TEC": [("SERVICO", "Desenho/perícia", "compra", "Obrigatória"), ("CONSUMIVEL", "Papel/plotagem", "compra", "Obrigatória")],
    "EMPI_FIL": [("EQUIPAMENTO", "Filtros/empilhadeiras", "compra", "Obrigatória"), ("LOCACAO", "Carregadeiras/empilhadeiras", "locacao", "Conforme necessidade")],
    "DESC_BAR": [("SERVICO", "Geotecnia/regularização", "compra", "Obrigatória"), ("MAQUINA", "Escavadeiras/retroescavadeira", "locacao", "Conforme necessidade")],
    "PERF_DET": [("MAQUINA", "Perfuratrizes", "locacao", "Obrigatória"), ("MATERIAL", "Explosivos/detonadores", "compra", "Conforme necessidade")],
    "TRAN_MIN": [("LOCACAO", "Caminhões fora-de-estrada/correias", "locacao", "Obrigatória"), ("CONSUMIVEL", "Pneus/correias", "compra", "Obrigatória")],
    "MONT_ELM": [("EQUIPAMENTO", "Geradores/turbinas/transformadores", "compra", "Obrigatória"), ("MATERIAL", "Cabos/conectores", "compra", "Obrigatória")],
    "LINH_TRA": [("MATERIAL", "Cabos de transmissão/isoladores", "compra", "Obrigatória"), ("EQUIPAMENTO", "Torres/montantes", "compra", "Obrigatória")],
    "ENER_SOL": [("EQUIPAMENTO", "Módulos fotovoltaicos/inversores", "compra", "Obrigatória"), ("MATERIAL", "Estruturas de fixação/cabos", "compra", "Obrigatória")],
    "ENER_EOL": [("EQUIPAMENTO", "Pás/torres/naceles", "compra", "Obrigatória"), ("MATERIAL", "Cabos/fundações", "compra", "Obrigatória")],
    "BIOM_GER": [("EQUIPAMENTO", "Caldeiras/turbinas", "compra", "Obrigatória"), ("MATERIAL", "Aço/tubulação", "compra", "Obrigatória")],
    "BIOG_MET": [("EQUIPAMENTO", "Biodigestores/recompressores", "compra", "Obrigatória"), ("MATERIAL", "Tubulação/válvulas", "compra", "Obrigatória")],
    "OFFS_ENG": [("EQUIPAMENTO", "Equipamentos offshore/subsea", "compra", "Obrigatória"), ("LOCACAO", "Plataformas/embarcações", "locacao", "Conforme necessidade")],
    "DUTO_GAS": [("MATERIAL", "Tubos de aço/cotovelos/válvulas", "compra", "Obrigatória"), ("MAQUINA", "Dobradeiras/Guindastes", "locacao", "Conforme necessidade")],
    "PROC_OGS": [("EQUIPAMENTO", "Separadores/compressores/bombas", "compra", "Obrigatória"), ("MATERIAL", "Tubulação/válvulas/instrumentação", "compra", "Obrigatória")],
    "PETR_OGE": [("EQUIPAMENTO", "Bombas/separadores/tubulação", "compra", "Obrigatória"), ("LOCACAO", "Plataformas/embarcações", "locacao", "Conforme necessidade")],
    "PORT_DRA": [("MAQUINA", "Dragas/bateadores", "locacao", "Obrigatória"), ("MATERIAL", "Concreto/aco/estacas", "compra", "Obrigatória")],
    "EQUI_MOV": [("LOCACAO", "Empilhadeiras/reach-stackers", "locacao", "Obrigatória"), ("CONSUMIVEL", "Pneus/lubrificantes", "compra", "Obrigatória")],
    "ARMA_SIL": [("MATERIAL", "Aço estrutural/telhas/cimentos", "compra", "Obrigatória"), ("EQUIPAMENTO", "Transportadores/elevadores", "compra", "Conforme necessidade")],
    "FERR_VIA": [("MATERIAL", "Trilhos/dormentes/lastro", "compra", "Obrigatória"), ("MAQUINA", "Equipamentos de via permanente", "locacao", "Obrigatória")],
    "TERM_POR": [("MATERIAL", "Concreto/asfalto/steel-fiber", "compra", "Obrigatória"), ("LOCACAO", "Compactadores/rolos", "locacao", "Conforme necessidade")],
    "FRIG_CAM": [("EQUIPAMENTO", "Câmaras frigoríficas/unidades condensadoras", "compra", "Obrigatória"), ("MATERIAL", "Painéis/isolantes", "compra", "Obrigatória")],
    "ABAT_EQU": [("EQUIPAMENTO", "Equipamentos de abate", "compra", "Obrigatória"), ("LOCACAO", "Ferramentas/utensílios", "locacao", "Conforme necessidade")],
    "PROC_ALI": [("EQUIPAMENTO", "Linhas de processamento/embalagem", "compra", "Obrigatória"), ("CONSUMIVEL", "Embalagens", "compra", "Obrigatória")],
    "TRAT_EFL": [("EQUIPAMENTO", "Bombas/filtros/reatores", "compra", "Obrigatória"), ("MATERIAL", "Tubulação/válvulas", "compra", "Obrigatória")],
    "REFR_IND": [("EQUIPAMENTO", "Compressores/trocadores", "compra", "Obrigatória"), ("MATERIAL", "Tubulação/isolantes", "compra", "Obrigatória")],
    "USINA_EPC": [("EQUIPAMENTO", "Moendas/evaporadores/destilaria", "compra", "Obrigatória"), ("MATERIAL", "Aço inox/tubulação", "compra", "Obrigatória")],
    "ETAN_BIO": [("EQUIPAMENTO", "Fermentadores/destiladores", "compra", "Obrigatória"), ("MATERIAL", "Aço inox/válvulas", "compra", "Obrigatória")],
    "MECA_AGR": [("MAQUINA", "Tratores/colhedoras/implementos", "compra", "Obrigatória"), ("LOCACAO", "Máquinas agrícolas", "locacao", "Conforme necessidade")],
    "AUTO_LIN": [("EQUIPAMENTO", "Robôs/esteiras/ferramentas", "compra", "Obrigatória"), ("CONSUMIVEL", "Solda/pintura", "compra", "Obrigatória")],
    "AUTO_MAN": [("EQUIPAMENTO", "CLPs/robôs/sensores", "compra", "Obrigatória"), ("CONSUMIVEL", "Cabos/componentes eletrônicos", "compra", "Obrigatória")],
    "ROD_AER": [("MATERIAL", "Asfalto/concreto/sinalização", "compra", "Obrigatória"), ("MAQUINA", "Pavimentadoras/rolos", "locacao", "Obrigatória")],
    "SANE_AGU": [("MATERIAL", "Tubos/conexões/bombas", "compra", "Obrigatória"), ("EQUIPAMENTO", "Bombas/estação de tratamento", "compra", "Obrigatória")],
    "DATA_CEN": [("EQUIPAMENTO", "Racks/UPS/switches", "compra", "Obrigatória"), ("MATERIAL", "Cabos/conectores", "compra", "Obrigatória")],
    "SEG_TRA": [("CONSUMIVEL", "EPIs/equipamentos de segurança", "compra", "Obrigatória")],
    "MEIO_AMB": [("SERVICO", "Licenciamento/consultoria ambiental", "compra", "Obrigatória"), ("CONSUMIVEL", "Coletas/amostragem", "compra", "Conforme necessidade")],
    "GEST_RES": [("EQUIPAMENTO", "Máquinas de processamento de resíduos", "compra", "Obrigatória"), ("MAQUINA", "Compactadores", "locacao", "Conforme necessidade")],
    "SAUDE_OC": [("SERVICO", "Medicina do trabalho", "compra", "Obrigatória"), ("CONSUMIVEL", "Materiais de exame", "compra", "Conforme necessidade")],
    "SERV_AMB": [("SERVICO", "Remediação/monitoramento", "compra", "Obrigatória"), ("CONSUMIVEL", "Reagentes/amostras", "compra", "Conforme necessidade")],
    "UTIL_FAC": [("SERVICO", "Facilities/limpeza/alimentação", "compra", "Obrigatória")],
    "LOCA_EQU": [("LOCACAO", "Equipamentos/andaimes/formas", "locacao", "Obrigatória")],
}


def classificar_cnae(codigo: str, descricao: str, service_codes: list) -> dict:
    codigo = (codigo or "").strip()
    desc_norm = _normalize(descricao or "")

    if service_codes:
        for sc in service_codes:
            role = SERVICE_TO_ROLE.get(sc)
            if role:
                return {"papel": role, "classificacao_tecnica": "PRESTADOR"}

    if codigo.startswith("35") or codigo.startswith("36") or codigo.startswith("84"):
        return {"papel": "OPERADOR_PROPRIETÁRIO", "classificacao_tecnica": "OPERADOR"}

    operator_words = [
        "geração de energia", "geracao de energia", "transmissão de energia", "transmissao de energia",
        "distribuição de energia", "distribuicao de energia", "comércio atacadista de energia", "comercio atacadista de energia",
        "concessionária de", "concessionaria de", "operadora de", "concessionária", "concessionaria",
        "operação dos aeroportos", "operacao dos aeroportos", "atividades do operador portuário", "atividades do operador portuario",
        "captação, tratamento e distribuição de água", "captacao, tratamento e distribuicao de agua",
        "administração pública", "administracao publica", "prefeitura", "município", "municipio", "estado",
        "governo", "autarquia", "fundação", "fundacao", "secretaria", "ministério", "ministerio",
        "operação ferroviária", "produção de gás", "processamento de gás natural",
    ]
    if any(p in desc_norm for p in operator_words):
        return {"papel": "OPERADOR_PROPRIETÁRIO", "classificacao_tecnica": "OPERADOR"}

    if "fabricação" in desc_norm or "fabricacao" in desc_norm or "fabricação de" in desc_norm:
        return {"papel": "NAO_RELACIONADO", "classificacao_tecnica": "NAO_RELACIONADO"}

    service_kw = [
        "instalação", "instalacao", "instalador", "montagem", "implantação", "implantacao",
        "manutenção", "manutencao", "reparação", "reparacao", "conserto",
        "construção", "construcao", "edificações", "edificacao", "edificio", "obra civil", "obra pública", "obra publica", "obras de",
        "terraplenagem", "demolição", "demolicao", "fundação", "fundacao", "estrutura", "alvenaria", "concreto",
        "pavimentação", "pavimentacao", "acabamento", "pintura", "impermeabilização", "impermeabilizacao",
        "sondagem", "perfuração", "perfuracao", "topografia", "geotecnia", "consultoria", "projetos",
        "desenho técnico", "desenho tecnico", "perícia", "pericia", "fiscalização", "fiscalizacao",
        "transporte", "testes e análises", "testes e analises",
    ]
    if any(k in desc_norm for k in service_kw):
        return {"papel": "PRESTADOR_EXECUÇÃO", "classificacao_tecnica": "PRESTADOR"}

    if any(k in desc_norm for k in ["aluguel", "locação", "locacao", "locadora", "leasing"]):
        return {"papel": "LOCAÇÃO_DE_EQUIPAMENTOS", "classificacao_tecnica": "PRESTADOR"}

    if "serviço" in desc_norm or "servico" in desc_norm:
        return {"papel": "ATIVIDADE_AUXILIAR", "classificacao_tecnica": "AUXILIAR"}

    if any(codigo.startswith(p) for p in ["10", "11", "12", "13", "17", "19", "20", "21", "26", "27", "28", "29", "46", "47", "49", "52", "60", "61"]):
        return {"papel": "NAO_RELACIONADO", "classificacao_tecnica": "NAO_RELACIONADO"}

    return {"papel": "AMBIGUO", "classificacao_tecnica": "AMBIGUO"}


def candidate_typology(setor: str, nome: str, descricao: str) -> dict:
    s = _normalize(setor or "")
    n = _normalize(nome or "")
    d = _normalize(descricao or "")
    texto = f"{s} {n} {d}"

    regras = [
        ("usina", "ENERGIA", "Geração"),
        ("subestação", "ENERGIA", "Subestação/Transmissão"),
        ("subestacao", "ENERGIA", "Subestação/Transmissão"),
        ("linha de transmissão", "ENERGIA", "Transmissão"),
        ("linha de transmissao", "ENERGIA", "Transmissão"),
        ("rede elétrica", "ENERGIA", "Distribuição"),
        ("rede eletrica", "ENERGIA", "Distribuição"),
        ("solar", "ENERGIA", "Solar"),
        ("eólica", "ENERGIA", "Eólica"),
        ("eolica", "ENERGIA", "Eólica"),
        ("rodovia", "INFRAESTRUTURA", "Rodovia"),
        ("ponte", "INFRAESTRUTURA", "Ponte/Viaduto"),
        ("viaduto", "INFRAESTRUTURA", "Ponte/Viaduto"),
        ("ferrovia", "LOGISTICO", "Ferrovia"),
        ("terminal", "LOGISTICO", "Terminal Portuário/Intermodal"),
        ("porto", "PORTUARIO", "Porto"),
        ("estação de tratamento", "SANEAMENTO", "ETE/ETA"),
        ("estacao de tratamento", "SANEAMENTO", "ETE/ETA"),
        ("rede de água", "SANEAMENTO", "Rede de água"),
        ("rede de agua", "SANEAMENTO", "Rede de água"),
        ("rede de esgoto", "SANEAMENTO", "Rede de esgoto"),
        ("hospital", "SAUDE", "Hospital"),
        ("unidade básica", "SAUDE", "UBS"),
        ("unidade basica", "SAUDE", "UBS"),
        ("escola", "EDUCACIONAL", "Educação"),
        ("universidade", "EDUCACIONAL", "Educação"),
        ("galpão", "INDUSTRIAL", "Galpão Industrial"),
        ("galpao", "INDUSTRIAL", "Galpão Industrial"),
        ("fábrica", "INDUSTRIAL", "Fábrica/Planta"),
        ("fabrica", "INDUSTRIAL", "Fábrica/Planta"),
        ("planta", "INDUSTRIAL", "Fábrica/Planta"),
        ("mineroduto", "MINERACAO", "Mineroduto"),
        ("mineração", "MINERACAO", "Mineração"),
        ("mineracao", "MINERACAO", "Mineração"),
        ("britagem", "MINERACAO", "Britagem"),
        ("data center", "TECNOLOGIA", "Data Center"),
        ("reforma", "OUTRO", "Reforma"),
        ("ampliação", "OUTRO", "Ampliação"),
        ("ampliacao", "OUTRO", "Ampliação"),
    ]

    for palavra, tipo, sub in regras:
        if palavra in texto:
            confianca = "ALTA" if palavra in n else "MÉDIA"
            return {
                "tipologia_candidata": tipo,
                "subtipo_candidato": sub,
                "confianca": confianca,
                "regra": f"palavra-chave: {palavra}",
                "status": "VALIDADA" if confianca == "ALTA" else "PROVÁVEL",
            }

    return {
        "tipologia_candidata": (setor or "NÃO_CLASSIFICADA").upper(),
        "subtipo_candidato": (setor or "NÃO_CLASSIFICADO").upper(),
        "confianca": "BAIXA",
        "regra": "setor",
        "status": "AMBIGUA" if setor else "NÃO_CLASSIFICADA",
    }


def fase_para_etapa(fase: str) -> str:
    fase_norm = _normalize(fase or "")
    mapping = {
        "planejamento": "ESTUDOS/PLANEJAMENTO",
        "licenciamento": "LICENCIAMENTO",
        "licenca_instalacao": "LICENCIAMENTO",
        "projeto": "PROJETO",
        "licitacao_aberta": "LICITAÇÃO/CONTRATAÇÃO",
        "em_execucao": "EXECUÇÃO DA OBRA",
        "operacao": "OPERAÇÃO/MANUTENÇÃO",
        "aprovacao_incentivo": "ESTUDOS/PLANEJAMENTO",
    }
    return mapping.get(fase_norm, fase_norm.upper() if fase_norm else "NÃO_CLASSIFICADA")


def main():
    os.makedirs(TARGET_DIR, exist_ok=True)
    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # -------------------------------------------------------------------
        # 1. Categorias de serviço e mapeamentos
        # -------------------------------------------------------------------
        cur.execute("""
            SELECT codigo, nome, cnaes, ordem
            FROM engenharia.categorias_servico
            WHERE ativo=true
            ORDER BY ordem;
        """)
        service_rows = dict_rows(cur)
        service_by_code = {r["codigo"]: r for r in service_rows}

        cnae_to_services = defaultdict(list)
        for svc in service_rows:
            for cnae in svc["cnaes"]:
                cnae_to_services[str(cnae)].append(svc["codigo"])

        # -------------------------------------------------------------------
        # 2. Matriz de compatibilidade setor x CNAE
        # -------------------------------------------------------------------
        cur.execute("""
            SELECT setor_obra, cnae_codigo, fases_aplicaveis, peso, fonte
            FROM engenharia.setor_cnae_compatibility;
        """)
        compat_rows = dict_rows(cur)
        compat_by_sector_cnae = {}
        for r in compat_rows:
            key = (r["setor_obra"], r["cnae_codigo"])
            compat_by_sector_cnae[key] = {
                "fases": r["fases_aplicaveis"] or [],
                "peso": r["peso"],
                "fonte": r["fonte"],
            }

        # -------------------------------------------------------------------
        # 3. Revisão dos 76 CNAEs
        # -------------------------------------------------------------------
        cur.execute("""
            SELECT f.cnae_principal,
                   max(coalesce(co.descricao, f.cnae_descricao, '')) as descricao_oficial,
                   count(distinct f.cnpj) as cnpjs_unicos,
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
            ORDER BY cnpjs_unicos DESC;
        """)
        cnaes = dict_rows(cur)

        cur.execute("""
            SELECT DISTINCT trim(unnest(cnae_secundarios)::text) as cnae
            FROM engenharia.fornecedores
            WHERE cnae_secundarios IS NOT NULL;
        """)
        secondary_cnaes = {str(row[0]) for row in cur.fetchall()}

        revisao_cnaes = []
        for c in cnaes:
            cnae = c["cnae_principal"]
            service_codes = cnae_to_services.get(cnae, [])
            classif = classificar_cnae(cnae, c["descricao_oficial"], service_codes)
            service_names = [service_by_code[s]["nome"] for s in service_codes if s in service_by_code]

            disciplinas = sorted({DISCIPLINA_POR_SERVICO.get(s, "Geral") for s in service_codes})
            fases = set()
            setores = set()
            for (sector, cnae_key), data in compat_by_sector_cnae.items():
                if cnae_key == cnae:
                    setores.add(sector)
                    if data["fases"]:
                        fases.update(data["fases"])

            principal_secundario = "PRINCIPAL"
            if cnae in secondary_cnaes:
                principal_secundario = "PRINCIPAL/SECUNDARIO"

            if classif["papel"] in ("OPERADOR_PROPRIETÁRIO", "ORGAO_CONTRATANTE"):
                status = "REPROVADO"
                justif = "CNAE classificado como operador/proprietário/concessionário; não deve compor base de prestadores."
            elif classif["papel"] == "NAO_RELACIONADO":
                status = "REPROVADO"
                justif = "CNAE não relacionado à execução de serviços de engenharia."
            elif classif["papel"] == "AMBIGUO":
                status = "REQUER_REVISAO_MANUAL"
                justif = "Papel empresarial não pôde ser determinado automaticamente."
            else:
                status = "APROVADO"
                justif = "CNAE compatível com serviços de engenharia."

            revisao_cnaes.append({
                "cnae": cnae,
                "descricao_oficial": c["descricao_oficial"],
                "cnpjs_unicos": c["cnpjs_unicos"],
                "obras_relacionadas": c["obras_relacionadas"],
                "cnae_principal_ou_secundario": principal_secundario,
                "papel_empresarial": classif["papel"],
                "disciplinas_compatíveis": ";".join(disciplinas),
                "servicos_compatíveis": ";".join(service_names),
                "fases_aplicaveis": ";".join(sorted(fases)) if fases else "",
                "setores_aplicaveis": ";".join(sorted(setores)) if setores else "",
                "classificacao_tecnica": classif["classificacao_tecnica"],
                "status_revisao": status,
                "justificativa": justif,
                "fonte": "engenharia.cnae_oficial + matches_v2 + setor_cnae_compatibility",
            })

        export_csv(
            f"{TARGET_DIR}/revisao_tecnica_76_cnaes.csv",
            ["cnae", "descricao_oficial", "cnpjs_unicos", "obras_relacionadas",
             "cnae_principal_ou_secundario", "papel_empresarial", "disciplinas_compatíveis",
             "servicos_compatíveis", "fases_aplicaveis", "setores_aplicaveis",
             "classificacao_tecnica", "status_revisao", "justificativa", "fonte"],
            revisao_cnaes,
        )

        cnae_role_map = {r["cnae"]: r["papel_empresarial"] for r in revisao_cnaes}

        # -------------------------------------------------------------------
        # 4. Tabelas temporárias de apoio
        # -------------------------------------------------------------------
        cur.execute("DROP TABLE IF EXISTS _audit_cnae_role;")
        cur.execute("""
            CREATE TEMP TABLE _audit_cnae_role (
                cnae_codigo TEXT PRIMARY KEY,
                papel TEXT,
                classificacao_tecnica TEXT
            ) ON COMMIT PRESERVE ROWS;
        """)
        for r in revisao_cnaes:
            cur.execute(
                "INSERT INTO _audit_cnae_role VALUES (%s, %s, %s) ON CONFLICT DO NOTHING;",
                (r["cnae"], r["papel_empresarial"], r["classificacao_tecnica"]),
            )

        cur.execute("DROP TABLE IF EXISTS _audit_service_cnae;")
        cur.execute("""
            CREATE TEMP TABLE _audit_service_cnae (
                cnae_codigo TEXT,
                service_code TEXT,
                service_name TEXT,
                PRIMARY KEY (cnae_codigo, service_code)
            ) ON COMMIT PRESERVE ROWS;
        """)
        for cnae, codes in cnae_to_services.items():
            for code in codes:
                svc = service_by_code.get(code)
                if svc:
                    cur.execute(
                        "INSERT INTO _audit_service_cnae VALUES (%s, %s, %s) ON CONFLICT DO NOTHING;",
                        (cnae, code, svc["nome"]),
                    )

        cur.execute("DROP TABLE IF EXISTS _audit_compatibility;")
        cur.execute("""
            CREATE TEMP TABLE _audit_compatibility (
                setor_obra TEXT,
                cnae_codigo TEXT,
                fase TEXT,
                PRIMARY KEY (setor_obra, cnae_codigo, fase)
            ) ON COMMIT PRESERVE ROWS;
        """)
        for (sector, cnae), data in compat_by_sector_cnae.items():
            for fase in (data["fases"] or []):
                cur.execute("INSERT INTO _audit_compatibility VALUES (%s, %s, %s) ON CONFLICT DO NOTHING;", (sector, cnae, fase))

        # -------------------------------------------------------------------
        # 5. Tipologia das obras (físicas e visíveis)
        # -------------------------------------------------------------------
        cur.execute("""
            SELECT id, setor, nome, descricao, fase, uf,
                   CASE WHEN status_portao='APROVADA' AND visivel=true AND motivo_invisivel IS NULL THEN true ELSE false END as visivel
            FROM engenharia.obras;
        """)
        obras = dict_rows(cur)

        cur.execute("DROP TABLE IF EXISTS _audit_obra_typology;")
        cur.execute("""
            CREATE TEMP TABLE _audit_obra_typology (
                obra_id UUID PRIMARY KEY,
                setor TEXT,
                fase TEXT,
                uf TEXT,
                tipologia_candidata TEXT,
                subtipo_candidato TEXT,
                status_tipologia TEXT,
                visivel BOOLEAN
            ) ON COMMIT PRESERVE ROWS;
        """)
        for o in obras:
            cand = candidate_typology(o["setor"], o["nome"], o["descricao"])
            cur.execute(
                "INSERT INTO _audit_obra_typology VALUES (%s, %s, %s, %s, %s, %s, %s, %s);",
                (o["id"], o["setor"], o["fase"], o["uf"], cand["tipologia_candidata"], cand["subtipo_candidato"], cand["status"], o["visivel"]),
            )

        # -------------------------------------------------------------------
        # 6. Classificação revisada por prestador — agregação única leve
        # -------------------------------------------------------------------
        cur.execute("DROP TABLE IF EXISTS _audit_provider_best_class;")
        cur.execute("""
            CREATE TEMP TABLE _audit_provider_best_class (
                cnpj TEXT PRIMARY KEY,
                min_order INTEGER
            ) ON COMMIT PRESERVE ROWS;
        """)

        cur.execute("""
            INSERT INTO _audit_provider_best_class (cnpj, min_order)
            SELECT m.cnpj, MIN(
                CASE
                    WHEN r.papel IN ('OPERADOR_PROPRIETÁRIO','NAO_RELACIONADO') THEN 4
                    WHEN svc.service_code IS NULL THEN 3
                    WHEN cpt.setor_obra IS NULL THEN 2
                    WHEN f.uf IS NOT NULL AND ot.uf IS NOT NULL AND f.uf != ot.uf THEN 2
                    WHEN m.score >= 80 THEN 1
                    WHEN m.score >= 60 THEN 2
                    ELSE 3
                END
            ) as min_order
            FROM engenharia.matches_v2 m
            JOIN engenharia.fornecedores f ON f.cnpj = m.cnpj
            JOIN _audit_obra_typology ot ON ot.obra_id = m.obra_id
            JOIN _audit_cnae_role r ON r.cnae_codigo = f.cnae_principal
            LEFT JOIN _audit_service_cnae svc ON svc.cnae_codigo = f.cnae_principal
            LEFT JOIN _audit_compatibility cpt ON cpt.setor_obra = ot.setor AND cpt.cnae_codigo = f.cnae_principal AND cpt.fase = ot.fase
            WHERE f.situacao_cadastral = '02'
            GROUP BY m.cnpj;
        """)
        conn.commit()
        print("Classificação por prestador concluída (agregação única).")

        # -------------------------------------------------------------------
        # 7. Matriz de cobertura existente — auditoria com flags
        # -------------------------------------------------------------------
        cur.execute("""
            SELECT *,
                   count(*) OVER (PARTITION BY sector, lifecycle_stage, service, cnae_code) as dup_count
            FROM engineering_service_provider_coverage;
        """)
        coverage_rows = dict_rows(cur)

        def is_phase_incompatible(row):
            key = (row["sector"], row["cnae_code"])
            if key in compat_by_sector_cnae:
                fases = compat_by_sector_cnae[key]["fases"] or []
                return row["lifecycle_stage"] not in fases
            return True

        revisada = []
        for row in coverage_rows:
            r = dict(row)
            r["flag_duplicado"] = "SIM" if (r.get("dup_count") or 0) > 1 else "NÃO"
            r["flag_contagem_negativa"] = "SIM" if any(
                r.get(k, 0) is not None and r.get(k, 0) < 0
                for k in ["confirmed_provider_count", "probable_provider_count", "potential_provider_count", "unclassified_provider_count", "obra_count"]
            ) else "NÃO"
            r["flag_operador_como_prestador"] = "SIM" if cnae_role_map.get(r["cnae_code"]) in ("OPERADOR_PROPRIETÁRIO", "ORGAO_CONTRATANTE") else "NÃO"
            r["flag_cnae_sem_servico"] = "SIM" if not cnae_to_services.get(r["cnae_code"]) else "NÃO"
            r["flag_servico_sem_disciplina"] = "SIM" if r["discipline"] in (None, "", "Geral") else "NÃO"
            r["flag_fase_incompativel"] = "SIM" if is_phase_incompatible(r) else "NÃO"
            if r["probable_provider_count"] > 0:
                status_recalc = "COBERTO_PROVAVEL"
            elif r["potential_provider_count"] >= 5:
                status_recalc = "COBERTO_POTENCIAL"
            elif r["potential_provider_count"] > 0:
                status_recalc = "COBERTURA_INSUFICIENTE"
            elif r["unclassified_provider_count"] > 0:
                status_recalc = "NÃO_AVALIADO"
            else:
                status_recalc = "SEM_COBERTURA"
            r["status_recalculado"] = status_recalc
            r["discrepancia_status"] = "SIM" if r["coverage_status"] != status_recalc else "NÃO"
            revisada.append(r)

        export_csv(
            f"{TARGET_DIR}/matriz_cobertura_revisada.csv",
            ["sector", "work_type_candidate", "lifecycle_stage", "discipline", "service", "cnae_code", "cnae_role",
             "confirmed_provider_count", "probable_provider_count", "potential_provider_count",
             "unclassified_provider_count", "obra_count", "coverage_status", "status_recalculado", "discrepancia_status",
             "flag_duplicado", "flag_contagem_negativa", "flag_operador_como_prestador", "flag_cnae_sem_servico",
             "flag_servico_sem_disciplina", "flag_fase_incompativel", "uf", "evidence", "source", "rule_version"],
            revisada,
        )

        # -------------------------------------------------------------------
        # 8. Cobertura das 57 categorias de serviço
        # -------------------------------------------------------------------
        cur.execute("""
            SELECT svc.service_code, svc.service_name,
                   count(distinct f.cnpj) FILTER (WHERE pbc.min_order = 1) as provaveis,
                   count(distinct f.cnpj) FILTER (WHERE pbc.min_order = 2) as potenciais,
                   string_agg(distinct f.uf, ',' ORDER BY f.uf) as ufs_cobertas
            FROM _audit_service_cnae svc
            JOIN engenharia.fornecedores f ON f.cnae_principal = svc.cnae_codigo
            JOIN _audit_provider_best_class pbc ON pbc.cnpj = f.cnpj
            WHERE f.situacao_cadastral = '02'
            GROUP BY svc.service_code, svc.service_name;
        """)
        servico_counts = {row[0]: dict(zip(["service_code", "service_name", "provaveis", "potenciais", "ufs_cobertas"], row)) for row in cur.fetchall()}

        cur.execute("SELECT string_agg(distinct uf, ',' ORDER BY uf) FROM _audit_obra_typology WHERE visivel=true;")
        all_ufs = cur.fetchone()[0] or ""
        all_ufs_set = set(all_ufs.split(",")) if all_ufs else set()

        cobertura_servicos = []
        for svc in service_rows:
            code = svc["codigo"]
            cnaes_do_servico = [c for c, codes in cnae_to_services.items() if code in codes]
            counts = servico_counts.get(code, {})
            prov = counts.get("provaveis") or 0
            pot = counts.get("potenciais") or 0
            ufs_cobertas = counts.get("ufs_cobertas") or ""
            if prov > 0:
                status = "COBERTURA_SUFICIENTE"
            elif pot >= 5:
                status = "COBERTURA_SUFICIENTE"
            elif pot > 0:
                status = "COBERTURA_INSUFICIENTE"
            else:
                status = "SEM_COBERTURA"
            ufs_cobertas_set = set(ufs_cobertas.split(",")) if ufs_cobertas else set()
            missing_ufs = sorted(all_ufs_set - ufs_cobertas_set)

            setores_aplicaveis = set()
            for c in cnaes_do_servico:
                for (sector, cnae_key) in compat_by_sector_cnae:
                    if cnae_key == c:
                        setores_aplicaveis.add(sector)

            cobertura_servicos.append({
                "codigo": code,
                "nome": svc["nome"],
                "disciplina": DISCIPLINA_POR_SERVICO.get(code, "Geral"),
                "cnaes_compatíveis": ";".join(cnaes_do_servico),
                "prestadores_provaveis_unicos": prov,
                "prestadores_potenciais_unicos": pot,
                "ufs_cobertas": ufs_cobertas,
                "ufs_sem_cobertura": ",".join(missing_ufs),
                "status_cobertura": status,
                "revisao_tecnica": "Serviço aprovado para insumos" if status == "COBERTURA_SUFICIENTE" else "Revisar cobertura",
                "setores_aplicaveis": ";".join(sorted(setores_aplicaveis)),
            })

        export_csv(
            f"{TARGET_DIR}/cobertura_57_servicos.csv",
            ["codigo", "nome", "disciplina", "cnaes_compatíveis", "prestadores_provaveis_unicos",
             "prestadores_potenciais_unicos", "ufs_cobertas", "ufs_sem_cobertura", "status_cobertura",
             "setores_aplicaveis", "revisao_tecnica"],
            cobertura_servicos,
        )

        # -------------------------------------------------------------------
        # 9. Cobertura por tipologia (agregação SQL única)
        # -------------------------------------------------------------------
        cur.execute("SELECT DISTINCT setor FROM _audit_obra_typology WHERE setor IS NOT NULL ORDER BY setor;")
        setores = [r[0] for r in cur.fetchall()]

        cur.execute("""
            SELECT ot.tipologia_candidata, ot.subtipo_candidato, ot.status_tipologia,
                   count(distinct ot.obra_id) as obras_fisicas,
                   count(distinct CASE WHEN ot.visivel THEN ot.obra_id END) as obras_visiveis,
                   count(distinct CASE WHEN pbc.min_order = 1 THEN f.cnpj END) as provaveis,
                   count(distinct CASE WHEN pbc.min_order = 2 THEN f.cnpj END) as potenciais,
                   string_agg(distinct ot.setor, ';') as setores_origem,
                   string_agg(distinct svc.service_code, ';') as servicos_disponiveis,
                   string_agg(distinct f.cnae_principal, ';') as cnaes_disponiveis
            FROM _audit_obra_typology ot
            JOIN engenharia.matches_v2 m ON m.obra_id = ot.obra_id
            JOIN engenharia.fornecedores f ON f.cnpj = m.cnpj
            LEFT JOIN _audit_provider_best_class pbc ON pbc.cnpj = f.cnpj
            LEFT JOIN _audit_service_cnae svc ON svc.cnae_codigo = f.cnae_principal
            WHERE f.situacao_cadastral = '02'
              AND pbc.cnpj IS NOT NULL
            GROUP BY ot.tipologia_candidata, ot.subtipo_candidato, ot.status_tipologia;
        """)
        tip_rows = dict_rows(cur)

        typology_rows = []
        for d in tip_rows:
            tip = d["tipologia_candidata"]
            subtipo = d["subtipo_candidato"]
            status_tip = d["status_tipologia"]
            sectors = set((d["setores_origem"] or "").split(";")) if d["setores_origem"] else set()
            cnaes_necessarios = set()
            servicos_necessarios = set()
            for (sector, cnae_key) in compat_by_sector_cnae:
                if sector in sectors:
                    cnaes_necessarios.add(cnae_key)
                    for sc in cnae_to_services.get(cnae_key, []):
                        servicos_necessarios.add(sc)
            cnaes_disponiveis = set((d["cnaes_disponiveis"] or "").split(";")) if d["cnaes_disponiveis"] else set()
            servicos_disponiveis = set((d["servicos_disponiveis"] or "").split(";")) if d["servicos_disponiveis"] else set()
            typology_rows.append({
                "tipologia": tip,
                "subtipo": subtipo,
                "status_tipologia": status_tip,
                "obras_fisicas": d["obras_fisicas"],
                "obras_visiveis": d["obras_visiveis"],
                "provaveis": d["provaveis"],
                "potenciais": d["potenciais"],
                "setores_origem": ";".join(sorted(sectors)),
                "fases_presentes": "",
                "servicos_necessarios": ";".join(sorted(servicos_necessarios)),
                "servicos_disponiveis": ";".join(sorted(servicos_disponiveis)),
                "servicos_ausentes": ";".join(sorted(servicos_necessarios - servicos_disponiveis)),
                "cnaes_necessarios": ";".join(sorted(cnaes_necessarios)),
                "cnaes_disponiveis": ";".join(sorted(cnaes_disponiveis)),
                "cnaes_ausentes": ";".join(sorted(cnaes_necessarios - cnaes_disponiveis)),
            })

        export_csv(
            f"{TARGET_DIR}/cobertura_por_tipologia.csv",
            ["tipologia", "subtipo", "status_tipologia", "obras_fisicas", "obras_visiveis",
             "provaveis", "potenciais", "setores_origem", "fases_presentes",
             "servicos_necessarios", "servicos_disponiveis", "servicos_ausentes",
             "cnaes_necessarios", "cnaes_disponiveis", "cnaes_ausentes"],
            typology_rows,
        )

        # -------------------------------------------------------------------
        # 10. Cobertura do ciclo completo (agregação SQL única)
        # -------------------------------------------------------------------
        cur.execute("""
            SELECT ot.tipologia_candidata, ot.fase, svc.service_code, svc.service_name, f.cnae_principal,
                   count(distinct CASE WHEN pbc.min_order = 1 THEN f.cnpj END) as prestadores_provaveis,
                   count(distinct CASE WHEN pbc.min_order = 2 THEN f.cnpj END) as prestadores_potenciais,
                   count(distinct ot.obra_id) as obras
            FROM _audit_obra_typology ot
            JOIN engenharia.matches_v2 m ON m.obra_id = ot.obra_id
            JOIN engenharia.fornecedores f ON f.cnpj = m.cnpj
            LEFT JOIN _audit_provider_best_class pbc ON pbc.cnpj = f.cnpj
            LEFT JOIN _audit_service_cnae svc ON svc.cnae_codigo = f.cnae_principal
            WHERE f.situacao_cadastral = '02'
              AND pbc.cnpj IS NOT NULL
              AND ot.status_tipologia IN ('VALIDADA', 'PROVÁVEL')
            GROUP BY ot.tipologia_candidata, ot.fase, svc.service_code, svc.service_name, f.cnae_principal;
        """)
        ciclo_rows = dict_rows(cur)

        ciclo_out = []
        for d in ciclo_rows:
            tip = d["tipologia_candidata"]
            fase = d["fase"]
            service_code = d["service_code"]
            service_name = d["service_name"] or "Serviço não mapeado"
            cnae = d["cnae_principal"]
            prov = d["prestadores_provaveis"]
            pot = d["prestadores_potenciais"]
            if prov > 0:
                status = "COBERTO_PROVAVEL"
            elif pot >= 5:
                status = "COBERTO_POTENCIAL"
            elif pot > 0:
                status = "COBERTURA_INSUFICIENTE"
            else:
                status = "SEM_COBERTURA"
            ciclo_out.append({
                "tipologia": tip,
                "etapa": fase_para_etapa(fase),
                "disciplina": DISCIPLINA_POR_SERVICO.get(service_code, "Geral"),
                "servico": service_name,
                "cnae": cnae,
                "prestadores_provaveis": prov,
                "prestadores_potenciais": pot,
                "obras": d["obras"],
                "cobertura": status,
                "gap": "" if status in ("COBERTO_PROVAVEL", "COBERTO_POTENCIAL") else "Falta prestador técnico elegível",
            })

        export_csv(
            f"{TARGET_DIR}/cobertura_ciclo_completo.csv",
            ["tipologia", "etapa", "disciplina", "servico", "cnae", "prestadores_provaveis",
             "prestadores_potenciais", "obras", "cobertura", "gap"],
            ciclo_out,
        )

        # -------------------------------------------------------------------
        # 11. Categorias de insumos validadas
        # -------------------------------------------------------------------
        insumos_out = []
        for s in cobertura_servicos:
            if s["status_cobertura"] != "COBERTURA_SUFICIENTE":
                continue
            code = s["codigo"]
            for cat, tipo, aquisicao, obrig in MAPA_INSUMOS.get(code, []):
                insumos_out.append({
                    "nome": tipo,
                    "descricao": f"{tipo} para {s['nome']}",
                    "servico_origem": s["nome"],
                    "etapa": "Execução da obra",
                    "tipologias_aplicaveis": s["setores_aplicaveis"],
                    "compra_ou_locacao": aquisicao,
                    "obrigatoriedade": obrig,
                    "confianca": "preliminar_validada",
                    "fonte_tecnica": "Matriz de insumos derivada do serviço",
                    "versao": VERSION,
                    "status_revisao": "APROVADO",
                })
        export_csv(
            f"{TARGET_DIR}/categorias_insumos_validadas.csv",
            ["nome", "descricao", "servico_origem", "etapa", "tipologias_aplicaveis",
             "compra_ou_locacao", "obrigatoriedade", "confianca", "fonte_tecnica", "versao", "status_revisao"],
            insumos_out,
        )

        # -------------------------------------------------------------------
        # 12. Cron de ingestão das 01:00 — não localizado
        # -------------------------------------------------------------------
        cron_md = """# Localização do Cron de Ingestão das 01:00

## Status
**Não localizado** no host atual (`/root/wins_hub_unificado`).

## Verificações realizadas
- `crontab -l`: cronjobs de backup (03:30), reload nginx e healthcheck; nenhum job de ingestão às 01:00.
- `/etc/cron.d/`: sem agendamento de ingestão.
- `systemctl list-timers --all`: timers de manutenção do sistema (fstrim, logrotate, apt, certbot); nenhum de ingestão.
- Containers Docker em execução: sem container com nome ingest/cron/scheduler.
- Busca por `01:00`, `cron`, `ingest`, `captura` no repositório: sem script de ingestão agendada local.
- Nenhum arquivo de systemd timer, supervisor, GitHub Actions ou scheduler externo foi encontrado neste host.

## Conclusão
O job de ingestão das 01:00 não está agendado no host de homologação atual. Possíveis localizações: outro host de captura, scheduler externo, pipeline de CI/CD ou serviço SaaS de captura.
"""
        with open(f"{TARGET_DIR}/cron_ingestao_localizacao.md", "w", encoding="utf-8") as f:
            f.write(cron_md)

        # -------------------------------------------------------------------
        # 13. Resumo
        # -------------------------------------------------------------------
        approved_count = sum(1 for r in revisao_cnaes if r["status_revisao"] == "APROVADO")
        reproved_count = sum(1 for r in revisao_cnaes if r["status_revisao"] == "REPROVADO")
        review_count = sum(1 for r in revisao_cnaes if r["status_revisao"] == "REQUER_REVISAO_MANUAL")
        service_sufficient = sum(1 for s in cobertura_servicos if s["status_cobertura"] == "COBERTURA_SUFICIENTE")
        service_insufficient = sum(1 for s in cobertura_servicos if s["status_cobertura"] == "COBERTURA_INSUFICIENTE")
        service_none = sum(1 for s in cobertura_servicos if s["status_cobertura"] == "SEM_COBERTURA")

        resumo = {
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "versao": VERSION,
            "cnaes_revisados": len(revisao_cnaes),
            "cnaes_aprovados": approved_count,
            "cnaes_reprovados": reproved_count,
            "cnaes_revisao_manual": review_count,
            "servicos_analisados": len(cobertura_servicos),
            "servicos_cobertura_suficiente": service_sufficient,
            "servicos_cobertura_insuficiente": service_insufficient,
            "servicos_sem_cobertura": service_none,
            "categorias_insumos": len(insumos_out),
            "espaco": get_disk_info(),
            "arquivos": [
                "revisao_tecnica_76_cnaes.csv",
                "cobertura_57_servicos.csv",
                "cobertura_por_tipologia.csv",
                "cobertura_ciclo_completo.csv",
                "matriz_cobertura_revisada.csv",
                "categorias_insumos_validadas.csv",
                "cron_ingestao_localizacao.md",
                "resumo_revisao_tecnica.json",
            ],
        }
        with open(f"{TARGET_DIR}/resumo_revisao_tecnica.json", "w", encoding="utf-8") as f:
            json.dump(resumo, f, indent=2, default=str)

        print("Revisão técnica concluída.")
        print(json.dumps(resumo, indent=2, default=str))

    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
