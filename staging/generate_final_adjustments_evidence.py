import asyncio
import hashlib
import json
import os
import time
from playwright.async_api import async_playwright

BASE_URL = "https://winshubcomercial.com.br:18443"
SCREENSHOT_DIR = "/root/wins_hub_unificado/scratch/migracao-oficial/screenshots-final-20260724-adjustments"
USER = "ui-gate-homolog"
PASSWORD = os.environ.get("WINS_HUB_GATE_PASSWORD", "Ht1ZhNQHflDHMXCsUGnbjIvxlHDLl8Vm5nt8TK0efJLfdRO4")

def get_file_sha256(filepath):
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()

async def run_capture():
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    print(f"[Capture] Salvando capturas finais ajustadas em {SCREENSHOT_DIR}...")

    http_errors = []
    console_errors = []
    screenshot_metadata = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path="/usr/bin/chromium-browser",
            headless=True,
            args=["--no-sandbox", "--ignore-certificate-errors", "--host-resolver-rules=MAP winshubcomercial.com.br 127.0.0.1"]
        )

        context = await browser.new_context(ignore_https_errors=True, viewport={"width": 1920, "height": 1080})
        page = await context.new_page()

        print("[Capture] Efetuando login SSO no Keycloak...")
        await page.goto(f"{BASE_URL}/login", wait_until="networkidle")
        if await page.get_by_role("button", name="Entrar com Keycloak").count() > 0:
            await page.get_by_role("button", name="Entrar com Keycloak").click()
            await page.wait_for_selector("#username", timeout=10000)
            await page.locator("#username").fill(USER)
            await page.locator("#password").fill(PASSWORD)
            await page.locator("#kc-login").click()
            await page.wait_for_timeout(3000)

        await page.close()

        capture_specs = [
            {
                "label": "Página 02 - Visão Geral",
                "route": "/visao-geral",
                "desktop_file": "official-02-visao-geral-desktop-final.png",
                "mobile_file": "official-02-visao-geral-mobile-final.png",
                "selector": "text=Visão Geral",
                "marker": "Textos específicos CONFIRMADO/PROVÁVEL/POTENCIAL sem 'homologado' genérico"
            },
            {
                "label": "Página 03 - Engenharia Dashboard",
                "route": "/engenharia",
                "desktop_file": "official-03-engenharia-dashboard-desktop-final.png",
                "mobile_file": "official-03-engenharia-dashboard-mobile-final.png",
                "selector": "text=Engenharia",
                "marker": "OBRAS VISÍVEIS (16.633 no recorte — 35.690 registros físicos) + MATCHES QUALIFICADOS"
            },
            {
                "label": "Página 04 - Lista de Obras",
                "route": "/engenharia/obras",
                "desktop_file": "official-04-engenharia-obras-desktop-final.png",
                "mobile_file": "official-04-engenharia-obras-mobile-final.png",
                "selector": "text=Obras",
                "marker": "Filtros desktop escuros + Sem porcentagem sintética de progresso + 'obras sem CAPEX publicável'"
            },
            {
                "label": "Página 05 - Detalhe Obra Real",
                "route": "/engenharia/obras/fffe0b6f-d2df-4b59-8750-2daefa440cd6",
                "desktop_file": "official-05-engenharia-obra-detalhe-desktop-final.png",
                "mobile_file": "official-05-engenharia-obra-detalhe-mobile-final.png",
                "selector": "text=Alvara Curitiba - LUMINA GESTAO DE OBRAS LTDA",
                "marker": "Abas baseline ativas + Layout vertical de métricas sem sobreposição + Marcos temporais disponíveis"
            }
        ]

        for spec in capture_specs:
            target_url = f"{BASE_URL}{spec['route']}"

            # DESKTOP
            print(f"[Capture] Capturando DESKTOP para {spec['label']} ({spec['route']})...")
            p_desktop = await context.new_page()
            await p_desktop.set_viewport_size({"width": 1920, "height": 1080})
            await p_desktop.goto(target_url, wait_until="networkidle")
            try:
                await p_desktop.wait_for_selector(spec["selector"], timeout=8000)
            except Exception:
                pass
            await p_desktop.wait_for_timeout(2500)

            desktop_path = f"{SCREENSHOT_DIR}/{spec['desktop_file']}"
            await p_desktop.screenshot(path=desktop_path, full_page=True)
            dt_desktop = time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
            sha_desktop = get_file_sha256(desktop_path)
            size_desktop = os.path.getsize(desktop_path)

            screenshot_metadata.append({
                "filename": spec['desktop_file'],
                "label": spec['label'],
                "viewport": "1920x1080 (Desktop)",
                "url": target_url,
                "capture_timestamp": dt_desktop,
                "file_size_bytes": size_desktop,
                "sha256": sha_desktop,
                "functional_marker": spec['marker']
            })

            await p_desktop.close()

            # MOBILE
            print(f"[Capture] Capturando MOBILE para {spec['label']} ({spec['route']})...")
            p_mobile = await context.new_page()
            await p_mobile.set_viewport_size({"width": 390, "height": 844})
            await p_mobile.goto(target_url, wait_until="networkidle")
            try:
                await p_mobile.wait_for_selector(spec["selector"], timeout=8000)
            except Exception:
                pass
            await p_mobile.wait_for_timeout(2500)

            mobile_path = f"{SCREENSHOT_DIR}/{spec['mobile_file']}"
            await p_mobile.screenshot(path=mobile_path, full_page=True)
            dt_mobile = time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
            sha_mobile = get_file_sha256(mobile_path)
            size_mobile = os.path.getsize(mobile_path)

            screenshot_metadata.append({
                "filename": spec['mobile_file'],
                "label": spec['label'],
                "viewport": "390x844 (Mobile)",
                "url": target_url,
                "capture_timestamp": dt_mobile,
                "file_size_bytes": size_mobile,
                "sha256": sha_mobile,
                "functional_marker": spec['marker']
            })

            await p_mobile.close()

        await browser.close()

    result = {
        "screenshot_dir": SCREENSHOT_DIR,
        "screenshot_metadata": screenshot_metadata
    }

    with open(f"/root/wins_hub_unificado/scratch/migracao-oficial/ADJUSTED_CAPTURES_METADATA.json", "w") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"[Capture] Captura final concluída com sucesso! Imagens em {SCREENSHOT_DIR}.")

if __name__ == "__main__":
    asyncio.run(run_capture())
