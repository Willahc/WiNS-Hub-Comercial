import asyncio
import json
import os
import time
from playwright.async_api import async_playwright

BASE = "https://winshubcomercial.com.br:18443"
REAL_ID = "fffe0b6f-d2df-4b59-8750-2daefa440cd6"
USER = "ui-gate-homolog"
PASSWORD = os.environ.get("WINS_HUB_GATE_PASSWORD", "Ht1ZhNQHflDHMXCsUGnbjIvxlHDLl8Vm5nt8TK0efJLfdRO4")

async def run_verify():
    requests_logged = []
    direct_18081_calls = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path="/usr/bin/chromium-browser",
            headless=True,
            args=["--no-sandbox", "--ignore-certificate-errors", "--host-resolver-rules=MAP winshubcomercial.com.br 127.0.0.1"]
        )

        context = await browser.new_context(ignore_https_errors=True, viewport={"width": 1920, "height": 1080})
        page = await context.new_page()

        # Login Keycloak
        await page.goto(f"{BASE}/login", wait_until="networkidle")
        if await page.get_by_role("button", name="Entrar com Keycloak").count() > 0:
            await page.get_by_role("button", name="Entrar com Keycloak").click()
            await page.wait_for_selector("#username", timeout=10000)
            await page.locator("#username").fill(USER)
            await page.locator("#password").fill(PASSWORD)
            await page.locator("#kc-login").click()
            await page.wait_for_timeout(3000)

        async def handle_request(req):
            url = req.url
            if "18081" in url:
                direct_18081_calls.append(url)
            if f"/obras/{REAL_ID}" in url or "api/v1/engenharia/obras" in url or "api/engenharia/obras" in url:
                has_bearer = "authorization" in req.headers and "bearer" in req.headers["authorization"].lower()
                requests_logged.append({
                    "url": url,
                    "method": req.method,
                    "has_bearer_token": has_bearer,
                    "start_time": time.time()
                })

        async def handle_response(resp):
            url = resp.url
            for r in requests_logged:
                if r["url"] == url and "status" not in r:
                    r["status"] = resp.status
                    r["content_type"] = resp.headers.get("content-type", "")
                    r["duration_ms"] = round((time.time() - r["start_time"]) * 1000, 2)

        page.on("request", handle_request)
        page.on("response", handle_response)

        # Navigate to Page 05
        target_url = f"{BASE}/engenharia/obras/{REAL_ID}"
        response = await page.goto(target_url, wait_until="networkidle")
        await page.wait_for_timeout(2000)

        await browser.close()

    result = {
        "page_url": target_url,
        "direct_18081_calls_count": len(direct_18081_calls),
        "requests_logged": requests_logged
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    asyncio.run(run_verify())
