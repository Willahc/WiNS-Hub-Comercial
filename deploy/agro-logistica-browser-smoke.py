#!/usr/bin/env python3
"""Smoke responsivo da SPA Agro-Logística contra o backend canário."""
import argparse, http.server, json, subprocess, threading, urllib.error, urllib.request
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

def context(container):
    data=json.loads(subprocess.check_output(["docker","inspect",container],text=True))[0]
    address=next(v["IPAddress"] for v in data["NetworkSettings"]["Networks"].values() if v.get("IPAddress"))
    env=dict(x.split("=",1) for x in data["Config"]["Env"] if "=" in x)
    return address,env["WINS_INTERNAL_SECRET"]

def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--container",required=True); ap.add_argument("--dist",required=True); ap.add_argument("--output",required=True); args=ap.parse_args()
    dist=Path(args.dist).resolve(); address,secret=context(args.container)
    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            parsed=urlsplit(self.path)
            if parsed.path.startswith("/api/v1/"):
                headers={"X-WiNS-Authenticated-User":"agro-release-validator","X-WiNS-Display-Name":"Agro Release Validator","X-WiNS-Roles":"agro","X-WiNS-Auth-Mode":"maintenance","X-WiNS-Internal-Secret":secret}
                req=urllib.request.Request(f"http://{address}:8000{self.path}",headers=headers)
                try: response=urllib.request.urlopen(req,timeout=45)
                except urllib.error.HTTPError as error: response=error
                body=response.read(); self.send_response(response.status); self.send_header("Content-Type",response.headers.get("Content-Type","application/json")); self.end_headers(); self.wfile.write(body); return
            target=dist/(parsed.path.lstrip("/") or "index.html")
            if not target.is_file(): target=dist/"index.html"
            self.send_response(200); self.send_header("Content-Type","text/javascript" if target.suffix==".js" else "text/css" if target.suffix==".css" else "text/html"); self.end_headers(); self.wfile.write(target.read_bytes())
        def log_message(self,*_): pass
    server=http.server.ThreadingHTTPServer(("127.0.0.1",0),Handler); threading.Thread(target=server.serve_forever,daemon=True).start(); origin=f"http://127.0.0.1:{server.server_port}"
    rows=[]
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True,args=["--no-sandbox"])
            for viewport in ({"width":1440,"height":900},{"width":390,"height":844}):
                page=browser.new_page(viewport=viewport); console=[]; bad=[]; api=[]
                page.on("console",lambda m: console.append(m.text) if m.type=="error" else None)
                def capture(response):
                    parsed=urlsplit(response.url)
                    if parsed.path.startswith("/api/v1/agro/logistica/"): api.append({"path":parsed.path,"http":response.status})
                    if response.status>=400: bad.append({"url":response.url,"http":response.status})
                page.on("response",capture); page.goto(origin+"/agro/logistica",wait_until="networkidle",timeout=60000); body=page.locator("body").inner_text()
                expected=["Agro-Logística & Cobertura Territorial","Cobertura parcial — 4 UFs","Transportadoras conhecidas","Municípios cobertos","Com RNTRC","Geocodificadas","Contatos institucionais","Registros logísticos","CONAB","indisponível no contrato canônico"]
                paths={x["path"] for x in api}; required={"/api/v1/agro/logistica/resumo","/api/v1/agro/logistica/municipios","/api/v1/agro/logistica/mapa"}
                passed=all(x in body for x in expected) and required<=paths and not console and not bad and "151.729" in body and "49.120" in body
                rows.append({"viewport":viewport,"api":api,"console_errors":console,"bad_responses":bad,"result":"PASS" if passed else "FAIL"}); page.close()
            browser.close()
    finally: server.shutdown(); server.server_close()
    Path(args.output).write_text(json.dumps({"views":rows},ensure_ascii=False,indent=2)+"\n")
    for row in rows: print(f'{row["viewport"]["width"]}x{row["viewport"]["height"]} | {len(row["api"])} chamadas | {len(row["console_errors"])} console | {len(row["bad_responses"])} HTTP>=400 | {row["result"]}')
    return 1 if any(x["result"]=="FAIL" for x in rows) else 0
if __name__=="__main__": raise SystemExit(main())
