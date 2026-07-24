import sys
import os
import json
from playwright.sync_api import sync_playwright

def validate_all():
    screenshots_dir = "/root/wins_hub_unificado/scratch/screenshots_real_v3"
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
                    # Wait for filter-panel to render after API data is loaded
                    try:
                        page.wait_for_selector(".filter-panel", timeout=20000)
                    except Exception as err:
                        print(f"Error waiting for filter-panel on {res['name']} {sidebar_st['name']} zoom {zoom}: {err}")
                        print("Page content:", page.evaluate("document.body.innerHTML.substring(0, 300)"))
                        context.close()
                        continue

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

                    vw = page.evaluate("window.innerWidth")
                    doc_scroll = page.evaluate("document.documentElement.scrollWidth")
                    doc_client = page.evaluate("document.documentElement.clientWidth")

                    page_rect = page.evaluate("""() => {
                        const el = document.querySelector('.engineering-page');
                        if (!el) return null;
                        const r = el.getBoundingClientRect();
                        return { left: r.left, right: r.right, width: r.width };
                    }""")

                    filter_rect = page.evaluate("""() => {
                        const el = document.querySelector('.filter-panel');
                        if (!el) return null;
                        const r = el.getBoundingClientRect();
                        return { left: r.left, right: r.right, width: r.width };
                    }""")

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

                    # Find elements exceeding viewport right (without overflow-x: hidden masking)
                    overflows = page.evaluate("""(vw) => {
                        const els = Array.from(document.querySelectorAll('*'));
                        const bad = [];
                        for (const el of els) {
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
                        "page_rect": page_rect,
                        "filter_rect": filter_rect,
                        "fields_info": fields_info,
                        "overflow_count": len(overflows),
                        "overflows": overflows[:5],
                        "screenshot": screenshot_file
                    }
                    results.append(entry)

                    status_icon = "✅ PASS" if len(overflows) == 0 and doc_scroll == doc_client else "❌ FAIL"
                    print(f"[{status_icon}] {label_name}: scrollWidth={doc_scroll}, clientWidth={doc_client}, page_right={page_rect['right'] if page_rect else 'N/A'}, filter_right={filter_rect['right'] if filter_rect else 'N/A'}, bad_els={len(overflows)}")

                    context.close()

        browser.close()

    with open("/root/wins_hub_unificado/scratch/validation_results_v3.json", "w") as f:
        json.dump(results, f, indent=2)

    print("\nValidation complete. Results saved to validation_results_v3.json")

if __name__ == "__main__":
    validate_all()
