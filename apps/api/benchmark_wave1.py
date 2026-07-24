import concurrent.futures
import json
import statistics
import time
import urllib.request

BASE = "http://127.0.0.1:18084/api/v1"
HEADERS = {"Authorization": "Bearer mock_jwt_token_wave1", "X-Request-Id": "benchmark-wave1"}

SCENARIOS = {
    "obras_pagina_1": "/engenharia/obras?page=1&page_size=25",
    "obras_pagina_profunda": "/engenharia/obras?page=600&page_size=25",
    "obras_busca_textual": "/engenharia/obras?page_size=25&search=rodovia",
    "obras_filtros_combinados": "/engenharia/obras?page_size=25&uf=SP&search=rodovia",
    "empresas_cnpj": "/empresas?page_size=25&cnpj=00000000000191",
    "fornecedores_busca": "/fornecedores?page_size=25&search=engenharia",
    "decisores_cargo": "/decisores?page_size=25&title=diretor",
}

def request(path: str) -> float:
    started = time.perf_counter()
    req = urllib.request.Request(BASE + path, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=15) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status}")
        response.read()
    return (time.perf_counter() - started) * 1000

def percentile(values: list[float], p: float) -> float:
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round((len(ordered) - 1) * p)))
    return ordered[index]

def summarize(values: list[float]):
    return {"samples": len(values), "p50_ms": round(percentile(values, .50), 2),
            "p95_ms": round(percentile(values, .95), 2), "p99_ms": round(percentile(values, .99), 2),
            "mean_ms": round(statistics.mean(values), 2)}

result = {}
for name, path in SCENARIOS.items():
    request(path)
    result[name] = summarize([request(path) for _ in range(10)])

with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
    values = list(executor.map(lambda _: request(SCENARIOS["obras_filtros_combinados"]), range(30)))
result["concorrencia_10_filtros_combinados"] = summarize(values)
print(json.dumps(result, indent=2, ensure_ascii=False))
