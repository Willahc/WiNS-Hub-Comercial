import sys
import os
import json
import time
from playwright.sync_api import sync_playwright

def test_visao_geral():
    screenshots_dir = "/root/wins_hub_unificado/scratch/screenshots_visao_geral"
    os.makedirs(screenshots_dir, exist_ok=True)

    url = "https://winshubcomercial.com.br:18443/demo/visao-geral"

    resolutions = [
        {"name": "1920x1080", "w": 1920, "h": 1080},
        {"name": "1366x768", "w": 1366, "h": 768},
        {"name": "390x844", "w": 390, "h": 844},
    ]

    zooms = [1.0, 1.25]
    console_errors = []
    failed_requests = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--ignore-certificate-errors"])

        for res in resolutions:
            for zoom in zooms:
                context = browser.new_context(
                    viewport={"width": res["w"], "height": res["h"]},
                    device_scale_factor=zoom,
                    ignore_https_errors=True
                )
                page = context.new_page()
                page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
                page.on("response", lambda r: failed_requests.append(f"{r.status} {r.url}") if r.status in [401, 502, 503] else None)

                page.goto(url, wait_until="networkidle")
                page.wait_for_timeout(1200)

                # Check scrollWidth vs clientWidth
                doc_scroll = page.evaluate("document.documentElement.scrollWidth")
                doc_client = page.evaluate("document.documentElement.clientWidth")
                vw = page.evaluate("window.innerWidth")

                # Measure overflow elements
                overflows = page.evaluate("""(vw) => {
                    const els = Array.from(document.querySelectorAll('*'));
                    const bad = [];
                    for (const el of els) {
                        if (el.className && typeof el.className === 'string' && el.className.includes('leaflet-')) continue;
                        const rect = el.getBoundingClientRect();
                        if (rect.right > vw + 1) {
                            bad.push({
                                tag: el.tagName,
                                className: el.className,
                                id: el.id,
                                right: rect.right,
                                overflow: rect.right - vw
                            });
                        }
                    }
                    return bad;
                }""", vw)

                label_name = f"visao_geral_{res['name']}_zoom{int(zoom*100)}"
                page.screenshot(path=f"{screenshots_dir}/{label_name}.png", full_page=True)

                print(f"[{'✅ PASS' if doc_scroll == doc_client and len(overflows) == 0 else '❌ FAIL'}] {label_name}: scrollWidth={doc_scroll}, clientWidth={doc_client}, bad_els={len(overflows)}")
                context.close()

        # INTERACTIVE TEST ON DESKTOP
        print("\n--- Testing Map Controls & Interactions ---")
        context = browser.new_context(viewport={"width": 1366, "height": 768}, ignore_https_errors=True)
        page = context.new_page()
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(1000)

        # Select UF filter
        uf_select = page.query_selector("select#filter-uf")
        if uf_select:
            uf_select.select_option(index=1)
            page.wait_for_timeout(800)
            print("Selected UF filter")

        # Click Redefinir mapa
        reset_btn = page.query_selector("button:has-text('Redefinir mapa')")
        if reset_btn:
            reset_btn.click()
            page.wait_for_timeout(800)
            print("Clicked Redefinir mapa")

        # Click on a cluster marker
        cluster_marker = page.query_selector(".custom-map-cluster")
        if cluster_marker:
            cluster_marker.click()
            page.wait_for_timeout(800)
            print("Clicked cluster marker")

        page.screenshot(path=f"{screenshots_dir}/interactive_cluster_selected.png", full_page=True)

        browser.close()

    print(f"\nConsole errors: {len(console_errors)}")
    print(f"Failed HTTP requests (401/502/503): {len(failed_requests)}")

if __name__ == "__main__":
    test_visao_geral()
