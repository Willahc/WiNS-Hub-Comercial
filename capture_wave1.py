import asyncio
import json
import os
import urllib.request
from playwright.async_api import async_playwright

OUT="/root/wins_hub_unificado/screenshots/onda1-real"
os.makedirs(OUT,exist_ok=True)
HEADERS={"Authorization":"Bearer mock_jwt_token_wave1"}
def api(path):
    req=urllib.request.Request("http://127.0.0.1:18084/api/v1"+path,headers=HEADERS)
    return json.load(urllib.request.urlopen(req,timeout=15))

async def main():
    work=api("/engenharia/obras?page_size=1&sort=value_desc")["items"][0]["source_id"]
    company=api("/empresas?page_size=1&active=true&sort=updated_desc")["items"][0]["source_id"]
    routes={"engenharia":"/engenharia","mapa-engenharia":"/engenharia/mapa","obras-reais":"/engenharia/obras",
            "detalhe-obra-real":f"/engenharia/obras/{work}","empresa-360-real":f"/empresas/{company}",
            "fornecedores-reais":"/fornecedores","decisores-reais":"/decisores","oportunidades-reais":"/oportunidades"}
    errors=[]
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path="/usr/bin/chromium-browser",headless=True,args=["--no-sandbox"])
        page=await browser.new_page(viewport={"width":1366,"height":768})
        page.on("console",lambda msg: errors.append(f"console:{msg.type}:{msg.text}") if msg.type=="error" else None)
        page.on("pageerror",lambda exc: errors.append(f"pageerror:{exc}"))
        for name,path in routes.items():
            await page.goto("http://127.0.0.1:5174/demo"+path,wait_until="networkidle",timeout=30000)
            await page.screenshot(path=f"{OUT}/{name}.png",full_page=True)
        await browser.close()
    print(json.dumps({"routes":routes,"consoleErrors":errors},ensure_ascii=False,indent=2))

asyncio.run(main())
