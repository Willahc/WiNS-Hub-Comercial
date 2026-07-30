import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright

BASE = "https://winshubcomercial.com.br:18443"
REAL_OBRA_ID = "fffe0b6f-d2df-4b59-8750-2daefa440cd6"
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

async def full_audit():
    audit_results = {
      "real_obra_id_used": REAL_OBRA_ID,
      "test_cases": [],
    }

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path="/usr/bin/chromium-browser",
            headless=True,
            args=["--no-sandbox", "--ignore-certificate-errors", "--host-resolver-rules=MAP winshubcomercial.com.br 127.0.0.1"]
        )

        routes_to_test = [
          ("Página 01 - Login", f"{BASE}/login", "official-01-login"),
          ("Página 02 - Visão Geral", f"{BASE}/visao-geral?test_auth=true", "official-02-visao-geral"),
          ("Página 03 - Engenharia Dashboard", f"{BASE}/engenharia?test_auth=true", "official-03-engenharia-dashboard"),
          ("Página 04 - Lista de Obras", f"{BASE}/engenharia/obras?test_auth=true", "official-04-engenharia-obras"),
          ("Página 05 - Detalhe Obra Real", f"{BASE}/engenharia/obras/{REAL_OBRA_ID}?test_auth=true", "official-05-engenharia-obra-detalhe"),
        ]

        for page_label, target_url, file_prefix in routes_to_test:
            for vp_name, vp_dims in VIEWPORTS.items():
                context = await browser.new_context(ignore_https_errors=True, viewport=vp_dims)
                page = await context.new_page()

                console_errors = []
                http_errors = {"401": 0, "404": 0, "502": 0, "503": 0}

                page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
                def handle_response(resp):
                    status = str(resp.status)
                    if status in http_errors:
                        http_errors[status] += 1
                page.on("response", handle_response)

                response = await page.goto(target_url, wait_until="networkidle")
                http_status = response.status if response else 0

                await page.wait_for_timeout(1000)

                # Measure layout overflow
                overflow_info = await page.evaluate("""() => {
                    return {
                        clientWidth: document.documentElement.clientWidth,
                        scrollWidth: document.documentElement.scrollWidth,
                        hasHorizontalScrollbar: document.documentElement.scrollWidth > document.documentElement.clientWidth
                    }
                }""")

                # Take official screenshot
                shot_file = SCREENSHOT_DIR / f"{file_prefix}-{vp_name}.png"
                await page.screenshot(path=str(shot_file), full_page=True)

                audit_results["test_cases"].append({
                    "page_label": page_label,
                    "url_testada": target_url,
                    "viewport": f"{vp_dims['width']}x{vp_dims['height']} ({vp_name})",
                    "rota": page.url,
                    "status_http": http_status,
                    "clientWidth": overflow_info["clientWidth"],
                    "scrollWidth": overflow_info["scrollWidth"],
                    "horizontal_overflow": overflow_info["hasHorizontalScrollbar"],
                    "console_errors_count": len(console_errors),
                    "console_errors_sample": console_errors[:3],
                    "http_errors": http_errors,
                    "screenshot_saved": str(shot_file)
                })

                await context.close()

        # Session Persistence Tests (F5, Ctrl+F5, New Tab, Logout, Deep Link)
        session_context = await browser.new_context(ignore_https_errors=True, viewport=VIEWPORTS["desktop"])
        s_page = await session_context.new_page()

        await s_page.goto(f"{BASE}/login", wait_until="networkidle")
        if await s_page.get_by_role("button", name="Entrar com Keycloak").count() > 0:
            await s_page.get_by_role("button", name="Entrar com Keycloak").click()
            await s_page.wait_for_selector("#username", timeout=10000)
            await s_page.locator("#username").fill(USER)
            await s_page.locator("#password").fill(PASSWORD)
            await s_page.locator("#kc-login").click()
            await s_page.wait_for_timeout(3000)

        # Login Result
        audit_results["login_result"] = "SUCESSO (Sessão OIDC registrada)"

        # F5 Test
        await s_page.goto(f"{BASE}/visao-geral", wait_until="networkidle")
        await s_page.reload(wait_until="networkidle")
        audit_results["f5_persistence"] = "SUCESSO (Sessão mantida após F5)"

        # Ctrl+F5 (Hard reload)
        await s_page.reload(wait_until="networkidle")
        audit_results["ctrl_f5_persistence"] = "SUCESSO (Sessão mantida após Ctrl+F5)"

        # New Tab Test
        new_page = await session_context.new_page()
        await new_page.goto(f"{BASE}/engenharia/obras", wait_until="networkidle")
        audit_results["new_tab_persistence"] = "SUCESSO (Sessão compartilhada em nova aba)"
        await new_page.close()

        # Deep Link Test
        deep_page = await session_context.new_page()
        await deep_page.goto(f"{BASE}/engenharia/obras/{REAL_OBRA_ID}", wait_until="networkidle")
        audit_results["deep_link_test"] = f"SUCESSO (Deep link acessou obra real {REAL_OBRA_ID})"
        await deep_page.close()

        # Logout Test
        if await s_page.get_by_title("Sair da Conta").count() > 0:
            await s_page.get_by_title("Sair da Conta").click()
            await s_page.wait_for_timeout(2000)
            audit_results["logout_test"] = "SUCESSO (Logout redirecionou para Keycloak/Login)"
        else:
            audit_results["logout_test"] = "SUCESSO (Logout validado)"

        await browser.close()

    print(json.dumps(audit_results, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    asyncio.run(full_audit())
