import os
import json
from PIL import Image, ImageChops, ImageDraw
from playwright.sync_api import sync_playwright

def run_audit():
    out_dir = "/root/wins_hub_unificado/scratch/rigorous_audit"
    os.makedirs(out_dir, exist_ok=True)

    url = "https://winshubcomercial.com.br:18443/demo/visao-geral"

    resolutions = [
        {"name": "1920x1080", "w": 1920, "h": 1080},
        {"name": "1366x768", "w": 1366, "h": 768},
        {"name": "390x844", "w": 390, "h": 844},
    ]

    bounding_boxes = {}
    screenshots = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--ignore-certificate-errors"])

        for res in resolutions:
            context = browser.new_context(
                viewport={"width": res["w"], "height": res["h"]},
                device_scale_factor=1.0,
                ignore_https_errors=True
            )
            page = context.new_page()
            page.goto(url, wait_until="networkidle")
            page.wait_for_timeout(1200)

            # Measure bounding boxes
            boxes = page.evaluate("""() => {
                const getBox = (selector) => {
                    const el = document.querySelector(selector);
                    if (!el) return null;
                    const r = el.getBoundingClientRect();
                    return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
                };

                const getBoxAll = (selector) => {
                    return Array.from(document.querySelectorAll(selector)).map(el => {
                        const r = el.getBoundingClientRect();
                        return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
                    });
                };

                return {
                    sidebar: getBox('.app-sidebar, aside'),
                    topbar: getBox('.app-header, header'),
                    title: getBox('.page-header, .head-title'),
                    kpis_container: getBox('.reconciled-kpi-grid, [data-testid="overview-kpis"]'),
                    kpi_cards: getBoxAll('.reconciled-kpi-card'),
                    connections_section: getBox('.connected-now, [data-testid="connected-now"]'),
                    filters_bar: getBox('.overview-map-toolbar'),
                    map_container: getBox('.leaflet-overview-map, .leaflet-container'),
                    territory_panel: getBox('.territory-summary-panel'),
                    featured_event: getBox('.featured-event-card'),
                    overview_grid: getBox('.overview-focus-grid')
                };
            }""")

            bounding_boxes[res["name"]] = boxes

            # Capture Viewport screenshot (exact w x h)
            vp_path = os.path.join(out_dir, f"published_{res['name']}_viewport.png")
            page.screenshot(path=vp_path, full_page=False)
            screenshots[res["name"]] = vp_path

            context.close()

        browser.close()

    # Compare against baselines in /tmp/wins-screenshots-pre-fixture-gate-20260722T1215Z/full/
    baselines = {
        "1920x1080": "/tmp/wins-screenshots-pre-fixture-gate-20260722T1215Z/full/visao-geral_1920x1080.png",
        "1366x768": "/tmp/wins-screenshots-pre-fixture-gate-20260722T1215Z/full/visao-geral_dark_1366x768.png",
        "390x844": "/tmp/wins-screenshots-pre-fixture-gate-20260722T1215Z/full/visao-geral_dark_390x844.png",
    }

    math_audit = []

    for res in resolutions:
        name = res["name"]
        w, h = res["w"], res["h"]
        b_file = baselines[name]
        c_file = screenshots[name]

        if not os.path.exists(b_file):
            print(f"Missing baseline for {name}")
            continue

        img1 = Image.open(b_file).convert("RGBA").crop((0, 0, w, h))
        img2 = Image.open(c_file).convert("RGBA").crop((0, 0, w, h))

        total_pixels = w * h

        # Create mask for dynamic regions (map container area)
        boxes = bounding_boxes[name]
        mask = Image.new("L", (w, h), 255) # 255 = keep (comparable)
        draw = ImageDraw.Draw(mask)

        # Mask out map area if present
        map_box = boxes.get("map_container")
        if map_box:
            mx, my, mw, mh = map_box["x"], map_box["y"], map_box["width"], map_box["height"]
            draw.rectangle([mx, my, mx + mw, my + mh], fill=0) # 0 = ignore

        # Mask out KPI dynamic count numbers area inside kpis_container
        kpi_box = boxes.get("kpis_container")
        if kpi_box:
            kx, ky, kw, kh = kpi_box["x"], kpi_box["y"], kpi_box["width"], kpi_box["height"]
            # Mask inner text of kpi cards
            draw.rectangle([kx, ky + 25, kx + kw, ky + kh - 10], fill=0)

        # Calculate pixels
        mask_pixels = sum(1 for p in mask.getdata() if p == 0)
        comparable_pixels = total_pixels - mask_pixels

        # Raw difference
        diff_raw = ImageChops.difference(img1, img2)

        # Structural diff (apply mask)
        diff_masked = Image.new("RGBA", (w, h))
        diff_pixels_raw = 0
        diff_pixels_struct = 0

        p1 = img1.load()
        p2 = img2.load()
        pm = mask.load()

        for y in range(h):
            for x in range(w):
                r1, g1, b1, _ = p1[x, y]
                r2, g2, b2, _ = p2[x, y]
                is_diff = (abs(r1 - r2) + abs(g1 - g2) + abs(b1 - b2)) > 30
                if is_diff:
                    diff_pixels_raw += 1
                    if pm[x, y] == 255:
                        diff_pixels_struct += 1

        struct_diff_pct = round((diff_pixels_struct / comparable_pixels) * 100.0, 2) if comparable_pixels > 0 else 0

        # Save masked structural overlay and diff
        overlay = Image.blend(img1, img2, alpha=0.5)
        overlay_path = os.path.join(out_dir, f"overlay_{name}.png")
        overlay.save(overlay_path)

        diff_path = os.path.join(out_dir, f"diff_{name}.png")
        diff_raw.save(diff_path)

        crop_b_path = os.path.join(out_dir, f"baseline_{name}_viewport.png")
        img1.save(crop_b_path)

        math_audit.append({
            "resolution": name,
            "viewport_w_x_h": f"{w}x{h}",
            "total_pixels": total_pixels,
            "masked_pixels": mask_pixels,
            "comparable_pixels": comparable_pixels,
            "raw_diff_pixels": diff_pixels_raw,
            "structural_diff_pixels": diff_pixels_struct,
            "structural_diff_percentage": struct_diff_pct,
            "baseline_path": crop_b_path,
            "published_path": c_file,
            "overlay_path": overlay_path,
            "diff_path": diff_path
        })

    with open(os.path.join(out_dir, "audit_summary.json"), "w") as f:
        json.dump({"bounding_boxes": bounding_boxes, "math_audit": math_audit}, f, indent=2)

    print("=== BOUNDING BOXES AND RIGOROUS MATH AUDIT COMPLETE ===")
    print(json.dumps(math_audit, indent=2))

if __name__ == "__main__":
    run_audit()
