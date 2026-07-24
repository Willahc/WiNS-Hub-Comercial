import asyncio
import os
import subprocess
import time
from playwright.async_api import async_playwright

SCREENSHOT_DIR = "/root/wins_hub_unificado/screenshots"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

VIEWPORTS = {
    "390x844": {"width": 390, "height": 844},
    "768x1024": {"width": 768, "height": 1024},
    "1366x768": {"width": 1366, "height": 768},
    "1920x1080": {"width": 1920, "height": 1080}
}

SCREENS = {
    "visao-geral": "http://localhost:5173/#/visao-geral",
    "eventos": "http://localhost:5173/#/eventos",
    "mapa": "http://localhost:5173/#/mapa",
    "oportunidades": "http://localhost:5173/#/oportunidades",
    "empresas": "http://localhost:5173/#/empresas",
    "comercial": "http://localhost:5173/#/comercial",
    "engenharia": "http://localhost:5173/#/engenharia",
    "logistica": "http://localhost:5173/#/logistica",
    "agro": "http://localhost:5173/#/agro",
    "saude": "http://localhost:5173/#/saude",
    "inteligencia": "http://localhost:5173/#/territorial",
    "relatorios": "http://localhost:5173/#/relatorios",
    "configuracoes": "http://localhost:5173/#/configuracoes",
    "login": "http://localhost:5173/#/login"
}

async def capture_all():
    # Start dev server in background
    dev_process = subprocess.Popen(
        ["npm", "run", "dev", "--", "--port", "5173", "--host", "127.0.0.1"],
        cwd="/root/wins_hub_unificado",
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    
    # Wait for dev server to start
    await asyncio.sleep(4)
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path="/usr/bin/chromium-browser",
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox"]
        )
        
        for theme in ["dark", "light"]:
            print(f"React Screenshots — Tema: {theme.upper()}")
            for vp_name, vp_size in VIEWPORTS.items():
                print(f"  Viewport: {vp_name}")
                context = await browser.new_context(
                    viewport=vp_size,
                    device_scale_factor=1,
                    is_mobile=(vp_name == "390x844")
                )
                
                # 1. Capture main pages
                for screen_name, url in SCREENS.items():
                    page = await context.new_page()
                    await page.goto(url)
                    await page.wait_for_timeout(300) # Wait for React render
                    
                    # Force local simulated user login to admin
                    await page.evaluate("localStorage.setItem('wins_simulated_user', 'admin');")
                    # Force local theme
                    if theme == "light":
                        await page.evaluate("localStorage.setItem('wins-theme', 'light');")
                        await page.evaluate("document.body.classList.add('light');")
                    else:
                        await page.evaluate("localStorage.setItem('wins-theme', 'dark');")
                        await page.evaluate("document.body.classList.remove('light');")
                    
                    # Refresh to apply settings
                    await page.reload()
                    await page.wait_for_timeout(300)
                    
                    filename = f"{screen_name}_{theme}_{vp_name}.png"
                    filepath = os.path.join(SCREENSHOT_DIR, filename)
                    await page.screenshot(path=filepath)
                    await page.close()
                
                # 2. Capture Empresa 360° modal
                page = await context.new_page()
                await page.goto("http://localhost:5173/#/empresas")
                await page.wait_for_timeout(300)
                await page.evaluate("localStorage.setItem('wins_simulated_user', 'admin');")
                if theme == "light":
                    await page.evaluate("localStorage.setItem('wins-theme', 'light');")
                    await page.evaluate("document.body.classList.add('light');")
                else:
                    await page.evaluate("localStorage.setItem('wins-theme', 'dark');")
                    await page.evaluate("document.body.classList.remove('light');")
                await page.reload()
                await page.wait_for_timeout(400)
                
                try:
                    # Click first table row to open modal
                    await page.click("table tbody tr:first-child")
                    await page.wait_for_timeout(300)
                    filename = f"empresa-360_{theme}_{vp_name}.png"
                    filepath = os.path.join(SCREENSHOT_DIR, filename)
                    await page.screenshot(path=filepath)
                except Exception as e:
                    print(f"    Erro ao abrir Empresa 360°: {e}")
                await page.close()
                
                # 3. Capture Menu Mobile Aberto
                page = await context.new_page()
                await page.goto("http://localhost:5173/#/visao-geral")
                await page.wait_for_timeout(300)
                await page.evaluate("localStorage.setItem('wins_simulated_user', 'admin');")
                if theme == "light":
                    await page.evaluate("localStorage.setItem('wins-theme', 'light');")
                    await page.evaluate("document.body.classList.add('light');")
                else:
                    await page.evaluate("localStorage.setItem('wins-theme', 'dark');")
                    await page.evaluate("document.body.classList.remove('light');")
                await page.reload()
                await page.wait_for_timeout(400)
                
                try:
                    toggle = page.locator(".topbar .sidebar-toggle")
                    if await toggle.is_visible():
                        await toggle.click()
                        await page.wait_for_timeout(300)
                    filename = f"menu-mobile-aberto_{theme}_{vp_name}.png"
                    filepath = os.path.join(SCREENSHOT_DIR, filename)
                    await page.screenshot(path=filepath)
                except Exception as e:
                    print(f"    Erro ao capturar Menu Mobile: {e}")
                await page.close()
                
                await context.close()
                
        await browser.close()
        
    # Terminate dev server process
    dev_process.terminate()
    dev_process.wait()

if __name__ == "__main__":
    asyncio.run(capture_all())
    print("Captura de telas do React finalizada com sucesso!")
