import sys
import os
import json
from playwright.sync_api import sync_playwright

def test_login_and_navigate():
    url_login = "https://winshubcomercial.com.br:18443/demo/login"
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--ignore-certificate-errors"])
        context = browser.new_context(ignore_https_errors=True)
        page = context.new_page()

        page.goto(url_login, wait_until="networkidle")
        print("Initial URL:", page.url)

        # Click Entrar button on login page
        login_btn = page.query_selector("button.btn-primary, button:has-text('Entrar')")
        if login_btn:
            print("Found login button, clicking...")
            login_btn.click()
            page.wait_for_timeout(1500)

        print("URL after login:", page.url)

        # Navigate to engenharia
        page.goto("https://winshubcomercial.com.br:18443/demo/engenharia", wait_until="networkidle")
        page.wait_for_timeout(2000)
        print("URL after navigating to engenharia:", page.url)
        print("Page Title:", page.title())

        # Check if filter panel exists
        filter_panel = page.query_selector(".filter-panel")
        print("Filter panel found:", filter_panel is not None)

        browser.close()

if __name__ == "__main__":
    test_login_and_navigate()
