import sys
import os
import json
import time
from playwright.sync_api import sync_playwright

def run_visual_audit():
    screenshots_dir = "/root/wins_hub_unificado/scratch/screenshots_visual_audit"
    os.makedirs(screenshots_dir, exist_ok=True)

    url = "https://winshubcomercial.com.br:18443/demo/visao-geral"

    resolutions = [
        {"name": "1920x1080", "w": 1920, "h": 1080},
        {"name": "1440x900", "w": 1440, "h": 900},
        {"name": "1366x768", "w": 1366, "h": 768},
        {"name": "390x844", "w": 390, "h": 844},
    ]

    zooms = [1.0, 1.25]
    console_errors = []
    failed_requests = []
    results = []

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
                page.wait_for_timeout(1000)

                doc_scroll = page.evaluate("document.documentElement.scrollWidth")
                doc_client = page.evaluate("document.documentElement.clientWidth")
                vw = page.evaluate("window.innerWidth")

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
                screenshot_path = f"{screenshots_dir}/{label_name}.png"
                page.screenshot(path=screenshot_path, full_page=True)

                status = "✅ PASS" if doc_scroll == doc_client and len(overflows) == 0 else "❌ FAIL"
                results.append({
                    "name": label_name,
                    "resolution": res["name"],
                    "zoom": zoom,
                    "scrollWidth": doc_scroll,
                    "clientWidth": doc_client,
                    "overflows": len(overflows),
                    "status": status,
                    "screenshot": screenshot_path
                })
                print(f"[{status}] {label_name}: scrollWidth={doc_scroll}, clientWidth={doc_client}, bad_els={len(overflows)}")
                context.close()

        browser.close()

    print(f"\nAudit complete. Console errors: {len(console_errors)} | Failed HTTP: {len(failed_requests)}")

if __name__ == "__main__":
    run_visual_audit()
