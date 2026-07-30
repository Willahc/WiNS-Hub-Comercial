import os, sys, json
from datetime import datetime, timedelta

start = datetime(2026, 7, 21)
output_dir = "/root/wins_hub_unificado"

def generate_day(day: int):
    date = start + timedelta(days=day-1)
    filename = f"WINS_HUB_SHADOW_RUN_DIA_{day:02d}.md"
    filepath = os.path.join(output_dir, filename)
    
    phase = "Homologação interna" if day <= 7 else "Usuários piloto"
    
    # Skip if already exists and has content beyond template
    if os.path.exists(filepath):
        content = open(filepath).read()
        if "[Pendente]" not in content and len(content) > 500:
            return
    
    content = f"""# WiNS Hub — Shadow Run — Dia {day:02d}

## Data: {date.strftime('%Y-%m-%d')}

---

## Status: ✅ ATIVO

Fase: **{phase}**

---

## Métricas do Dia

| Endpoint | Chamadas | p50 | p95 | p99 | 4xx | 5xx | Timeout |
|----------|:--------:|:---:|:---:|:---:|:---:|:---:|:------:|
| Fornecedores | | | | | | | |
| Empresa 360° | | | | | | | |
| Obras | | | | | | | |
| Decisores | | | | | | | |
| Oportunidades | | | | | | | |
| Mapa | | | | | | | |

### Pool de Conexões

| Métrica | Valor |
|---------|:-----:|
| Conexões Ativas | |
| Pool Disponível | |
| Wait Time | |

### Infraestrutura

| Métrica | Valor |
|---------|:-----:|
| CPU (%) | |
| Memória (%) | |
| Disco (GB) | |

---

## Comparação de Dados

| Tabela | Origem | API | Legado | Diferença |
|--------|:------:|:---:|:------:|:---------:|
| Fornecedores | | | | |
| Obras | | | | |
| Empresas | | | | |

---

## Incidentes

| ID | Severidade | Descrição | Status |
|:---|:----------:|:-----------|:------:|
| - | - | - | - |

---

## Feedbacks Recebidos

| Usuário | Tarefa | Resultado | Dificuldade |
|:--------|:-------|:---------:|:-----------:|
| - | - | - | - |

---

## Correções do Dia

- [Pendente]

---

## Riscos

- [Pendente]

---

## Decisão de Continuidade: ✅ CONTINUAR

[Pendente — preencher com base nos incidentes e métricas do dia]
"""
    
    with open(filepath, 'w') as f:
        f.write(content.lstrip())
    print(f"Generated: {filename}")

if __name__ == "__main__":
    for d in range(2, 15):
        generate_day(d)
    print("All day templates generated.")
