import asyncio
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from playwright.async_api import async_playwright


BASE = "https://winshubcomercial.com.br:18443"
USER = os.environ["WINS_HUB_GATE_USER"]
PASSWORD = os.environ["WINS_HUB_GATE_PASSWORD"]
if USER.casefold() == "williamvnvn@gmail.com":
    raise RuntimeError("Usuários humanos não podem ser usados por gates automatizados")

OUT = Path("screenshots/overview-integrated-20260722")


async def run_view(browser, name, viewport, mobile=False):
    result = {"name": name, "viewport": viewport, "api": [], "consoleErrors": [], "httpErrors": []}
    context = await browser.new_context(viewport=viewport, is_mobile=mobile)
    page = await context.new_page()
    page.on("console", lambda m: result["consoleErrors"].append(m.text) if m.type == "error" else None)
    page.on("response", lambda r: result["api"].append({"status": r.status, "url": r.url}) if "/api/v1/" in r.url else None)
    page.on("response", lambda r: result["httpErrors"].append({"status": r.status, "url": r.url}) if r.status >= 400 else None)
    await page.goto(BASE + "/demo/login", wait_until="networkidle")
    await page.get_by_role("button", name="Entrar com Keycloak").click()
    await page.locator("#username").fill(USER)
    await page.locator("#password").fill(PASSWORD)
    await page.locator("#kc-login").click()
    await page.wait_for_url("**/demo/**")
    await page.goto(BASE + "/demo/visao-geral", wait_until="networkidle")
    await page.locator('[data-testid="integrated-overview"]').wait_for(timeout=60000)
    controls = page.locator(".sidebar-toggle:visible")
    result["visibleSidebarControls"] = await controls.count()
    result["hasImproperZero"] = "R$ 0" in await page.locator("body").inner_text()
    result["verticalsVisible"] = all([await page.get_by_text(v, exact=True).count() > 0 for v in ("Engenharia", "Agro", "Logística", "Saúde")])
    result["kpiCount"] = await page.locator(".overview-kpis-real .overview-kpi").count()
    result["relationshipCount"] = await page.locator("[data-testid=connected-now] .connected-grid>a").count()
    clusters = page.locator(".leaflet-overview-map .leaflet-interactive")
    result["clusterCount"] = await clusters.count()
    result["contextlessClusters"] = 0
    if result["clusterCount"]:
        await clusters.first.click(force=True)
        await page.locator(".territory-summary .territory-entity-list").wait_for()
        result["mapClickable"] = True
    else:
        result["mapClickable"] = False
    path = OUT / f"visao-geral-depois-{name}.png"
    await page.screenshot(path=str(path), full_page=True)
    raw = path.read_bytes()
    result["screenshot"] = {"file": str(path), "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest(), "timestamp": datetime.now(timezone.utc).isoformat(), "url": page.url, "dimensions": [viewport["width"], viewport["height"]]}
    await context.close()
    return result


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path="/usr/bin/chromium-browser", headless=True, args=["--no-sandbox"])
        views = [
            await run_view(browser, "desktop", {"width": 1440, "height": 1000}),
            await run_view(browser, "mobile", {"width": 390, "height": 844}, True),
        ]
        await browser.close()
    ok = all(v["visibleSidebarControls"] == 1 and not v["hasImproperZero"] and v["verticalsVisible"] and v["kpiCount"] == 8 and v["relationshipCount"] == 5 and v["clusterCount"] > 0 and v["contextlessClusters"] == 0 and v["mapClickable"] and not v["consoleErrors"] and not v["httpErrors"] and all(x["status"] == 200 for x in v["api"]) for v in views)
    evidence = {"host": "winshubcomercial.com.br:18443", "views": views, "verdict": "PASS" if ok else "FAIL"}
    Path("staging/overview_external_gate.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2))
    print(json.dumps({"verdict": evidence["verdict"], "views": views}, ensure_ascii=False, indent=2))


asyncio.run(main())
