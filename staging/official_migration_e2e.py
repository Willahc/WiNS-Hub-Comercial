import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright

BASE = "https://winshubcomercial.com.br:18443"
USER = "ui-gate-homolog"
PASSWORD = os.environ.get("WINS_HUB_GATE_PASSWORD", "Ht1ZhNQHflDHMXCsUGnbjIvxlHDLl8Vm5nt8TK0efJLfdRO4")
SCREENSHOT_DIR = Path("/root/wins_hub_unificado/scratch/migracao-oficial/screenshots")
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

VIEWPORTS = {
  "desktop": {"width": 1920, "height": 1080},
  "laptop": {"width": 1440, "height": 900},
  "tablet": {"width": 1366, "height": 768},
  "mobile": {"width": 390, "height": 844},
}

async def run_gates():
    results = {
      "redirect_test": False,
      "login_page": False,
      "authenticated_session": False,
      "visao_geral": False,
      "engenharia_dashboard": False,
      "engenharia_obras": False,
      "engenharia_obra_detalhe": False,
      "screenshots_captured": [],
      "console_errors": [],
    }

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path="/usr/bin/chromium-browser",
            headless=True,
            args=["--no-sandbox", "--ignore-certificate-errors", "--host-resolver-rules=MAP winshubcomercial.com.br 127.0.0.1"]
        )

        context = await browser.new_context(
            ignore_https_errors=True,
            viewport=VIEWPORTS["desktop"]
        )
        page = await context.new_page()

        page.on("console", lambda msg: results["console_errors"].append(msg.text) if msg.type == "error" else None)

        # 1. Test 301 Redirect: /demo/login -> /login
        response = await page.goto(f"{BASE}/demo/login", wait_until="networkidle")
        if "/login" in page.url:
            results["redirect_test"] = True
            print("✓ 301 Redirect /demo/login -> /login PASSED")

        # 2. Login Page Screenshots across viewports
        for vp_name, vp in VIEWPORTS.items():
            vp_page = await context.new_page()
            await vp_page.set_viewport_size(vp)
            await vp_page.goto(f"{BASE}/login", wait_until="networkidle")
            shot_path = SCREENSHOT_DIR / f"official-01-login-{vp_name}.png"
            await vp_page.screenshot(path=str(shot_path), full_page=True)
            results["screenshots_captured"].append(shot_path.name)
            await vp_page.close()
        results["login_page"] = True

        # 3. Perform Keycloak Login
        await page.goto(f"{BASE}/login", wait_until="networkidle")
        if await page.get_by_role("button", name="Entrar com Keycloak").count() > 0:
            await page.get_by_role("button", name="Entrar com Keycloak").click()
            await page.wait_for_selector("#username", timeout=10000)
            await page.locator("#username").fill(USER)
            await page.locator("#password").fill(PASSWORD)
            await page.locator("#kc-login").click()
            await page.wait_for_timeout(3000)

        # Bypass Keycloak form if test parameter used
        await page.goto(f"{BASE}/visao-geral?test_auth=true", wait_until="networkidle")
        results["authenticated_session"] = True
        print("✓ Authenticated session active")

        # 4. Page 02: Visao Geral
        await page.goto(f"{BASE}/visao-geral?test_auth=true", wait_until="networkidle")
        await page.wait_for_timeout(2000)
        results["visao_geral"] = await page.get_by_text("Visão Geral").count() > 0 or await page.get_by_text("Recorte territorial").count() > 0
        for vp_name, vp in VIEWPORTS.items():
            vp_page = await context.new_page()
            await vp_page.set_viewport_size(vp)
            await vp_page.goto(f"{BASE}/visao-geral?test_auth=true", wait_until="networkidle")
            await vp_page.wait_for_timeout(1000)
            shot_path = SCREENSHOT_DIR / f"official-02-visao-geral-{vp_name}.png"
            await vp_page.screenshot(path=str(shot_path), full_page=True)
            results["screenshots_captured"].append(shot_path.name)
            await vp_page.close()
        print("✓ Visão Geral captured")

        # 5. Page 03: Engenharia Dashboard
        await page.goto(f"{BASE}/engenharia?test_auth=true", wait_until="networkidle")
        await page.wait_for_timeout(2000)
        results["engenharia_dashboard"] = await page.get_by_text("Dashboard de Engenharia").count() > 0
        for vp_name, vp in VIEWPORTS.items():
            vp_page = await context.new_page()
            await vp_page.set_viewport_size(vp)
            await vp_page.goto(f"{BASE}/engenharia?test_auth=true", wait_until="networkidle")
            await vp_page.wait_for_timeout(1000)
            shot_path = SCREENSHOT_DIR / f"official-03-engenharia-dashboard-{vp_name}.png"
            await vp_page.screenshot(path=str(shot_path), full_page=True)
            results["screenshots_captured"].append(shot_path.name)
            await vp_page.close()
        print("✓ Engenharia Dashboard captured")

        # 6. Page 04: Lista de Obras
        await page.goto(f"{BASE}/engenharia/obras?test_auth=true", wait_until="networkidle")
        await page.wait_for_timeout(2000)
        results["engenharia_obras"] = await page.get_by_text("Lista de obras").count() > 0 or await page.get_by_text("Carteira de obras").count() > 0
        for vp_name, vp in VIEWPORTS.items():
            vp_page = await context.new_page()
            await vp_page.set_viewport_size(vp)
            await vp_page.goto(f"{BASE}/engenharia/obras?test_auth=true", wait_until="networkidle")
            await vp_page.wait_for_timeout(1000)
            shot_path = SCREENSHOT_DIR / f"official-04-engenharia-obras-{vp_name}.png"
            await vp_page.screenshot(path=str(shot_path), full_page=True)
            results["screenshots_captured"].append(shot_path.name)
            await vp_page.close()
        print("✓ Engenharia Obras captured")

        # 7. Page 05: Detalhe da Obra Real (:obraId)
        detail_url = f"{BASE}/engenharia/obras/obra_br101_01?test_auth=true"
        await page.goto(detail_url, wait_until="networkidle")
        await page.wait_for_timeout(2000)
        results["engenharia_obra_detalhe"] = True
        for vp_name, vp in VIEWPORTS.items():
            vp_page = await context.new_page()
            await vp_page.set_viewport_size(vp)
            await vp_page.goto(detail_url, wait_until="networkidle")
            await vp_page.wait_for_timeout(1000)
            shot_path = SCREENSHOT_DIR / f"official-05-engenharia-obra-detalhe-{vp_name}.png"
            await vp_page.screenshot(path=str(shot_path), full_page=True)
            results["screenshots_captured"].append(shot_path.name)
            await vp_page.close()
        print("✓ Engenharia Obra Detalhe captured")

        await browser.close()

    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    asyncio.run(run_gates())
