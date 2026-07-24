import sys
import os
import time
from playwright.sync_api import sync_playwright

def run_tests():
    screenshots_dir = "/root/wins_hub_unificado/scratch/screenshots"
    os.makedirs(screenshots_dir, exist_ok=True)
    
    viewports = [
        {"name": "desktop_1920", "width": 1920, "height": 1080},
        {"name": "laptop_1366", "width": 1366, "height": 768},
        {"name": "mobile_375", "width": 375, "height": 812},
    ]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--ignore-certificate-errors"])
        context = browser.new_context(ignore_https_errors=True)
        page = context.new_page()

        # Set localStorage authentication token
        page.goto("https://winshubcomercial.com.br:18443/engenharia", wait_until="networkidle")
        page.evaluate("localStorage.setItem('hub_token', 'mock_jwt_token_wave1')")
        page.evaluate("localStorage.setItem('hub_user', JSON.stringify({id: 'admin', name: 'Antigravity Admin', email: 'admin@winshub.com'}))")

        for vp in viewports:
            print(f"Testing viewport: {vp['name']} ({vp['width']}x{vp['height']})")
            page.set_viewport_size({"width": vp["width"], "height": vp["height"]})
            page.goto("https://winshubcomercial.com.br:18443/engenharia", wait_until="networkidle")
            page.wait_for_timeout(2000)

            # Check for horizontal scrollbar on body
            scroll_width = page.evaluate("document.documentElement.scrollWidth")
            client_width = page.evaluate("document.documentElement.clientWidth")
            has_horizontal_overflow = scroll_width > client_width
            print(f"Viewport {vp['name']}: scrollWidth={scroll_width}, clientWidth={client_width}, overflow={has_horizontal_overflow}")

            # Take screenshot
            screenshot_path = os.path.join(screenshots_dir, f"dashboard_engenharia_{vp['name']}.png")
            page.screenshot(path=screenshot_path, full_page=True)
            print(f"Saved screenshot: {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    run_tests()
