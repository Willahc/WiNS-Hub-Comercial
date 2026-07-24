import sys
import os
import json
from playwright.sync_api import sync_playwright

def inspect_dom():
    url = "https://winshubcomercial.com.br:18443/demo/engenharia"
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--ignore-certificate-errors"])
        context = browser.new_context(ignore_https_errors=True)
        page = context.new_page()

        page.goto(url, wait_until="networkidle")
        page.evaluate("localStorage.setItem('hub_token', 'mock_jwt_token_wave1')")
        page.evaluate("localStorage.setItem('hub_user', JSON.stringify({id: 'admin', name: 'Antigravity Admin', email: 'admin@winshub.com'}))")
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(2000)

        print("Current URL:", page.url)
        print("Page Title:", page.title())
        print("Root content:", page.evaluate("document.querySelector('#root')?.innerHTML.substring(0, 300)"))
        
        # Check all class names on page
        class_names = page.evaluate("""() => {
            const set = new Set();
            document.querySelectorAll('*').forEach(el => {
                if (el.className && typeof el.className === 'string') {
                    el.className.split(' ').forEach(c => c && set.add(c));
                }
            });
            return Array.from(set);
        }""")
        print("Rendered CSS class names:", class_names)

        browser.close()

if __name__ == "__main__":
    inspect_dom()
