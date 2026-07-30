import asyncio, json, os, sys
from playwright.async_api import async_playwright

BASE = os.environ.get("WINS_HUB_BASE", "https://winshubcomercial.com.br")
USER = os.environ.get("WINS_HUB_GATE_USER", "")
PASSWORD = os.environ.get("WINS_HUB_GATE_PASSWORD", "")
if not USER or not PASSWORD:
    raise RuntimeError("WINS_HUB_GATE_USER e WINS_HUB_GATE_PASSWORD são obrigatórios")
if USER.casefold() == "williamvnvn@gmail.com":
    raise RuntimeError("Usuários humanos não podem ser usados por gates automatizados")

async def test():
    result = {
        "base": BASE,
        "auth": {"flow": "authorization_code + PKCE S256", "token_issued": False},
        "endpoints": {},
        "ui": {},
        "errors": [],
        "fixtures_detected": []
    }

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"]
        )
        context = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            ignore_https_errors=False
        )
        page = await context.new_page()

        token_data = {}
        api_calls = []

        async def on_response(response):
            nonlocal token_data
            url = response.url
            if "/protocol/openid-connect/token" in url:
                try:
                    body = await response.json()
                    if body.get("access_token"):
                        token_data = body
                except Exception:
                    pass
            if "/api/v1/" in url:
                api_calls.append({
                    "url": url.replace(BASE, ""),
                    "status": response.status,
                    "ok": response.ok
                })

        page.on("response", on_response)
        console_errors = []
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)

        # 1. AUTH
        await page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30000)
        login_btn = page.get_by_role("button", name="Entrar com Keycloak")
        if await login_btn.count() > 0:
            await login_btn.click()
        if await page.locator("#username").count() > 0:
            await page.locator("#username").fill(USER)
            await page.locator("#password").fill(PASSWORD)
            await page.locator("#kc-login").click()
        try:
            await page.wait_for_url(f"{BASE}/**", timeout=30000)
            await page.wait_for_load_state("networkidle")
        except Exception as e:
            result["errors"].append(f"Login redirect failed: {e}")

        if not token_data.get("access_token"):
            result["errors"].append("Authorization Code + PKCE did not issue token")
            result["auth"]["token_issued"] = False
        else:
            result["auth"]["token_issued"] = True
            payload_b64 = token_data["access_token"].split(".")[1]
            payload_b64 += "=" * (-len(payload_b64) % 4)
            import base64
            claims = json.loads(base64.urlsafe_b64decode(payload_b64))
            result["auth"]["subject"] = claims.get("sub")
            result["auth"]["roles"] = claims.get("realm_access", {}).get("roles", [])
            result["auth"]["has_agro_role"] = "agro" in result["auth"]["roles"]

        if not result["auth"].get("has_agro_role"):
            result["errors"].append("Usuário gate não possui role 'agro'")

        # 2. AGRO PAGE UI TESTS
        await page.goto(f"{BASE}/agro", wait_until="networkidle", timeout=60000)
        await page.wait_for_timeout(2000)

        page_text = await page.locator("body").inner_text()

        ui = result["ui"]
        ui["page_loaded"] = "Inteligência Territorial Rural" in page_text
        ui["dados_oficiais_badge"] = "Dados Oficiais" in page_text
        ui["kpi_section_visible"] = "CAR Únicos" in page_text or "Cadastros CAR" in page_text
        ui["distribuicao_section"] = "Distribuição Territorial" in page_text or "Bioma" in page_text
        ui["mapa_section"] = "Mapa de Concentração" in page_text or "Concentração" in page_text
        ui["oportunidades_section"] = "Oportunidades e Relações" in page_text or "Oportunidades" in page_text

        # 3. KPI CARDS
        try:
            await page.wait_for_selector('text=Cadastros CAR', timeout=15000)
            ui["kpis_renderizados"] = True
        except Exception:
            try:
                await page.wait_for_selector('text=Geometrias Válidas', timeout=5000)
                ui["kpis_renderizados"] = True
            except Exception:
                ui["kpis_renderizados"] = False
                result["errors"].append("KPI cards not rendered")

        # 4. FILTERS
        uf_select = page.locator('select').first
        ui["filtro_uf_visivel"] = await uf_select.count() > 0

        # 5. DISTRIBUIÇÕES
        try:
            await page.wait_for_selector('text=Imóveis por Bioma', timeout=10000)
            ui["dist_bioma_visivel"] = await page.get_by_text("Imóveis por Bioma").count() > 0
            ui["dist_uso_solo_visivel"] = await page.get_by_text("Área por Uso do Solo").count() > 0
        except Exception:
            ui["dist_bioma_visivel"] = False
            result["errors"].append("Distribuição sections not found")

        # 6. MAPA
        try:
            map_container = page.locator('.leaflet-container')
            ui["mapa_renderizado"] = await map_container.count() > 0
        except Exception:
            ui["mapa_renderizado"] = False

        # 7. OPORTUNIDADES VAZIAS
        try:
            opp_section = page.locator('text=Oportunidades e Relações Cross-Domain')
            ui["oportunidades_vazias_tratadas"] = "ainda não calculadas" in page_text.lower() or "nenhuma relação" in page_text.lower()
        except Exception:
            ui["oportunidades_vazias_tratadas"] = False

        # 8. FIXTURE SCAN
        fixture_markers = [
            "MASTER_MUNICIPALITIES", "obra-001", "emp-01", "hub-co-01",
            "12.345.678/0001-90", "REC-OBR-001", "REC-EMP-001",
            "MASTER_ENTITY_CATALOG", "MASTER_EDGES_DATASET"
        ]
        for marker in fixture_markers:
            if marker.lower() in page_text.lower():
                result["fixtures_detected"].append(marker)
                result["errors"].append(f"Fixture detectada na página: {marker}")

        # 9. API ENDPOINT TESTS
        headers = {}
        if token_data.get("access_token"):
            headers["Authorization"] = f"Bearer {token_data['access_token']}"

        endpoints = {
            "kpis": "/api/v1/agro/kpis",
            "distribuicao_bioma": "/api/v1/agro/distribuicao?tipo=bioma",
            "distribuicao_uso_solo": "/api/v1/agro/distribuicao?tipo=uso_solo",
            "mapa": "/api/v1/agro/mapa?zoom=4",
            "oportunidades": "/api/v1/agro/oportunidades",
            "relacoes": "/api/v1/agro/relacoes",
        }

        for name, path in endpoints.items():
            try:
                resp = await context.request.get(f"{BASE}{path}", headers=headers, timeout=60000)
                data = await resp.json() if resp.status == 200 else None
                result["endpoints"][name] = {
                    "status": resp.status,
                    "ok": resp.ok,
                    "has_data": data is not None
                }
                if resp.status != 200:
                    result["errors"].append(f"Endpoint {name}: HTTP {resp.status}")
            except Exception as e:
                result["endpoints"][name] = {"status": 0, "ok": False, "error": str(e)}
                result["errors"].append(f"Endpoint {name}: {e}")

        # 10. APIS CONSUMED BY PAGE
        agro_api_calls = [c for c in api_calls if "/agro/" in c["url"] or "/api/v1/" in c["url"]]
        result["api_calls_from_page"] = agro_api_calls

        # 11. CONSOLE ERRORS
        result["console_errors"] = console_errors[:20]

        await browser.close()

    exit_code = 0
    if result["errors"]:
        exit_code = 1

    print(json.dumps(result, ensure_ascii=False, indent=2))

    if exit_code:
        print("\n--- FALHAS DETECTADAS ---", file=sys.stderr)
        for err in result["errors"]:
            print(f"  FAIL: {err}", file=sys.stderr)
        sys.exit(1)

    print("\n--- AGRO E2E GATE APROVADO ---")

if __name__ == "__main__":
    asyncio.run(test())
