import asyncio
import os
import subprocess
from playwright.async_api import async_playwright

async def validate():
    print("Iniciando validação do build de produção...")
    
    # 1. Start preview server
    preview_process = subprocess.Popen(
        ["npm", "run", "preview", "--", "--port", "4173", "--host", "127.0.0.1"],
        cwd="/root/wins_hub_unificado",
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    
    # Wait for server
    await asyncio.sleep(3)
    
    errors = []
    logs = []
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path="/usr/bin/chromium-browser",
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox"]
        )
        
        page = await browser.new_page()
        
        # Listen for errors and logs
        page.on("pageerror", lambda err: errors.append(err.message))
        page.on("console", lambda msg: logs.append(msg.text) if msg.type == "error" else None)
        
        # Navigate to application
        print("Acessando http://localhost:4173/#/visao-geral")
        await page.goto("http://localhost:4173/#/visao-geral")
        await page.wait_for_timeout(1000)
        
        # 2. Check if page loaded by reading title or body
        body_text = await page.inner_text("body")
        loaded = "WiNS Hub" in body_text
        print(f"Página carregada: {loaded}")
        
        # 3. Check for absence of Development Profile Selector
        has_mock_selector = "Ambiente de Teste" in body_text
        print(f"Seletor de testes de desenvolvimento presente: {has_mock_selector}")
        
        # 4. Check for console errors
        print(f"Quantidade de erros de console capturados: {len(errors) + len(logs)}")
        if errors:
            print("Erros capturados:")
            for err in errors:
                print(f"  - {err}")
                
        await browser.close()
        
    # Terminate preview process
    preview_process.terminate()
    preview_process.wait()
    print("Servidor preview finalizado.")

if __name__ == "__main__":
    asyncio.run(validate())
