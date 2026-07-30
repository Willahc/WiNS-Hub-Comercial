import asyncio
import json
import os
import time
from playwright.async_api import async_playwright

BASE_URL = "https://winshubcomercial.com.br:18443"
USER = "ui-gate-homolog"
PASSWORD = os.environ.get("WINS_HUB_GATE_PASSWORD", "Ht1ZhNQHflDHMXCsUGnbjIvxlHDLl8Vm5nt8TK0efJLfdRO4")

async def verify_telemetry():
    responses_log = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path="/usr/bin/chromium-browser",
            headless=True,
            args=["--no-sandbox", "--ignore-certificate-errors", "--host-resolver-rules=MAP winshubcomercial.com.br 127.0.0.1"]
        )

        context = await browser.new_context(ignore_https_errors=True, viewport={"width": 1920, "height": 1080})
        page = await context.new_page()

        # Login Keycloak
        await page.goto(f"{BASE_URL}/login", wait_until="networkidle")
        if await page.get_by_role("button", name="Entrar com Keycloak").count() > 0:
            await page.get_by_role("button", name="Entrar com Keycloak").click()
            await page.wait_for_selector("#username", timeout=10000)
            await page.locator("#username").fill(USER)
            await page.locator("#password").fill(PASSWORD)
            await page.locator("#kc-login").click()
            await page.wait_for_timeout(3000)

        async def handle_response(resp):
            url = resp.url
            if "/api/" in url:
                auth_hdr = "SIM" if "authorization" in resp.request.headers and resp.request.headers["authorization"].startswith("Bearer ") else "NÃO"
                t = time.strftime("%H:%M:%S", time.gmtime())
                
                payload_count = 0
                try:
                    body = await resp.json()
                    if isinstance(body, dict) and "items" in body:
                        payload_count = len(body["items"])
                    elif isinstance(body, list):
                        payload_count = len(body)
                    elif isinstance(body, dict):
                        payload_count = 1
                except Exception:
                    pass

                responses_log.append({
                    "timestamp": t,
                    "method": resp.request.method,
                    "url": url,
                    "status": resp.status,
                    "content_type": resp.headers.get("content-type", ""),
                    "origin": "Rede (HTTP/1.1)",
                    "has_authorization": auth_hdr,
                    "payload_records": payload_count
                })

        page.on("response", handle_response)

        print("[Telemetry Audit] Navegando para /engenharia...")
        await page.goto(f"{BASE_URL}/engenharia", wait_until="networkidle")
        await page.wait_for_timeout(4000)

        await browser.close()

    print("=== TELEMETRY RAW BREAKDOWN FOR /engenharia ===")
    print(json.dumps(responses_log, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    asyncio.run(verify_telemetry())
