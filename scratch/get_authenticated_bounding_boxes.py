import json
from playwright.sync_api import sync_playwright

def get_auth_boxes():
    url = "https://winshubcomercial.com.br:18443/demo/visao-geral"
    resolutions = [
        {"name": "1920x1080", "w": 1920, "h": 1080},
        {"name": "1440x900", "w": 1440, "h": 900},
        {"name": "1366x768", "w": 1366, "h": 768},
        {"name": "390x844", "w": 390, "h": 844},
    ]

    all_boxes = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--ignore-certificate-errors"])
        context = browser.new_context(viewport={"width": 1920, "height": 1080}, ignore_https_errors=True)
        page = context.new_page()

        # Perform login on Keycloak
        page.goto("https://winshubcomercial.com.br:18443/demo/login", wait_until="networkidle")
        page.wait_for_timeout(1000)

        # Check if redirected to Keycloak form
        username_field = page.query_selector("input#username, input[name='username']")
        if username_field:
            username_field.fill("william")
            password_field = page.query_selector("input#password, input[name='password']")
            if password_field:
                password_field.fill("william123") # or default test password
            submit_btn = page.query_selector("input#kc-login, button[type='submit']")
            if submit_btn:
                submit_btn.click()
                page.wait_for_timeout(2000)

        for res in resolutions:
            res_context = browser.new_context(viewport={"width": res["w"], "height": res["h"]}, ignore_https_errors=True)
            res_page = res_context.new_page()
            res_page.goto(url, wait_until="networkidle")
            res_page.wait_for_timeout(2000)

            res_boxes = res_page.evaluate("""() => {
                const getB = (sel) => {
                    const el = document.querySelector(sel);
                    if (!el) return null;
                    const r = el.getBoundingClientRect();
                    return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
                };
                return {
                    sidebar: getB('.sidebar, aside, .app-sidebar'),
                    topbar: getB('.topbar, header, .app-header'),
                    title: getB('.page-header h1, h1'),
                    kpis_container: getB('.reconciled-kpi-grid'),
                    kpis_count: document.querySelectorAll('.reconciled-kpi-card').length,
                    connections_section: getB('.connected-now'),
                    filters_bar: getB('.overview-map-toolbar'),
                    map_container: getB('.leaflet-container'),
                    territory_panel: getB('.territory-summary-panel'),
                    featured_event: getB('.featured-event-card'),
                    overview_grid: getB('.overview-focus-grid')
                };
            }""")

            grid = res_boxes.get("overview_grid")
            map_c = res_boxes.get("map_container")
            panel = res_boxes.get("territory_panel")
            if grid and map_c and panel:
                res_boxes["calculated_proportions"] = {
                    "grid_width": grid["width"],
                    "map_width": map_c["width"],
                    "panel_width": panel["width"],
                    "gap": grid["width"] - (map_c["width"] + panel["width"]),
                    "map_percentage": round((map_c["width"] / grid["width"]) * 100, 2),
                    "panel_percentage": round((panel["width"] / grid["width"]) * 100, 2)
                }

            all_boxes[res["name"]] = res_boxes
            res_context.close()

        browser.close()

    print(json.dumps(all_boxes, indent=2))

if __name__ == "__main__":
    get_auth_boxes()
