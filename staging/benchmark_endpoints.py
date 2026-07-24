import json,os,statistics,subprocess,time
BASE="https://winshubcomercial.com.br:18443/api/v1"
TOKEN=os.environ["GATE_TOKEN"]
RESOLVE="winshubcomercial.com.br:18443:127.0.0.1"
def fetch(path):
    return subprocess.check_output(["curl","-sS","--resolve",RESOLVE,"-H",f"Authorization: Bearer {TOKEN}",BASE+path],text=True)
work=json.loads(fetch("/engenharia/obras?page_size=1"))["items"][0]["source_id"]
company=json.loads(fetch("/empresas?page_size=1&active=true"))["items"][0]["source_id"]
supplier=json.loads(fetch("/fornecedores?page_size=1"))["items"][0]["source_id"]
paths={
 "obras_list":"/engenharia/obras?page_size=25","obra_detail":f"/engenharia/obras/{work}","projetos":"/engenharia/projetos?page_size=25",
 "empresas":"/empresas?page_size=25&active=true","empresa_360":f"/empresas/{company}","fornecedores_busca":"/fornecedores?page_size=25&search=engenharia",
 "fornecedor_detail":f"/fornecedores/{supplier}","decisores":"/decisores?page_size=25&title=diretor","oportunidades":"/oportunidades?page_size=25&min_score=70","mapa":"/mapa?page_size=100"
}
def request(path):
    raw=subprocess.check_output(["curl","-sS","-o","/dev/null","-w","%{http_code} %{time_total}","--resolve",RESOLVE,"-H",f"Authorization: Bearer {TOKEN}",BASE+path],text=True)
    code,seconds=raw.split(); assert code=="200",(path,raw); return float(seconds)*1000
def pct(v,p):
    s=sorted(v); return round(s[min(len(s)-1,round((len(s)-1)*p))],2)
out={}
for name,path in paths.items():
    request(path); values=[request(path) for _ in range(7)]
    out[name]={"samples":len(values),"p50_ms":pct(values,.5),"p95_ms":pct(values,.95),"p99_ms":pct(values,.99),"mean_ms":round(statistics.mean(values),2)}
print(json.dumps(out,indent=2,ensure_ascii=False))
