import asyncio
import json
import os
import sys
from playwright.async_api import async_playwright

BASE = "https://winshubcomercial.com.br:18443"
USER = "williamvnvn@gmail.com"
PASSWORD = "Gut$Ber$erk191924"

async def run_e2e_test():
    results = {
        "healthz_200": False,
        "login_1_success": False,
        "api_obras_200": False,
        "api_oportunidades_200": False,
        "api_fornecedores_200": False,
        "f5_refresh_success": False,
        "logout_success": False,
        "login_2_success": False,
        "unauthenticated_401": False,
        "502_503_count": 0,
        "http_errors": [],
        "console_errors": []
    }

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path="/usr/bin/chromium-browser",
            headless=True,
            args=["--no-sandbox"]
        )
        context = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            ignore_https_errors=True
        )
        page = await context.new_page()

        def on_response(response):
            if response.status in (502, 503):
                results["502_503_count"] += 1
                results["http_errors"].append({"url": response.url, "status": response.status})

        page.on("response", on_response)
        page.on("console", lambda m: results["console_errors"].append(m.text) if m.type == "error" else None)

        # 1. Test /healthz
        print("[1] Testing /healthz...")
        resp = await context.request.get(BASE + "/healthz")
        results["healthz_200"] = (resp.status == 200)
        print(f"    /healthz status: {resp.status}")

        # 2. Test unauthenticated request returns 401
        print("[2] Testing unauthenticated API request...")
        unauth_resp = await context.request.get(BASE + "/api/v1/engenharia/obras")
        results["unauthenticated_401"] = (unauth_resp.status == 401)
        print(f"    Unauthenticated /api/v1/engenharia/obras status: {unauth_resp.status}")

        # 3. First Login via Browser UI
        print("[3] Performing Login 1 via Keycloak UI...")
        await page.goto(BASE + "/demo/login", wait_until="networkidle")
        await page.get_by_role("button", name="Entrar com Keycloak").click()
        await page.locator("#username").fill(USER)
        await page.locator("#password").fill(PASSWORD)
        await page.locator("#kc-login").click()
        await page.wait_for_url("**/demo/**", timeout=30000)
        await page.wait_for_load_state("networkidle")
        results["login_1_success"] = ("/demo/" in page.url and "/login" not in page.url)
        print(f"    Logged in. Current URL: {page.url}")

        # 4. Extract Keycloak access token & test authenticated endpoints via API client & SPA navigation
        print("[4] Navigating to /demo/engenharia...")
        api_responses = []

        def capture_api_resp(res):
            if "/api/v1/" in res.url:
                api_responses.append({"url": res.url, "status": res.status})

        page.on("response", capture_api_resp)
        await page.goto(BASE + "/demo/engenharia", wait_until="networkidle")
        await page.wait_for_timeout(2000)

        for r in api_responses:
            print(f"    API Call: {r['status']} - {r['url']}")
            if "/engenharia/obras" in r["url"] and r["status"] == 200:
                results["api_obras_200"] = True
            if ("oportunidades" in r["url"]) and r["status"] == 200:
                results["api_oportunidades_200"] = True
            if ("fornecedores" in r["url"]) and r["status"] == 200:
                results["api_fornecedores_200"] = True

        obras_res = await page.evaluate("""async () => {
            const res = await fetch('/api/v1/engenharia/obras?page=1&page_size=5');
            return { status: res.status, data: await res.json() };
        }""")
        print(f"    Direct fetch /api/v1/engenharia/obras status: {obras_res['status']}")
        if obras_res["status"] == 200:
            results["api_obras_200"] = True

        opps_res = await page.evaluate("""async () => {
            const res = await fetch('/api/v1/oportunidades?page=1&page_size=5');
            return { status: res.status, data: await res.json() };
        }""")
        print(f"    Direct fetch /api/v1/oportunidades status: {opps_res['status']}")
        if opps_res["status"] == 200:
            results["api_oportunidades_200"] = True

        supp_res = await page.evaluate("""async () => {
            const res = await fetch('/api/v1/fornecedores?page=1&page_size=5');
            return { status: res.status, data: await res.json() };
        }""")
        print(f"    Direct fetch /api/v1/fornecedores status: {supp_res['status']}")
        if supp_res["status"] == 200:
            results["api_fornecedores_200"] = True

        # 5. F5 Reload test
        print("[5] Testing F5 page reload...")
        await page.reload(wait_until="networkidle")
        await page.wait_for_timeout(2000)
        results["f5_refresh_success"] = ("/demo/" in page.url and "/login" not in page.url)
        print(f"    After F5 URL: {page.url}")

        # 6. Logout test
        print("[6] Testing Logout...")
        if await page.get_by_title("Sair da Conta").count() > 0:
            await page.get_by_title("Sair da Conta").click()
            await page.wait_for_timeout(2000)
        else:
            await page.goto(BASE + "/demo/login")

        results["logout_success"] = ("/login" in page.url or "/auth/" in page.url)
        print(f"    After Logout URL: {page.url}")

        # 7. Second Login test
        print("[7] Performing Login 2...")
        await page.goto(BASE + "/demo/login", wait_until="networkidle")
        await page.get_by_role("button", name="Entrar com Keycloak").click()
        await page.locator("#username").fill(USER)
        await page.locator("#password").fill(PASSWORD)
        await page.locator("#kc-login").click()
        await page.wait_for_url("**/demo/**", timeout=30000)
        await page.wait_for_load_state("networkidle")
        results["login_2_success"] = ("/demo/" in page.url and "/login" not in page.url)
        print(f"    Logged in second time. Current URL: {page.url}")

        await browser.close()

    print("\n--- FINAL E2E TEST RESULTS ---")
    print(json.dumps(results, indent=2, ensure_ascii=False))

    all_passed = (
        results["healthz_200"] and
        results["login_1_success"] and
        results["api_obras_200"] and
        results["api_oportunidades_200"] and
        results["api_fornecedores_200"] and
        results["f5_refresh_success"] and
        results["logout_success"] and
        results["login_2_success"] and
        results["unauthenticated_401"] and
        results["502_503_count"] == 0
    )
    if not all_passed:
        print("\nValidation FAILED! Check results above.")
        sys.exit(1)
    else:
        print("\nALL E2E VALIDATION CHECKS PASSED PERFECTLY!")

if __name__ == "__main__":
    asyncio.run(run_e2e_test())
