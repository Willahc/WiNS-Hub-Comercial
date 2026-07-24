import sys
import os
import time
from playwright.sync_api import sync_playwright

def run_tests():
    screenshots_dir = "/root/wins_hub_unificado/scratch/screenshots_v2"
    os.makedirs(screenshots_dir, exist_ok=True)

    test_resolutions = [
        {"name": "desktop_1920x1080", "width": 1920, "height": 1080},
        {"name": "desktop_1536x864", "width": 1536, "height": 864},
        {"name": "laptop_1366x768", "width": 1366, "height": 768},
        {"name": "desktop_1280x720", "width": 1280, "height": 720},
        {"name": "tablet_1024x768", "width": 1024, "height": 768},
        {"name": "tablet_768x1024", "width": 768, "height": 1024},
        {"name": "mobile_390x844", "width": 390, "height": 844},
    ]

    results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--ignore-certificate-errors"])
        context = browser.new_context(ignore_https_errors=True)
        page = context.new_page()

        # Set localStorage authentication token
        page.goto("https://winshubcomercial.com.br:18443/engenharia", wait_until="networkidle")
        page.evaluate("localStorage.setItem('hub_token', 'mock_jwt_token_wave1')")
        page.evaluate("localStorage.setItem('hub_user', JSON.stringify({id: 'admin', name: 'Antigravity Admin', email: 'admin@winshub.com'}))")

        for res in test_resolutions:
            page.set_viewport_size({"width": res["width"], "height": res["height"]})
            page.goto("https://winshubcomercial.com.br:18443/engenharia", wait_until="networkidle")
            page.wait_for_timeout(1500)

            # Measure scrollWidth vs clientWidth
            doc_scroll = page.evaluate("document.documentElement.scrollWidth")
            doc_client = page.evaluate("document.documentElement.clientWidth")
            body_scroll = page.evaluate("document.body.scrollWidth")
            body_client = page.evaluate("document.body.clientWidth")
            
            # Click to toggle advanced filters to test expanded state
            advanced_btn = page.query_selector("button:has-text('Filtros avançados')")
            if advanced_btn:
                advanced_btn.click()
                page.wait_for_timeout(500)

            doc_scroll_exp = page.evaluate("document.documentElement.scrollWidth")
            doc_client_exp = page.evaluate("document.documentElement.clientWidth")
            
            has_overflow = (doc_scroll > doc_client) or (doc_scroll_exp > doc_client_exp)

            result_entry = {
                "name": res["name"],
                "width": res["width"],
                "height": res["height"],
                "scroll_width": doc_scroll_exp,
                "client_width": doc_client_exp,
                "overflow": has_overflow,
            }
            results.append(result_entry)
            print(f"Resolution {res['name']}: scrollWidth={doc_scroll_exp}, clientWidth={doc_client_exp}, overflow={has_overflow}")

            # Capture screenshots for key sizes
            if res["name"] in ["desktop_1920x1080", "laptop_1366x768", "mobile_390x844"]:
                screenshot_path = os.path.join(screenshots_dir, f"engineering_{res['name']}.png")
                page.screenshot(path=screenshot_path, full_page=True)
                print(f"Saved screenshot: {screenshot_path}")

        browser.close()

    return results

if __name__ == "__main__":
    run_tests()
