import sys
import os
import json
from playwright.sync_api import sync_playwright

def diagnose_url(url, vp_name, width, height, collapse_sidebar=True):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--ignore-certificate-errors"])
        context = browser.new_context(ignore_https_errors=True)
        page = context.new_page()

        page.set_viewport_size({"width": width, "height": height})
        page.goto(url, wait_until="networkidle")
        page.evaluate("localStorage.setItem('hub_token', 'mock_jwt_token_wave1')")
        page.evaluate("localStorage.setItem('hub_user', JSON.stringify({id: 'admin', name: 'Antigravity Admin', email: 'admin@winshub.com'}))")
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(1500)

        # Toggle sidebar if requested
        if collapse_sidebar:
            sidebar_toggle = page.query_selector(".sidebar-toggle, button[aria-label='Alternar sidebar'], .toggle-sidebar")
            if sidebar_toggle:
                sidebar_toggle.click()
                page.wait_for_timeout(500)

        # Ensure advanced filters are expanded
        adv_btn = page.query_selector("button:has-text('Filtros avançados')")
        if adv_btn:
            adv_btn.click()
            page.wait_for_timeout(500)

        # Force all overflow-x to visible to reveal hidden overflows
        page.evaluate("""() => {
            const style = document.createElement('style');
            style.id = 'force-overflow-visible';
            style.innerHTML = '* { overflow-x: visible !important; }';
            document.head.appendChild(style);
        }""")

        vw = page.evaluate("window.innerWidth")
        doc_scroll = page.evaluate("document.documentElement.scrollWidth")
        doc_client = page.evaluate("document.documentElement.clientWidth")
        body_scroll = page.evaluate("document.body.scrollWidth")

        print(f"\n--- URL: {url} | VP: {vp_name} ({width}x{height}) ---")
        print(f"innerWidth: {vw}, doc_scroll: {doc_scroll}, doc_client: {doc_client}, body_scroll: {body_scroll}")

        # Check containers
        containers_info = page.evaluate("""() => {
            const res = {};
            const selectors = ['.app-container', '.sidebar', '.main-content', '.engineering-page', '.filter-panel', '.filter-grid-basic', '.filter-grid-advanced', '.filter-actions'];
            selectors.forEach(sel => {
                const el = document.querySelector(sel);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    res[sel] = {
                        left: rect.left,
                        right: rect.right,
                        width: rect.width,
                        minWidth: style.minWidth,
                        maxWidth: style.maxWidth,
                        overflowX: style.overflowX,
                        display: style.display,
                        gridTemplateColumns: style.gridTemplateColumns
                    };
                }
            });
            return res;
        }""")
        print("Containers info:", json.dumps(containers_info, indent=2))

        # Find all elements exceeding viewport right
        overflowing_elements = page.evaluate("""(vw) => {
            const elements = Array.from(document.querySelectorAll('*'));
            const results = [];
            for (const el of elements) {
                const rect = el.getBoundingClientRect();
                if (rect.right > vw + 1) {
                    results.push({
                        tagName: el.tagName,
                        className: el.className,
                        id: el.id,
                        rect: {
                            left: rect.left,
                            right: rect.right,
                            width: rect.width,
                            overflowPixels: rect.right - vw
                        },
                        outerHTML: el.outerHTML.substring(0, 150)
                    });
                }
            }
            return results;
        }""", vw)

        print(f"Found {len(overflowing_elements)} elements with right > viewport width ({vw}px):")
        for i, el in enumerate(overflowing_elements[:15]):
            print(f"[{i+1}] <{el['tagName']} class='{el['className']}' id='{el['id']}'> | right: {el['rect']['right']:.1f}px | overflow: +{el['rect']['overflowPixels']:.1f}px")
            print(f"     HTML: {el['outerHTML']}")

        browser.close()

if __name__ == "__main__":
    diagnose_url("https://winshubcomercial.com.br:18443/demo/engenharia", "desktop_1920", 1920, 1080, collapse_sidebar=True)
    diagnose_url("https://winshubcomercial.com.br:18443/demo/engenharia", "laptop_1366", 1366, 768, collapse_sidebar=True)
    diagnose_url("https://winshubcomercial.com.br:18443/demo/engenharia", "laptop_1280", 1280, 720, collapse_sidebar=True)
