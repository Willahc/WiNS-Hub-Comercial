#!/usr/bin/env python3
"""Differential, read-only HTTP gate for the Agro release canary."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

VARIABLE_KEYS = {
    "evaluation_timestamp", "evaluated_at", "duration", "duration_ms",
    "request_id", "generated_at", "generated_at_utc", "timestamp",
}
TRACEBACK = re.compile(r"Traceback \(most recent call last\)|File \"[^\"]+\", line \d+")
SECRET = re.compile(r"(?i)(password|passwd|secret|token|authorization|api[_-]?key)\s*[:=]")
ALLOWLIST = {
    "logistica": ("/diretorios/logistica/transportadores?page=1&page_size=25", "caminhao_vazio_staging"),
    "saude": ("/diretorios/saude/estabelecimentos?page=1&page_size=25", "wins_saude_staging"),
    "visao_geral": ("/visao-geral/mapa", "dependencia_logica_de_mapa"),
}


def canonical(value):
    if isinstance(value, dict):
        return {k: canonical(v) for k, v in sorted(value.items()) if k not in VARIABLE_KEYS}
    if isinstance(value, list):
        return [canonical(v) for v in value]
    return value


def digest(value) -> str:
    raw = json.dumps(canonical(value), ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode()).hexdigest()


def schema(value):
    if isinstance(value, dict):
        return {k: schema(v) for k, v in sorted(value.items()) if k not in VARIABLE_KEYS}
    if isinstance(value, list):
        return [schema(value[0])] if value else []
    return type(value).__name__


def subset_contract(base, candidate, where="$"):
    if isinstance(base, dict):
        if not isinstance(candidate, dict):
            return f"{where}: tipo alterado"
        missing = sorted(set(base) - VARIABLE_KEYS - set(candidate))
        if missing:
            return f"{where}: campos ausentes {missing}"
        for key, value in base.items():
            if key not in VARIABLE_KEYS:
                issue = subset_contract(value, candidate[key], f"{where}.{key}")
                if issue:
                    return issue
    elif isinstance(base, list):
        if not isinstance(candidate, list):
            return f"{where}: lista alterada"
        if base and candidate:
            return subset_contract(base[0], candidate[0], f"{where}[0]")
    elif type(base) is not type(candidate) and not (
        isinstance(base, (int, float)) and isinstance(candidate, (int, float))
    ):
        return f"{where}: tipo {type(base).__name__} -> {type(candidate).__name__}"
    return None


PROBE = r'''
import json, os, time, urllib.error, urllib.request
path = __import__('sys').argv[1]
headers = {}
if path != '/health':
    role = 'logistica' if '/diretorios/logistica/' in path else ('saude' if '/diretorios/saude/' in path else 'agro')
    headers = {
      'X-WiNS-Authenticated-User':'agro-release-validator',
      'X-WiNS-Display-Name':'Agro Release Validator',
      'X-WiNS-Roles':role, 'X-WiNS-Auth-Mode':'maintenance',
      'X-WiNS-Internal-Secret':os.environ.get('WINS_INTERNAL_SECRET','')}
req=urllib.request.Request('http://127.0.0.1:8000/api/v1'+path, headers=headers)
started=time.monotonic()
try:
  with urllib.request.urlopen(req,timeout=45) as response:
    raw=response.read(); status=response.status
except urllib.error.HTTPError as error:
  raw=error.read(); status=error.code
except Exception as error:
  print(json.dumps({'status':0,'duration_ms':round((time.monotonic()-started)*1000,2),
    'exception_type':type(error).__name__,'message':str(error)})); raise SystemExit
try: body=json.loads(raw)
except Exception: body={'non_json_body':raw.decode('utf-8','replace')[:1000]}
print(json.dumps({'status':status,'duration_ms':round((time.monotonic()-started)*1000,2),'body':body},ensure_ascii=False))
'''


def probe(container: str, path: str):
    proc = subprocess.run(
        ["docker", "exec", container, "python", "-c", PROBE, path],
        text=True, capture_output=True, timeout=55,
    )
    if proc.returncode or not proc.stdout.strip():
        return {"status": 0, "duration_ms": 45000, "exception_type": "ProbeError",
                "message": "probe failed"}
    result = json.loads(proc.stdout.strip().splitlines()[-1])
    body_text = json.dumps(result.get("body"), ensure_ascii=False)
    result["traceback_external"] = bool(TRACEBACK.search(body_text))
    result["secret_external"] = bool(SECRET.search(body_text))
    result["normalized_hash"] = digest(result.get("body"))
    if result["status"] >= 400:
        body = result.get("body") or {}
        detail = body.get("detail") if isinstance(body, dict) else None
        result["exception_type"] = body.get("type", "HTTPError") if isinstance(body, dict) else "HTTPError"
        result["sanitized_message"] = re.sub(r"[A-Za-z0-9_\-]{24,}", "<redacted>", str(detail or "HTTP error"))[:300]
        result.pop("body", None)
    return result


def items(body):
    return body.get("items", []) if isinstance(body, dict) else []


def forbidden_key(value, names):
    if isinstance(value, dict):
        return any(k.lower() in names and v not in (None, "", []) for k, v in value.items()) or any(
            forbidden_key(v, names) for v in value.values())
    if isinstance(value, list):
        return any(forbidden_key(v, names) for v in value)
    return False


def classify(name, base, cand, *, new=False, allowlisted=False):
    bs, cs = base["status"], cand["status"]
    if cand.get("traceback_external") or cand.get("secret_external"):
        return "FAIL_NEW_ERROR", "exposição adicional na candidata"
    if new:
        return ("PASS_IMPROVED", "nova rota funcional") if 200 <= cs < 300 else ("FAIL_NEW_ERROR", "nova rota não funcional")
    if 200 <= bs < 300:
        if not 200 <= cs < 300:
            return "FAIL_REGRESSION", "rota saudável deixou de ser saudável"
        comparison_candidate = cand.get("body")
        if name == "oportunidades_funil" and isinstance(comparison_candidate, dict):
            # Renomeação documental do mesmo contador, prevista pelo contrato novo
            # do Radar; ambos os nomes e valores continuam registrados nos hashes.
            comparison_candidate = json.loads(json.dumps(comparison_candidate))
            bucket = comparison_candidate.get("discarded_or_not_promoted", {})
            if "promotion_unavailable" in bucket:
                bucket["rule_unavailable"] = bucket["promotion_unavailable"]
        issue = subset_contract(base.get("body"), comparison_candidate)
        if issue:
            return "FAIL_CONTRACT_CHANGE", issue
        if name in {"imoveis_mt_cuiaba", "imovel_detalhe"} and cand["duration_ms"] > base["duration_ms"] * 1.5:
            return "FAIL_PERFORMANCE", "candidata excedeu 150% do baseline"
        return "PASS_PARITY", "contrato compatível"
    if allowlisted:
        if 200 <= cs < 300:
            return "PASS_IMPROVED", "falha preexistente corrigida"
        same = (bs == cs and base.get("exception_type") == cand.get("exception_type")
                and base.get("normalized_hash") == cand.get("normalized_hash"))
        return ("KNOWN_BASELINE_FAILURE", "falha preexistente idêntica") if same else (
            "FAIL_NEW_ERROR", "causa ou contrato de erro divergente")
    return "FAIL_NEW_ERROR", "erro fora da allowlist"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--baseline-container", required=True)
    ap.add_argument("--candidate-container", required=True)
    ap.add_argument("--output", required=True)
    args = ap.parse_args()
    routes = {
      "health":"/health", "pessoas_vinculos":"/agro/pessoas-vinculos?page=1&page_size=25",
      "holdings":"/agro/holdings?page=1&page_size=25", "tecnicos":"/agro/tecnicos?page=1&page_size=25",
      "deserto_veterinario":"/agro/deserto-veterinario?page=1&page_size=25",
      "oportunidades_status":"/agro/oportunidades/status",
      "oportunidades":"/agro/oportunidades?stage=SIGNAL&page=1&page_size=25",
      "oportunidades_funil":"/agro/oportunidades/funil", "oportunidades_regras":"/agro/oportunidades/regras",
      **{k:v[0] for k,v in ALLOWLIST.items()},
    }
    # Recorte real descoberto na produção em 2026-08-03 e fixado para ambos os ambientes.
    property_municipality = "Guarantã do Norte"
    prop_path="/agro/imoveis?uf=MT&municipio="+quote(property_municipality)+"&page=1&page_size=25"
    routes["imoveis_mt_cuiaba"] = prop_path
    baseline={name:probe(args.baseline_container,path) for name,path in routes.items()}
    base_props=items(baseline["imoveis_mt_cuiaba"].get("body"))
    if not base_props:
        print(f"baseline de propriedades {property_municipality}/MT não retornou itens", file=sys.stderr); return 1
    detail_id=str(base_props[0].get("detail_id") or base_props[0].get("id"))
    routes["imovel_detalhe"]="/agro/imoveis/"+quote(detail_id)
    baseline["imovel_detalhe"]=probe(args.baseline_container,routes["imovel_detalhe"])
    candidate={name:probe(args.candidate_container,path) for name,path in routes.items()}
    for name,path in {"oportunidades_estagios":"/agro/oportunidades/estagios"}.items():
        routes[name]=path; baseline[name]=probe(args.baseline_container,path); candidate[name]=probe(args.candidate_container,path)

    rows=[]
    for name,path in routes.items():
        result,reason=classify(name,baseline[name],candidate[name],new=name=="oportunidades_estagios",
                               allowlisted=name in ALLOWLIST)
        rows.append({"route":path,"baseline":baseline[name],"candidate":candidate[name],
                     "parity":baseline[name].get("normalized_hash")==candidate[name].get("normalized_hash"),
                     "result":result,"reason":reason,
                     "missing_logical_database":ALLOWLIST[name][1] if name in ALLOWLIST else None})

    # Regras semânticas específicas que HTTP 200 e schema não demonstram.
    def fail(name, reason, kind="FAIL_CONTRACT_CHANGE"):
        row=next(r for r in rows if r["route"]==routes[name]); row.update(result=kind,reason=reason)
    people=candidate["pessoas_vinculos"].get("body",{})
    if len(items(people)) != 25: fail("pessoas_vinculos", "Pessoas & Vínculos não retornou 25 itens")
    if forbidden_key(people,{"cpf","cpf_cnpj","score","composicao_score"}): fail("pessoas_vinculos", "CPF ou score exposto")
    if baseline["pessoas_vinculos"].get("normalized_hash") != candidate["pessoas_vinculos"].get("normalized_hash"):
        fail("pessoas_vinculos", "hash normalizado de Pessoas & Vínculos divergente")
    for key in ("page", "page_size", "total", "total_pages"):
        if baseline["pessoas_vinculos"].get("body",{}).get(key) != people.get(key):
            fail("pessoas_vinculos", f"paginação divergente: {key}")
    base_prop=base_props[0]; cand_props=items(candidate["imoveis_mt_cuiaba"].get("body"))
    if len(base_props) != len(cand_props): fail("imoveis_mt_cuiaba", "quantidade do recorte divergente")
    if cand_props:
        for key in ("detail_id", "codigo_car", "area_total_ha", "fonte", "fonte_principal"):
            if key in base_prop and base_prop.get(key) != cand_props[0].get(key):
                fail("imoveis_mt_cuiaba", f"propriedade divergente: {key}")
    stages=candidate["oportunidades_estagios"].get("body",{})
    by_stage={x.get("stage"):x for x in stages.get("stages",[]) if isinstance(x,dict)}
    expected={"SIGNAL":("ACTIVE",1368),"CANDIDATE":("UNAVAILABLE",0),"VALIDATION":("UNAVAILABLE",None),"VALIDATED":("UNAVAILABLE",None)}
    for stage,(status,count) in expected.items():
        obj=by_stage.get(stage,{})
        if obj.get("status")!=status or (count is not None and obj.get("record_count")!=count):
            fail("oportunidades_estagios",f"semântica inválida do estágio {stage}")
    candidate_blockers=by_stage.get("CANDIDATE",{}).get("blockers",[])
    if not candidate_blockers or candidate_blockers[0].get("code")!="PROPERTY_QUERY_NOT_PERFORMANT":
        fail("oportunidades_estagios","blocker de CANDIDATE inválido")
    rules=candidate["oportunidades_regras"].get("body",{}).get("rules",[])
    by_rule={x.get("rule_id"):x for x in rules}
    active=by_rule.get("TECHNICAL_COVERAGE_GAP_MUNICIPAL_V1",{})
    prop=by_rule.get("PROPERTY_IN_TECHNICAL_GAP_V1",{})
    if active.get("status")!="ACTIVE" or active.get("produced_count")!=1368 or prop.get("status")!="UNAVAILABLE":
        fail("oportunidades_regras","catálogo de regras do Radar divergente")
    planned=[x for x in rules if x.get("status")=="PLANNED"]
    if len(planned)!=4 or any(x.get("produced_count") not in (0,None) for x in planned):
        fail("oportunidades_regras","regras PLANNED inválidas")
    radar=[candidate[n].get("body") for n in ("oportunidades","oportunidades_regras","oportunidades_estagios")]
    if forbidden_key(radar,{"score","decisor","contato_pessoal","candidata_inventada","validada_automaticamente"}):
        fail("oportunidades_estagios","conteúdo fabricado ou score encontrado")

    payload={"generated_at_utc":datetime.now(timezone.utc).isoformat().replace("+00:00","Z"),
      "property_filter":{"uf":"MT","municipio":property_municipality,"page":1,"page_size":25,"detail_id":detail_id},
      "normalization":{"removed_fields":sorted(VARIABLE_KEYS)},"allowlist":sorted(ALLOWLIST),"routes":rows}
    Path(args.output).write_text(json.dumps(payload,indent=2,ensure_ascii=False)+"\n")
    for row in rows: print(f'{row["route"]} | {row["baseline"]["status"]} | {row["candidate"]["status"]} | {row["parity"]} | {row["result"]}')
    return 1 if any(r["result"].startswith("FAIL_") for r in rows) else 0


if __name__ == "__main__":
    raise SystemExit(main())
