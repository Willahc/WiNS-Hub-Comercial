import sys
import os
import json
import time
from playwright.sync_api import sync_playwright

def test_full_keycloak_sso_persistence():
    screenshots_dir = "/root/wins_hub_unificado/scratch/screenshots_sso_real_user"
    os.makedirs(screenshots_dir, exist_ok=True)

    url_base = "https://winshubcomercial.com.br:18443/demo/login"

    console_errors = []
    failed_requests = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--ignore-certificate-errors"])
        context = browser.new_context(ignore_https_errors=True)
        page = context.new_page()

        # Monitor console errors and 401s
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("response", lambda res: failed_requests.append(f"{res.status} {res.url}") if res.status in [401, 500, 502, 503] else None)

        print("--- Step 1: Open /demo/login ---")
        page.goto(url_base, wait_until="networkidle")
        page.wait_for_timeout(1000)

        print("--- Step 2: Click 'Entrar com Keycloak' ---")
        login_btn = page.query_selector("button:has-text('Entrar com Keycloak'), button.btn-primary")
        if login_btn:
            login_btn.click()
            page.wait_for_timeout(2000)

        # Check Keycloak login form if presented
        if "auth/realms" in page.url:
            print(f"Landed on Keycloak login page: {page.url}")
            page.screenshot(path=f"{screenshots_dir}/step2_keycloak_form.png", full_page=True)

            # Fill Keycloak credentials if username field exists
            user_input = page.query_selector("input#username, input[name='username']")
            pass_input = page.query_selector("input#password, input[name='password']")
            if user_input and pass_input:
                print("Entering Keycloak credentials for William...")
                user_input.fill("william")  # or test user
                pass_input.fill("william123") # or test user pass
                submit_btn = page.query_selector("input#kc-login, input[type='submit']")
                if submit_btn:
                    submit_btn.click()
                    page.wait_for_timeout(3000)

        print(f"URL after authentication callback: {page.url}")
        page.screenshot(path=f"{screenshots_dir}/step3_authenticated_page.png", full_page=True)

        print("\n--- Step 3: Test F5 Refresh ---")
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(2000)
        url_f5 = page.url
        print(f"URL after F5: {url_f5}")
        page.screenshot(path=f"{screenshots_dir}/step4_after_f5.png", full_page=True)

        print("\n--- Step 4: Test Ctrl+F5 (Hard Reload) ---")
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(2000)
        url_ctrl_f5 = page.url
        print(f"URL after Ctrl+F5: {url_ctrl_f5}")
        page.screenshot(path=f"{screenshots_dir}/step5_after_ctrl_f5.png", full_page=True)

        print("\n--- Step 5: Test Opening Internal Route in New Tab ---")
        page2 = context.new_page()
        page2.goto("https://winshubcomercial.com.br:18443/demo/engenharia", wait_until="networkidle")
        page2.wait_for_timeout(2000)
        url_tab = page2.url
        print(f"URL in new tab (/demo/engenharia): {url_tab}")
        page2.screenshot(path=f"{screenshots_dir}/step6_new_tab.png", full_page=True)

        print("\n--- Step 6: Test Redeploy / Bundle Reload ---")
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(2000)
        url_redeploy = page.url
        print(f"URL after redeploy reload: {url_redeploy}")

        print("\n--- Final Verification Summary ---")
        print(f"Console errors: {len(console_errors)}")
        print(f"Failed HTTP requests: {len(failed_requests)}")

        browser.close()

if __name__ == "__main__":
    test_full_keycloak_sso_persistence()
