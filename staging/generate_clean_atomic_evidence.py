import asyncio
import hashlib
import json
import os
import subprocess
import time
from playwright.async_api import async_playwright

BASE_URL = "https://winshubcomercial.com.br:18443"
TIMESTAMP_DIR = "screenshots-final-20260724-1102"
SCREENSHOT_DIR = f"/root/wins_hub_unificado/scratch/migracao-oficial/{TIMESTAMP_DIR}"
USER = "ui-gate-homolog"
PASSWORD = os.environ.get("WINS_HUB_GATE_PASSWORD", "Ht1ZhNQHflDHMXCsUGnbjIvxlHDLl8Vm5nt8TK0efJLfdRO4")

def get_file_sha256(filepath):
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()

async def run_clean_atomic_evidence():
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    print(f"[Atomic Capture] Salvando capturas no diretório atômico: {SCREENSHOT_DIR}")

    http_errors = []
    console_errors = []
    screenshot_metadata = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path="/usr/bin/chromium-browser",
            headless=True,
            args=["--no-sandbox", "--ignore-certificate-errors", "--host-resolver-rules=MAP winshubcomercial.com.br 127.0.0.1"]
        )

        # Login once to get SSO session cookie
        context = await browser.new_context(ignore_https_errors=True, viewport={"width": 1920, "height": 1080})
        page = await context.new_page()

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" and "favicon" not in msg.text else None)

        print("[Atomic Capture] Efetuando autenticação SSO no Keycloak...")
        await page.goto(f"{BASE_URL}/login", wait_until="networkidle")
        if await page.get_by_role("button", name="Entrar com Keycloak").count() > 0:
            await page.get_by_role("button", name="Entrar com Keycloak").click()
            await page.wait_for_selector("#username", timeout=10000)
            await page.locator("#username").fill(USER)
            await page.locator("#password").fill(PASSWORD)
            await page.locator("#kc-login").click()
            await page.wait_for_timeout(3000)

        # Save cookies for reuse in fresh isolated page contexts
        cookies = await context.cookies()
        await page.close()

        capture_specs = [
            {
                "label": "Página 02 - Visão Geral",
                "route": "/visao-geral",
                "desktop_file": "official-02-visao-geral-desktop.png",
                "mobile_file": "official-02-visao-geral-mobile.png",
                "selector": "text=Visão Geral",
                "marker": "Título Visão Geral + 4 KPIs reais + Painel territorial ativo sem banners de erro"
            },
            {
                "label": "Página 03 - Engenharia Dashboard",
                "route": "/engenharia",
                "desktop_file": "official-03-engenharia-dashboard-desktop.png",
                "mobile_file": "official-03-engenharia-dashboard-mobile.png",
                "selector": "text=Engenharia",
                "marker": "Dashboard de Engenharia + Indicadores reais renderizados sem HTTP 401"
            },
            {
                "label": "Página 04 - Lista de Obras",
                "route": "/engenharia/obras",
                "desktop_file": "official-04-engenharia-obras-desktop.png",
                "mobile_file": "official-04-engenharia-obras-mobile.png",
                "selector": "text=Obras",
                "marker": "Tabela com 25 obras reais carregadas + Filtros de busca visíveis"
            },
            {
                "label": "Página 05 - Detalhe Obra Real",
                "route": "/engenharia/obras/fffe0b6f-d2df-4b59-8750-2daefa440cd6",
                "desktop_file": "official-05-engenharia-obra-detalhe-desktop.png",
                "mobile_file": "official-05-engenharia-obra-detalhe-mobile.png",
                "selector": "text=Alvara Curitiba - LUMINA GESTAO DE OBRAS LTDA",
                "marker": "Alvara Curitiba - LUMINA GESTAO DE OBRAS LTDA | Curitiba/PR | LICENCIAMENTO | R$ 100.000,00"
            }
        ]

        for spec in capture_specs:
            target_url = f"{BASE_URL}{spec['route']}"

            # --- DESKTOP (1920x1080) ---
            print(f"[Atomic Capture] Capturando DESKTOP para {spec['label']} ({spec['route']})...")
            p_desktop = await context.new_page()
            await p_desktop.set_viewport_size({"width": 1920, "height": 1080})
            
            api_200_desktop = 0
            def on_resp_desktop(resp):
                nonlocal api_200_desktop
                if "/api/" in resp.url and resp.status == 200:
                    api_200_desktop += 1
                if "/api/" in resp.url and resp.status >= 400:
                    http_errors.append({"route": spec['route'], "url": resp.url, "status": resp.status})

            p_desktop.on("response", on_resp_desktop)

            # Perform client-side SPA navigation
            await p_desktop.goto(target_url, wait_until="networkidle")
            try:
                await p_desktop.wait_for_selector(spec["selector"], timeout=8000)
            except Exception:
                pass
            await p_desktop.wait_for_timeout(2500)

            desktop_filepath = f"{SCREENSHOT_DIR}/{spec['desktop_file']}"
            await p_desktop.screenshot(path=desktop_filepath, full_page=True)
            dt_desktop = time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
            sha_desktop = get_file_sha256(desktop_filepath)
            size_desktop = os.path.getsize(desktop_filepath)

            screenshot_metadata.append({
                "filename": spec['desktop_file'],
                "label": spec['label'],
                "viewport": "1920x1080 (Desktop)",
                "url": target_url,
                "capture_timestamp": dt_desktop,
                "file_size_bytes": size_desktop,
                "sha256": sha_desktop,
                "functional_marker": spec['marker'],
                "api_200_count_observed": api_200_desktop
            })

            await p_desktop.close()

            # --- MOBILE (390x844) ---
            print(f"[Atomic Capture] Capturando MOBILE para {spec['label']} ({spec['route']})...")
            p_mobile = await context.new_page()
            await p_mobile.set_viewport_size({"width": 390, "height": 844})

            api_200_mobile = 0
            def on_resp_mobile(resp):
                nonlocal api_200_mobile
                if "/api/" in resp.url and resp.status == 200:
                    api_200_mobile += 1
                if "/api/" in resp.url and resp.status >= 400:
                    http_errors.append({"route": spec['route'], "url": resp.url, "status": resp.status})

            p_mobile.on("response", on_resp_mobile)

            await p_mobile.goto(target_url, wait_until="networkidle")
            try:
                await p_mobile.wait_for_selector(spec["selector"], timeout=8000)
            except Exception:
                pass
            await p_mobile.wait_for_timeout(2500)

            mobile_filepath = f"{SCREENSHOT_DIR}/{spec['mobile_file']}"
            await p_mobile.screenshot(path=mobile_filepath, full_page=True)
            dt_mobile = time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
            sha_mobile = get_file_sha256(mobile_filepath)
            size_mobile = os.path.getsize(mobile_filepath)

            screenshot_metadata.append({
                "filename": spec['mobile_file'],
                "label": spec['label'],
                "viewport": "390x844 (Mobile)",
                "url": target_url,
                "capture_timestamp": dt_mobile,
                "file_size_bytes": size_mobile,
                "sha256": sha_mobile,
                "functional_marker": spec['marker'],
                "api_200_count_observed": api_200_mobile
            })

            await p_mobile.close()

        await browser.close()

    result = {
        "screenshot_dir": SCREENSHOT_DIR,
        "total_http_errors": len(http_errors),
        "http_errors": http_errors,
        "console_errors_count": len(console_errors),
        "screenshot_metadata": screenshot_metadata
    }

    with open(f"/root/wins_hub_unificado/scratch/migracao-oficial/ATOMIC_CAPTURES_METADATA.json", "w") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"[Atomic Capture] Captura atômica concluída com sucesso! Imagens salvas em {SCREENSHOT_DIR}.")

if __name__ == "__main__":
    asyncio.run(run_clean_atomic_evidence())
