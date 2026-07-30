#!/usr/bin/env python3
"""
Fechar a auditoria dos prestadores: resolve CNAEs pendentes, reavalia reprovados,
reconcilia 57/71 serviços, analisa 11 serviços sem cobertura e classifica 117 insumos.
Não realiza consultas pesadas; apenas agregações leves e leitura de CSVs gerados.
"""
import csv
import json
import os
from collections import defaultdict
from datetime import datetime, timezone

import psycopg2

BASE_DIR = os.environ.get("BASE_DIR", "docs/audits/engineering-inputs")
DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "db"),
    "database": os.environ.get("DB_NAME", "wins_agro"),
    "user": os.environ.get("DB_USER", "wins_hub_api_ro"),
    "password": os.environ.get("DB_PASS", ""),
}


def read_csv(path):
    with open(path, "r", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def write_csv(path, fieldnames, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row.get(k, "") for k in fieldnames})


def main():
    os.makedirs(BASE_DIR, exist_ok=True)
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    # ------------------------------------------------------------------
    # 1. Resolver os 5 CNAEs pendentes
    # ------------------------------------------------------------------
    revisao = read_csv(f"{BASE_DIR}/revisao_tecnica_76_cnaes.csv")

    decisoes_pendentes = {
        "7120100": {
            "decisao_final": "APROVADO_PRESTADOR",
            "justificativa": "Testes e análises técnicas são serviços especializados de apoio à Engenharia (laboratoriais, ensaios, perícia técnica). Mesmo sem execução física, prestam serviço técnico essencial na fase de projeto, controle de qualidade e comissionamento.",
            "papel_empresarial": "ATIVIDADE_AUXILIAR",
        },
        "4322303": {
            "decisao_final": "APROVADO_PRESTADOR",
            "justificativa": "Instalação e manutenção de sistemas de prevenção contra incêndio é serviço técnico especializado, obrigatório em obras civis e industriais. Classificar como PRESTADOR_EXECUÇÃO/INSTALADOR.",
            "papel_empresarial": "INSTALADOR",
        },
        "4311802": {
            "decisao_final": "APROVADO_PRESTADOR",
            "justificativa": "Preparação de canteiro e limpeza de terreno são atividades preliminares de mobilização e terraplenagem, parte do ciclo de obra civil. Classificar como PRESTADOR_EXECUÇÃO.",
            "papel_empresarial": "PRESTADOR_EXECUÇÃO",
        },
        "4330405": {
            "decisao_final": "APROVADO_PRESTADOR",
            "justificativa": "Aplicação de revestimentos e resinas em interiores e exteriores é serviço de acabamento/revestimento, equivalente a pintura, gesso e impermeabilização. Classificar como PRESTADOR_EXECUÇÃO.",
            "papel_empresarial": "PRESTADOR_EXECUÇÃO",
        },
        "8030700": {
            "decisao_final": "NÃO_RELACIONADO",
            "justificativa": "Atividades de investigação particular não constituem serviço de engenharia, tampouco fornecimento de insumo. Excluir da base de prestadores.",
            "papel_empresarial": "NÃO_RELACIONADO",
        },
    }

    pendentes = []
    for r in revisao:
        if r["cnae"] in decisoes_pendentes:
            d = decisoes_pendentes[r["cnae"]]
            pendentes.append({
                "cnae": r["cnae"],
                "descricao_oficial": r["descricao_oficial"],
                "cnpjs_unicos": r["cnpjs_unicos"],
                "obras_relacionadas": r["obras_relacionadas"],
                "setores": r["setores_aplicaveis"],
                "fases": r["fases_aplicaveis"],
                "servicos_associados": r["servicos_compatíveis"],
                "motivo_ambiguidade": "Classificação automática não pôde determinar o papel empresarial.",
                "papel_empresarial_possivel": d["papel_empresarial"],
                "decisao_final": d["decisao_final"],
                "justificativa": d["justificativa"],
            })

    write_csv(
        f"{BASE_DIR}/revisao_final_5_cnaes_pendentes.csv",
        ["cnae", "descricao_oficial", "cnpjs_unicos", "obras_relacionadas", "setores", "fases",
         "servicos_associados", "motivo_ambiguidade", "papel_empresarial_possivel",
         "decisao_final", "justificativa"],
        pendentes,
    )

    # ------------------------------------------------------------------
    # 2. Reavaliar os 4 CNAEs reprovados
    # ------------------------------------------------------------------
    decisoes_reprovados = {
        "6110801": {
            "decisao_final": "NÃO_RELACIONADO",
            "justificativa": "Serviço de telefonia fixa comutada é telecomunicação, não execução de obra. Pode ser futuro fornecedor de insumo/serviço de TI, mas não prestador de engenharia.",
        },
        "6021700": {
            "decisao_final": "NÃO_RELACIONADO",
            "justificativa": "Atividades de televisão aberta são mídia/comunicação, sem relação com execução de serviços de engenharia.",
        },
        "4713004": {
            "decisao_final": "NÃO_RELACIONADO",
            "justificativa": "Lojas de departamentos/magazines são comércio varejista. Não prestam serviço de engenharia nem fornecem insumo técnico específico.",
        },
        "113000": {
            "decisao_final": "NÃO_RELACIONADO",
            "justificativa": "CNAE sem descrição oficial e sem evidência técnica. Manter fora do catálogo de prestadores até nova fonte.",
        },
    }

    reprovados = []
    for r in revisao:
        if r["cnae"] in decisoes_reprovados:
            d = decisoes_reprovados[r["cnae"]]
            futuro = "Sim - serviços de telecom/TI" if r["cnae"] in ("6110801", "6021700") else "Não"
            reprovados.append({
                "cnae": r["cnae"],
                "descricao_oficial": r["descricao_oficial"],
                "cnpjs_unicos": r["cnpjs_unicos"],
                "obras_relacionadas": r["obras_relacionadas"],
                "setores": r["setores_aplicaveis"],
                "fases": r["fases_aplicaveis"],
                "servicos_associados": r["servicos_compatíveis"],
                "classificacao_anterior": "NAO_RELACIONADO",
                "decisao_final": d["decisao_final"],
                "futuro_fornecedor_insumo": futuro,
                "justificativa": d["justificativa"],
            })

    write_csv(
        f"{BASE_DIR}/reavaliacao_4_cnaes_reprovados.csv",
        ["cnae", "descricao_oficial", "cnpjs_unicos", "obras_relacionadas", "setores", "fases",
         "servicos_associados", "classificacao_anterior", "decisao_final", "futuro_fornecedor_insumo", "justificativa"],
        reprovados,
    )

    # ------------------------------------------------------------------
    # 3. Reconciliar 57 × 71 serviços
    # ------------------------------------------------------------------
    cur.execute("""
        SELECT codigo, nome, descricao, cnaes, ordem, essencial, ativo
        FROM engenharia.categorias_servico
        ORDER BY ordem;
    """)
    cols = [d[0] for d in cur.description]
    cats = [dict(zip(cols, row)) for row in cur.fetchall()]

    cobertura = read_csv(f"{BASE_DIR}/cobertura_57_servicos.csv")
    cob_by_code = {r["codigo"]: r for r in cobertura}

    # Recupera fases e setores da matriz de compatibilidade para cada categoria
    cur.execute("""
        SELECT c.codigo,
               string_agg(distinct sc.fases_aplicaveis::text, ';') as fases,
               string_agg(distinct sc.setor_obra, ';') as setores
        FROM engenharia.categorias_servico c
        LEFT JOIN engenharia.setor_cnae_compatibility sc ON sc.cnae_codigo = ANY(c.cnaes)
        GROUP BY c.codigo;
    """)
    extra = {r[0]: {"fases": r[1] or "", "setores": r[2] or ""} for r in cur.fetchall()}

    reconciliacao = []
    for c in cats:
        code = c["codigo"]
        cob = cob_by_code.get(code, {})
        info = extra.get(code, {})
        reconciliacao.append({
            "service_id": code,
            "category_id": code,
            "codigo": code,
            "nome": c["nome"],
            "disciplina": cob.get("disciplina", ""),
            "fase": info.get("fases", ""),
            "tipologia": info.get("setores", ""),
            "ativo": "sim" if c["ativo"] else "não",
            "essencial": "sim" if c["essencial"] else "não",
            "nota_57_71": "Tabela possui 71 registros ativos; '57' era expectativa inicial/catalógo legado. Unidade oficial: 71." if c["ativo"] else "Inativo",
            "status_cobertura": cob.get("status_cobertura", "NÃO_AVALIADO"),
            "cnaes_compatíveis": cob.get("cnaes_compatíveis", ""),
            "prestadores_provaveis": cob.get("prestadores_provaveis_unicos", "0"),
            "prestadores_potenciais": cob.get("prestadores_potenciais_unicos", "0"),
        })

    write_csv(
        f"{BASE_DIR}/reconciliacao_57_71_servicos.csv",
        ["service_id", "category_id", "codigo", "nome", "disciplina", "fase", "tipologia",
         "ativo", "essencial", "nota_57_71", "status_cobertura", "cnaes_compatíveis",
         "prestadores_provaveis", "prestadores_potenciais"],
        reconciliacao,
    )

    # ------------------------------------------------------------------
    # 4. Analisar os 11 serviços sem cobertura
    # ------------------------------------------------------------------
    # Obter, para cada categoria sem cobertura, obras físicas/visíveis e UFs
    sem_cobertura = [r for r in cobertura if r["status_cobertura"] == "SEM_COBERTURA"]
    codes_sem_cobertura = [r["codigo"] for r in sem_cobertura]

    gaps = []
    if codes_sem_cobertura:
        cur.execute("""
            SELECT codigo, cnaes
            FROM engenharia.categorias_servico
            WHERE codigo = ANY(%s);
        """, (codes_sem_cobertura,))
        cat_rows = {r[0]: r[1] for r in cur.fetchall()}

        for r in sem_cobertura:
            code = r["codigo"]
            cnaes = cat_rows.get(code, [])
            cur.execute("""
                SELECT count(distinct o.id) as obras_fisicas,
                       count(distinct CASE WHEN o.status_portao='APROVADA' AND o.visivel=true AND o.motivo_invisivel IS NULL THEN o.id END) as obras_visiveis,
                       string_agg(distinct o.uf, ',' ORDER BY o.uf) as ufs,
                       string_agg(distinct o.setor, ';') as setores,
                       sum(COALESCE(o.valor_estimado, 0)) as capex_total
                FROM engenharia.obras o
                JOIN engenharia.matches_v2 m ON m.obra_id = o.id
                JOIN engenharia.fornecedores f ON f.cnpj = m.cnpj
                WHERE f.cnae_principal = ANY(%s) AND f.situacao_cadastral = '02';
            """, (cnaes,))
            row = cur.fetchone()
            obras_fisicas = row[0] or 0
            obras_visiveis = row[1] or 0
            ufs = row[2] or ""
            setores = row[3] or ""
            capex = row[4] or 0

            prioridade = 0
            if obras_visiveis:
                prioridade += min(int(obras_visiveis) // 100, 5)
            if capex:
                prioridade += min(int(capex) // 1000000, 3)
            if not ufs:
                prioridade += 1

            gaps.append({
                "codigo": code,
                "nome": r["nome"],
                "disciplina": r["disciplina"],
                "etapas_aplicaveis": "",
                "tipologias_afetadas": setores,
                "obras_fisicas": obras_fisicas,
                "obras_visiveis": obras_visiveis,
                "capex_total": capex or 0,
                "ufs_afetadas": ufs,
                "cnaes_atualmente_associados": r["cnaes_compatíveis"],
                "motivo_ausencia": "CNAEs associados não apresentam prestadores elegíveis com score mínimo e mapeamento compatível.",
                "cnaes_oficiais_candidatos": "",
                "score_prioridade": prioridade,
                "necessidade_revisao_tecnica": "Sim - revisar se os CNAEs associados cobrem a atividade ou se há CNAEs faltantes.",
            })

    gaps.sort(key=lambda x: (-x["score_prioridade"], -x["obras_visiveis"]))

    write_csv(
        f"{BASE_DIR}/gaps_11_servicos.csv",
        ["codigo", "nome", "disciplina", "etapas_aplicaveis", "tipologias_afetadas",
         "obras_fisicas", "obras_visiveis", "capex_total", "ufs_afetadas",
         "cnaes_atualmente_associados", "motivo_ausencia", "cnaes_oficiais_candidatos",
         "score_prioridade", "necessidade_revisao_tecnica"],
        gaps,
    )

    # ------------------------------------------------------------------
    # 5. Separar as 117 categorias de insumos
    # ------------------------------------------------------------------
    insumos = read_csv(f"{BASE_DIR}/categorias_insumos_validadas.csv")

    # Regras de classificação
    def classificar_insumo(row):
        # Todos os itens foram derivados automaticamente da matriz de serviços.
        # Nenhum passou por revisão técnica manual; portanto, nenhum é VALIDADA_TECNICAMENTE.
        return "DERIVADA_AUTOMATICAMENTE"

    tipos = {
        "MATERIAL": "material", "EQUIPAMENTO": "equipamento", "MAQUINA": "máquina",
        "FERRAMENTA": "ferramenta", "CONSUMIVEL": "consumível", "LOCACAO": "locação",
        "PECA_DE_REPOSICAO": "peça", "SERVICO": "serviço",
    }

    insumos_classificados = []
    seen = {}
    for i, ins in enumerate(insumos):
        status = classificar_insumo(ins)
        tipo = tipos.get(ins["compra_ou_locacao"].upper(), ins["compra_ou_locacao"])
        key = (ins["nome"], ins["servico_origem"])
        if key in seen:
            status = "DUPLICADA"
        else:
            seen[key] = True
        insumos_classificados.append({
            "nome_canonico": ins["nome"],
            "tipo": tipo,
            "disciplina": ins.get("disciplina", ""),
            "servico_origem": ins["servico_origem"],
            "etapa": ins["etapa"],
            "tipologias_aplicaveis": ins["tipologias_aplicaveis"],
            "compra_ou_locacao": ins["compra_ou_locacao"],
            "regra_tecnica": ins["fonte_tecnica"],
            "confianca": ins["confianca"],
            "status": status,
            "versao": ins["versao"],
        })

    write_csv(
        f"{BASE_DIR}/categorias_117_insumos_classificadas.csv",
        ["nome_canonico", "tipo", "disciplina", "servico_origem", "etapa",
         "tipologias_aplicaveis", "compra_ou_locacao", "regra_tecnica",
         "confianca", "status", "versao"],
        insumos_classificados,
    )

    # ------------------------------------------------------------------
    # 6. Espaço em disco e cron
    # ------------------------------------------------------------------
    cur.close()
    conn.close()

    import shutil
    total, used, free = shutil.disk_usage("/")
    espaco = {
        "total_gb": round(total / (1024**3), 2),
        "used_gb": round(used / (1024**3), 2),
        "free_gb": round(free / (1024**3), 2),
        "used_pct": round(used / total * 100, 2),
    }

    # Atualizar markdown do cron
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
    with open(f"{BASE_DIR}/cron_ingestao_localizacao.md", "w", encoding="utf-8") as f:
        f.write(cron_md)

    # ------------------------------------------------------------------
    # 7. Resumo final
    # ------------------------------------------------------------------
    status_insumos = {}
    for ins in insumos_classificados:
        status_insumos[ins["status"]] = status_insumos.get(ins["status"], 0) + 1

    resumo = {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "cnaes_pendentes_resolvidos": len(pendentes),
        "cnaes_reprovados_reavaliados": len(reprovados),
        "servicos_reconciliados": len(reconciliacao),
        "servicos_cobertura_suficiente": sum(1 for r in cobertura if r["status_cobertura"] == "COBERTURA_SUFICIENTE"),
        "servicos_sem_cobertura": len(gaps),
        "categorias_insumos": len(insumos_classificados),
        "categorias_insumos_por_status": status_insumos,
        "cron_01h_localizado": False,
        "candidatos_limpeza_espaco": [
            "bundles antigos da SPA em /opt/winshub/spa/__old_*",
            "imagens Docker dangling: docker image prune -a",
            "caches de build npm/pip em ~/.cache e node_modules/.cache",
            "caches do Playwright em ~/.cache/ms-playwright/versões antigas",
            "logs antigos de Nginx e containers em /var/log e docker logs truncados",
        ],
        "espaco": espaco,
        "arquivos_atualizados": [
            "revisao_final_5_cnaes_pendentes.csv",
            "reavaliacao_4_cnaes_reprovados.csv",
            "reconciliacao_57_71_servicos.csv",
            "gaps_11_servicos.csv",
            "categorias_117_insumos_classificadas.csv",
            "cron_ingestao_localizacao.md",
            "resumo_final_pre_insumos.json",
        ],
    }

    with open(f"{BASE_DIR}/resumo_final_pre_insumos.json", "w", encoding="utf-8") as f:
        json.dump(resumo, f, indent=2, default=str)

    print(json.dumps(resumo, indent=2, default=str))


if __name__ == "__main__":
    main()
