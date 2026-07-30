import asyncio
import json
import os
from playwright.async_api import async_playwright

BASE="https://winshubcomercial.com.br:18443"
USER=os.environ["GATE_USER"]
PASSWORD=os.environ["GATE_PASSWORD"]

async def main():
    result={"login":False,"directUrl":False,"logout":False,"tokenInLocalStorage":None,"consoleErrors":[]}
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path="/usr/bin/chromium-browser",headless=True,args=["--no-sandbox","--host-resolver-rules=MAP winshubcomercial.com.br 127.0.0.1"])
        page=await browser.new_page(viewport={"width":1366,"height":768})
        page.on("console",lambda msg: result["consoleErrors"].append(msg.text) if msg.type=="error" else None)
        await page.goto(BASE+"/demo/engenharia",wait_until="networkidle")
        result["directUrl"]="/demo/login" in page.url
        await page.get_by_role("button",name="Entrar com Keycloak").click()
        await page.locator("#username").fill(USER)
        await page.locator("#password").fill(PASSWORD)
        await page.locator("#kc-login").click()
        await page.wait_for_url("**/demo/**",timeout=20000)
        await page.goto(BASE+"/demo/engenharia",wait_until="networkidle")
        result["login"]=await page.get_by_text("Dashboard de Engenharia").count()>0
        storage=await page.evaluate("Object.entries(localStorage)")
        result["tokenInLocalStorage"]=any("eyJ" in str(value) or "token" in str(key).lower() for key,value in storage)
        result["authenticatedUrl"]=page.url
        if await page.get_by_title("Sair da Conta").count():
            await page.get_by_title("Sair da Conta").click()
            await page.wait_for_timeout(1000)
            result["logout"]="/demo/login" in page.url or "/auth/" in page.url
        else:
            result["logoutError"]="Botão de logout ausente após navegação autenticada"
        await browser.close()
    print(json.dumps(result,ensure_ascii=False,indent=2))

asyncio.run(main())
