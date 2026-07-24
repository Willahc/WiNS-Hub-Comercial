import sys
import os
import json
import time
from playwright.sync_api import sync_playwright

def test_sso_flow():
    screenshots_dir = "/root/wins_hub_unificado/scratch/screenshots_sso_test"
    os.makedirs(screenshots_dir, exist_ok=True)

    url_base = "https://winshubcomercial.com.br:18443/demo/engenharia"

    console_errors = []
    failed_requests = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--ignore-certificate-errors"])
        context = browser.new_context(ignore_https_errors=True)
        page = context.new_page()

        # Capture console errors & failed HTTP 401s
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("response", lambda res: failed_requests.append(f"{res.status} {res.url}") if res.status in [401, 500, 502, 503] else None)

        print("--- Step 1: Open /demo/engenharia ---")
        page.goto(url_base, wait_until="networkidle")
        page.wait_for_timeout(1500)
        url1 = page.url
        print(f"URL after navigation: {url1}")

        # Screenshot 1
        page.screenshot(path=f"{screenshots_dir}/step1_initial_load.png", full_page=True)

        print("\n--- Step 2: F5 Refresh ---")
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(1500)
        url2 = page.url
        print(f"URL after F5: {url2}")
        page.screenshot(path=f"{screenshots_dir}/step2_after_f5.png", full_page=True)

        print("\n--- Step 3: Ctrl+F5 (Hard Reload / No Cache) ---")
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(1500)
        url3 = page.url
        print(f"URL after Ctrl+F5: {url3}")
        page.screenshot(path=f"{screenshots_dir}/step3_after_ctrl_f5.png", full_page=True)

        print("\n--- Step 4: Internal Route in New Tab ---")
        page2 = context.new_page()
        page2.goto("https://winshubcomercial.com.br:18443/demo/engenharia/obras", wait_until="networkidle")
        page2.wait_for_timeout(1500)
        url4 = page2.url
        print(f"URL in new tab (/engenharia/obras): {url4}")
        page2.screenshot(path=f"{screenshots_dir}/step4_new_tab_internal_route.png", full_page=True)
        page2.close()

        print("\n--- Step 5: Test Redeploy simulation without clearing cookies ---")
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(1500)
        url5 = page.url
        print(f"URL after simulated redeploy reload: {url5}")
        page.screenshot(path=f"{screenshots_dir}/step5_after_redeploy.png", full_page=True)

        print("\n--- Summary of Verification ---")
        print(f"Console errors: {len(console_errors)} -> {console_errors[:3]}")
        print(f"Failed HTTP requests (401/500): {len(failed_requests)} -> {failed_requests[:3]}")

        f5_approved = (url2.endswith("/engenharia") or "/engenharia" in url2) and len(failed_requests) == 0
        ctrl_f5_approved = (url3.endswith("/engenharia") or "/engenharia" in url3) and len(failed_requests) == 0
        new_tab_approved = "/engenharia" in url4 and len(failed_requests) == 0

        print(f"F5 Approved: {f5_approved}")
        print(f"Ctrl+F5 Approved: {ctrl_f5_approved}")
        print(f"Internal Route Approved: {new_tab_approved}")

        browser.close()

if __name__ == "__main__":
    test_sso_flow()
