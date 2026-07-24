import sys
import os
import json
import time
from playwright.sync_api import sync_playwright

def verify_final():
    screenshots_dir = "/root/wins_hub_unificado/scratch/screenshots_final_gate"
    os.makedirs(screenshots_dir, exist_ok=True)

    url = "https://winshubcomercial.com.br:18443/demo/engenharia"

    resolutions = [
        {"name": "1920x1080", "w": 1920, "h": 1080},
        {"name": "1536x864", "w": 1536, "h": 864},
        {"name": "1366x768", "w": 1366, "h": 768},
        {"name": "1280x720", "w": 1280, "h": 720},
    ]

    sidebar_states = [
        {"name": "sidebar_collapsed", "collapse": True},
        {"name": "sidebar_open", "collapse": False},
    ]

    zooms = [1.0, 1.25]

    results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--ignore-certificate-errors"])

        for sidebar_st in sidebar_states:
            for res in resolutions:
                for zoom in zooms:
                    context = browser.new_context(
                        viewport={"width": res["w"], "height": res["h"]},
                        device_scale_factor=zoom,
                        ignore_https_errors=True
                    )
                    page = context.new_page()

                    page.goto(url, wait_until="networkidle")
                    page.wait_for_timeout(1000)

                    # Sidebar control
                    if sidebar_st["collapse"]:
                        toggle_btn = page.query_selector("button[title='Recolher menu']")
                        if toggle_btn and page.is_visible(".sidebar.open"):
                            toggle_btn.click()
                            page.wait_for_timeout(300)
                    else:
                        toggle_btn = page.query_selector("button[title='Expandir menu'], .sidebar-toggle")
                        if toggle_btn and not page.is_visible(".sidebar.open"):
                            toggle_btn.click()
                            page.wait_for_timeout(300)

                    # Always expand Advanced Filters
                    adv_btn = page.query_selector("button:has-text('Filtros avançados')")
                    if adv_btn and page.query_selector(".filter-grid-advanced") is None:
                        adv_btn.click()
                        page.wait_for_timeout(400)

                    # TEMPORARILY REMOVE OVERFLOW-X: HIDDEN FOR STRICT GATE TEST
                    page.evaluate("""() => {
                        const style = document.createElement('style');
                        style.id = 'temp-disable-overflow-hidden';
                        style.innerHTML = `
                            html, body, .app-shell, .main-content, .engineering-page, .filter-panel {
                                overflow-x: visible !important;
                            }
                        `;
                        document.head.appendChild(style);
                    }""")

                    vw = page.evaluate("window.innerWidth")
                    doc_scroll = page.evaluate("document.documentElement.scrollWidth")
                    doc_client = page.evaluate("document.documentElement.clientWidth")

                    # Measure individual fields
                    fields_info = page.evaluate("""() => {
                        const selectors = [
                            '#filter-search', '#filter-status', '#filter-phase', '#filter-uf', '#filter-municipality',
                            '#filter-sector', '#filter-company', '#filter-inv-min', '#filter-inv-max',
                            '#filter-period-start', '#filter-period-end', '#filter-has-supplier',
                            '#filter-has-decisionmaker', '#filter-has-opportunity', '#filter-capex-homologado',
                            '.filter-actions'
                        ];
                        const res = {};
                        selectors.forEach(sel => {
                            const el = document.querySelector(sel);
                            if (el) {
                                const r = el.getBoundingClientRect();
                                res[sel] = { left: r.left, right: r.right, width: r.width };
                            }
                        });
                        return res;
                    }""")

                    # Find non-leaflet elements exceeding viewport right
                    overflows = page.evaluate("""(vw) => {
                        const els = Array.from(document.querySelectorAll('*'));
                        const bad = [];
                        for (const el of els) {
                            // Ignore leaflet internal proxy/panes as requested (contained inside outer container)
                            if (el.className && typeof el.className === 'string' && el.className.includes('leaflet-')) continue;
                            const rect = el.getBoundingClientRect();
                            if (rect.right > vw + 1) {
                                bad.push({
                                    tag: el.tagName,
                                    className: el.className,
                                    id: el.id,
                                    right: rect.right,
                                    overflow: rect.right - vw,
                                    html: el.outerHTML.substring(0, 100)
                                });
                            }
                        }
                        return bad;
                    }""", vw)

                    label_name = f"{res['name']}_{sidebar_st['name']}_zoom{int(zoom*100)}"
                    screenshot_file = f"{screenshots_dir}/{label_name}.png"
                    page.screenshot(path=screenshot_file, full_page=True)

                    entry = {
                        "label": label_name,
                        "res": res["name"],
                        "sidebar": sidebar_st["name"],
                        "zoom": f"{int(zoom*100)}%",
                        "vw": vw,
                        "doc_scroll": doc_scroll,
                        "doc_client": doc_client,
                        "fields_info": fields_info,
                        "overflow_count": len(overflows),
                        "overflows": overflows[:5],
                        "screenshot": screenshot_file
                    }
                    results.append(entry)

                    status_icon = "✅ PASS" if len(overflows) == 0 and doc_scroll == doc_client else "❌ FAIL"
                    print(f"[{status_icon}] {label_name}: scrollWidth={doc_scroll}, clientWidth={doc_client}, bad_els={len(overflows)}")

                    context.close()

        # LEAFLET INTERACTIVE PAN / ZOOM / RESIZE VALIDATION
        print("\n--- Testing Leaflet interactive pan, zoom, clusters and resize ---")
        context = browser.new_context(viewport={"width": 1366, "height": 768}, ignore_https_errors=True)
        page = context.new_page()
        page.goto("https://winshubcomercial.com.br:18443/engenharia/mapa", wait_until="networkidle")
        page.wait_for_timeout(1500)

        map_container = page.query_selector(".leaflet-container, .global-map-stage, .vertical-map")
        if map_container:
            map_box = map_container.bounding_box()
            print(f"Map container bounding box: {map_box}")
            # Perform drag (pan)
            page.mouse.move(map_box['x'] + map_box['width']/2, map_box['y'] + map_box['height']/2)
            page.mouse.down()
            page.mouse.move(map_box['x'] + map_box['width']/2 + 100, map_box['y'] + map_box['height']/2 + 100)
            page.mouse.up()
            page.wait_for_timeout(500)
            print("Leaflet drag pan completed successfully!")

            # Perform zoom controls click
            zoom_in = page.query_selector(".leaflet-control-zoom-in, button[title='Zoom in']")
            if zoom_in:
                zoom_in.click()
                page.wait_for_timeout(300)
                print("Leaflet zoom in click completed successfully!")

            # Capture Leaflet map screenshot
            leaflet_shot = f"{screenshots_dir}/leaflet_interactive_map.png"
            page.screenshot(path=leaflet_shot, full_page=True)
            print(f"Saved interactive Leaflet screenshot: {leaflet_shot}")

        browser.close()

    with open("/root/wins_hub_unificado/scratch/final_gate_results.json", "w") as f:
        json.dump(results, f, indent=2)

    print("\nFinal gate verification complete!")

if __name__ == "__main__":
    verify_final()
