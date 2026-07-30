import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright

BASE = "https://winshubcomercial.com.br:18443"
USER = os.environ["WINS_HUB_GATE_USER"]
PASSWORD = os.environ["WINS_HUB_GATE_PASSWORD"]
if USER.casefold() == "williamvnvn@gmail.com":
    raise RuntimeError("Usuários humanos não podem ser usados por gates automatizados")
STATE = "/tmp/wins_gate_auth_state.json"

async def login(page, result, label):
    token_events = []
    async def inspect_response(response):
        if "/protocol/openid-connect/token" not in response.url:
            return
        request = response.request
        body = request.post_data or ""
        keys = sorted({part.split("=", 1)[0] for part in body.split("&") if "=" in part})
        event = {"status": response.status, "request_keys": keys}
        try:
            payload = await response.json()
            event.update({
                "has_access_token": bool(payload.get("access_token")),
                "has_refresh_token": bool(payload.get("refresh_token")),
                "expires_in": payload.get("expires_in"),
                "refresh_expires_in": payload.get("refresh_expires_in"),
                "error": payload.get("error"),
                "error_description": payload.get("error_description"),
            })
        except Exception:
            pass
        token_events.append(event)
    page.on("response", inspect_response)
    await page.goto(BASE + "/demo/login", wait_until="networkidle")
    await page.get_by_role("button", name="Entrar com Keycloak").click()
    await page.locator("#username").fill(USER)
    await page.locator("#password").fill(PASSWORD)
    await page.locator("#kc-login").click()
    await page.wait_for_url("**/demo/**", timeout=30000)
    await page.wait_for_load_state("networkidle")
    page.remove_listener("response", inspect_response)
    result[label] = {
        "url": page.url,
        "token_events": token_events,
        "user_visible": await page.get_by_text("William William").count() > 0,
        "roles_visible": await page.locator(".topbar").inner_text(),
    }

async def main():
    result = {"console_errors": [], "http_errors": [], "api_responses": []}
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path="/usr/bin/chromium-browser", headless=True, args=["--no-sandbox"])
        context = await browser.new_context(ignore_https_errors=False, viewport={"width": 1440, "height": 900})
        page = await context.new_page()
        page.on("console", lambda m: result["console_errors"].append(m.text) if m.type == "error" else None)
        page.on("response", lambda r: result["http_errors"].append({"status": r.status, "url": r.url}) if r.status >= 400 else None)
        page.on("response", lambda r: result["api_responses"].append({"status": r.status, "url": r.url}) if r.url.startswith(BASE + "/api/") else None)
        await login(page, result, "first_login")
        await page.goto(BASE + "/demo/agro", wait_until="networkidle")
        result["api_authenticated"] = any(r["status"] == 200 for r in result["api_responses"])
        result["agro_visible"] = await page.get_by_text("Inteligência Agro Real").count() > 0
        await context.storage_state(path=STATE)
        if await page.get_by_title("Sair da Conta").count():
            await page.get_by_title("Sair da Conta").click()
            await page.wait_for_timeout(1500)
        result["logout_url"] = page.url
        await context.clear_cookies()
        await page.evaluate("localStorage.clear(); sessionStorage.clear()")
        await login(page, result, "second_login")
        result["invalid_grant_count"] = sum(
            1 for key in ("first_login", "second_login")
            for event in result[key]["token_events"] if event.get("error") == "invalid_grant"
        )
        await browser.close()
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
