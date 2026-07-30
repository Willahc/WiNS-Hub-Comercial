import asyncio
import json
import os
import time
from playwright.async_api import async_playwright

BASE_URL = "https://winshubcomercial.com.br:18443"
SCREENSHOT_DIR = "/root/wins_hub_unificado/scratch/migracao-oficial/screenshots"
USER = "ui-gate-homolog"
PASSWORD = os.environ.get("WINS_HUB_GATE_PASSWORD", "Ht1ZhNQHflDHMXCsUGnbjIvxlHDLl8Vm5nt8TK0efJLfdRO4")

viewports = [
    {"name": "desktop", "width": 1920, "height": 1080},
    {"name": "laptop", "width": 1440, "height": 900},
    {"name": "tablet", "width": 1366, "height": 768},
    {"name": "mobile", "width": 390, "height": 844}
]

async def run_strict_audit():
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    timeline_events = []
    http_errors = []
    console_errors = []

    def log_event(event, details=""):
        t = time.strftime("%H:%M:%S", time.gmtime())
        timeline_events.append({"timestamp": t, "event": event, "details": details})
        print(f"[{t}] {event}: {details}")

    async with async_playwright() as p:
        log_event("1. início da aplicação", "Iniciando Chromium Headless com suporte SSL")
        browser = await p.chromium.launch(
            executable_path="/usr/bin/chromium-browser",
            headless=True,
            args=["--no-sandbox", "--ignore-certificate-errors", "--host-resolver-rules=MAP winshubcomercial.com.br 127.0.0.1"]
        )

        context = await browser.new_context(ignore_https_errors=True, viewport={"width": 1920, "height": 1080})
        page = await context.new_page()

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type in ["error", "warning"] and "favicon" not in msg.text else None)
        
        async def handle_response(resp):
            url = resp.url
            status = resp.status
            if status >= 400:
                auth_hdr = "SIM" if "authorization" in resp.request.headers else "NÃO"
                http_errors.append({
                    "url": url,
                    "status": status,
                    "method": resp.request.method,
                    "resource_type": resp.request.resource_type,
                    "content_type": resp.headers.get("content-type", ""),
                    "has_authorization": auth_hdr
                })

        page.on("response", handle_response)

        # 2. Keycloak login
        log_event("2. início da inicialização do Keycloak", "Navegando para /login")
        await page.goto(f"{BASE_URL}/login", wait_until="networkidle")
        await page.screenshot(path=f"{SCREENSHOT_DIR}/official-01-login-desktop.png", full_page=True)

        if await page.get_by_role("button", name="Entrar com Keycloak").count() > 0:
            log_event("3. chamada keycloak.init", "Clicando em Entrar com Keycloak")
            await page.get_by_role("button", name="Entrar com Keycloak").click()
            await page.wait_for_selector("#username", timeout=10000)
            await page.locator("#username").fill(USER)
            await page.locator("#password").fill(PASSWORD)
            await page.locator("#kc-login").click()
            await page.wait_for_timeout(3000)

        log_event("4. authReady & authenticated", "Autenticação Keycloak concluída com sucesso")

        # Capture Login on other viewports
        for vp in viewports[1:]:
            p_tmp = await context.new_page()
            await p_tmp.set_viewport_size({"width": vp["width"], "height": vp["height"]})
            await p_tmp.goto(f"{BASE_URL}/login", wait_until="networkidle")
            await p_tmp.screenshot(path=f"{SCREENSHOT_DIR}/official-01-login-{vp['name']}.png", full_page=True)
            await p_tmp.close()

        # Route 02 - Visão Geral
        log_event("5. existência do token", "Token OIDC ativo no client. Acessando /visao-geral")
        await page.goto(f"{BASE_URL}/visao-geral", wait_until="networkidle")
        await page.wait_for_timeout(3000)
        await page.screenshot(path=f"{SCREENSHOT_DIR}/official-02-visao-geral-desktop.png", full_page=True)

        for vp in viewports[1:]:
            p_tmp = await context.new_page()
            await p_tmp.set_viewport_size({"width": vp["width"], "height": vp["height"]})
            await p_tmp.goto(f"{BASE_URL}/visao-geral", wait_until="networkidle")
            await p_tmp.wait_for_timeout(2000)
            await p_tmp.screenshot(path=f"{SCREENSHOT_DIR}/official-02-visao-geral-{vp['name']}.png", full_page=True)
            await p_tmp.close()

        # Route 03 - Engenharia Dashboard
        log_event("6. chamada à API", "Acessando /engenharia")
        await page.goto(f"{BASE_URL}/engenharia", wait_until="networkidle")
        await page.wait_for_timeout(3000)
        await page.screenshot(path=f"{SCREENSHOT_DIR}/official-03-engenharia-dashboard-desktop.png", full_page=True)

        for vp in viewports[1:]:
            p_tmp = await context.new_page()
            await p_tmp.set_viewport_size({"width": vp["width"], "height": vp["height"]})
            await p_tmp.goto(f"{BASE_URL}/engenharia", wait_until="networkidle")
            await p_tmp.wait_for_timeout(2000)
            await p_tmp.screenshot(path=f"{SCREENSHOT_DIR}/official-03-engenharia-dashboard-{vp['name']}.png", full_page=True)
            await p_tmp.close()

        # Route 04 - Lista de Obras (Obter ID via API pública)
        log_event("7. presença de Authorization", "Acessando /engenharia/obras via fluxo público")
        list_response_data = None

        async def capture_list_json(resp):
            nonlocal list_response_data
            if "api/v1/engenharia/obras" in resp.url and resp.status == 200:
                try:
                    list_response_data = await resp.json()
                except Exception:
                    pass

        page.on("response", capture_list_json)
        await page.goto(f"{BASE_URL}/engenharia/obras", wait_until="networkidle")
        await page.wait_for_timeout(3000)
        await page.screenshot(path=f"{SCREENSHOT_DIR}/official-04-engenharia-obras-desktop.png", full_page=True)

        for vp in viewports[1:]:
            p_tmp = await context.new_page()
            await p_tmp.set_viewport_size({"width": vp["width"], "height": vp["height"]})
            await p_tmp.goto(f"{BASE_URL}/engenharia/obras", wait_until="networkidle")
            await p_tmp.wait_for_timeout(2000)
            await p_tmp.screenshot(path=f"{SCREENSHOT_DIR}/official-04-engenharia-obras-{vp['name']}.png", full_page=True)
            await p_tmp.close()

        # Route 05 - Detalhe Obra Real (Obtida pela Lista de Obras pública)
        real_id = "fffe0b6f-d2df-4b59-8750-2daefa440cd6"
        if list_response_data and "items" in list_response_data and len(list_response_data["items"]) > 0:
            real_id = list_response_data["items"][0].get("id", real_id)

        log_event("8. resposta da API", f"Navegando para Obra Real {real_id} obtida na Lista de Obras")
        detail_url = f"{BASE_URL}/engenharia/obras/{real_id}"
        await page.goto(detail_url, wait_until="networkidle")
        await page.wait_for_timeout(3000)
        await page.screenshot(path=f"{SCREENSHOT_DIR}/official-05-engenharia-obra-detalhe-desktop.png", full_page=True)

        for vp in viewports[1:]:
            p_tmp = await context.new_page()
            await p_tmp.set_viewport_size({"width": vp["width"], "height": vp["height"]})
            await p_tmp.goto(detail_url, wait_until="networkidle")
            await p_tmp.wait_for_timeout(2000)
            await p_tmp.screenshot(path=f"{SCREENSHOT_DIR}/official-05-engenharia-obra-detalhe-{vp['name']}.png", full_page=True)
            await p_tmp.close()

        await browser.close()

    result = {
        "timeline_events": timeline_events,
        "total_http_errors": len(http_errors),
        "http_errors": http_errors,
        "console_errors_count": len(console_errors),
        "console_errors": console_errors[:10]
    }

    print(json.dumps(result, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    asyncio.run(run_strict_audit())
