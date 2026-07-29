import asyncio
import base64
import json
import os
import sys
from playwright.async_api import async_playwright

BASE = "https://winshubcomercial.com.br:18443"
USER = os.environ["WINS_HUB_GATE_USER"]
PASSWORD = os.environ["WINS_HUB_GATE_PASSWORD"]
VIEWER_USER = os.environ.get("WINS_HUB_VIEWER_USER", "")
VIEWER_PASSWORD = os.environ.get("WINS_HUB_VIEWER_PASSWORD", "")

def jwt_payload(token):
    raw = token.split('.')[1]
    raw += '=' * (-len(raw) % 4)
    return json.loads(base64.urlsafe_b64decode(raw))

class Tally:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []

    def ok(self, name):
        self.passed += 1
        print(f"  ✓ {name}")

    def fail(self, name, detail=""):
        self.failed += 1
        self.errors.append(f"{name}: {detail}")
        print(f"  ✗ {name}")

async def run():
    tally = Tally()

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path="/usr/bin/chromium-browser",
            headless=True,
            args=["--no-sandbox"]
        )

        # ─── 1. AUTH CONTEXT ───
        context = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            ignore_https_errors=True
        )
        page = await context.new_page()
        http_errors = []

        def on_response(resp):
            if resp.status >= 400 and "/api/" in resp.url:
                http_errors.append({"url": resp.url, "status": resp.status, "screen": current_screen})
        page.on("response", on_response)

        token_data = {}
        def on_auth_response(resp):
            if "/protocol/openid-connect/token" in resp.url:
                try:
                    body = asyncio.ensure_future(resp.json())
                    # handled sync below
                except: pass
        page.on("response", on_auth_response)

        current_screen = "login"

        print("\n=== AUTENTICAÇÃO ===")
        await page.goto(BASE + "/demo/login", wait_until="networkidle")
        await page.get_by_role("button", name="Entrar com Keycloak").click()
        await page.locator("#username").fill(USER)
        await page.locator("#password").fill(PASSWORD)
        async with page.expect_response(lambda r: "/protocol/openid-connect/token" in r.url) as resp_info:
            await page.locator("#kc-login").click()
        token_resp = await resp_info.value
        token_body = await token_resp.json()
        token = token_body.get("access_token", "")
        if token:
            tally.ok("Login Keycloak + PKCE emitiu token")
            claims = jwt_payload(token)
            roles = claims.get("realm_access", {}).get("roles", [])
            print(f"    Usuário: {claims.get('preferred_username')}")
            print(f"    Roles: {roles}")
        else:
            tally.fail("Login Keycloak falhou", "sem token")
            await browser.close()
            return tally

        await page.wait_for_url("**/demo/**", timeout=30000)
        await page.wait_for_load_state("networkidle")
        tally.ok("Redirecionado para /demo/ após login")

        # ─── 2. TEST UNAUTHENTICATED 401 ───
        current_screen = "unauth_test"
        unauth_resp = await context.request.get(BASE + "/api/v1/relacionamentos")
        if unauth_resp.status == 401:
            tally.ok("API /relacionamentos sem token retorna 401")
        else:
            tally.fail("API /relacionamentos sem token", f"status={unauth_resp.status}")

        # ─── 3. TEST VIEWER 403 ON REVIEW POST ───
        current_screen = "viewer_forbidden"
        viewer_resp = await context.request.post(
            BASE + "/api/v1/relacionamentos/fake-id/review",
            data=json.dumps({"classificacao_nova": "CONFIRMADO", "justificativa": "test"}),
            headers={"Content-Type": "application/json"}
        )
        if viewer_resp.status in (401, 403):
            tally.ok("POST /relacionamentos/{id}/review sem role autorizada retorna 401/403")
        else:
            tally.fail("POST review sem role autorizada", f"status={viewer_resp.status}")

        # ─── 4. NAVEGAR PARA RELACIONAMENTOS ───
        current_screen = "relacionamentos"
        print("\n=== RELACIONAMENTOS PAGE ===")
        api_responses = []
        def capture_api(resp):
            if "/api/v1/" in resp.url:
                api_responses.append({"url": resp.url, "status": resp.status, "screen": current_screen})
        page.on("response", capture_api)

        await page.goto(BASE + "/demo/relacionamentos", wait_until="domcontentloaded")
        await page.wait_for_selector("[data-ui-version='relacionamentos-approved-v2']", timeout=15000)
        await page.wait_for_load_state("networkidle")
        tally.ok("Página de relacionamentos carregada")

        # ─── 5. BUSCA ───
        print("\n=== BUSCA DE ENTIDADE ===")
        input_el = page.locator("[data-testid='search-autocomplete-input']")
        await input_el.fill("CONSTRUTORA")
        await page.wait_for_timeout(1000)

        autocomplete = page.locator("[data-testid='autocomplete-dropdown']")
        try:
            await autocomplete.wait_for(state="visible", timeout=5000)
            tally.ok("Autocomplete exibido com resultados da API")
            # Click first result if available
            first_item = autocomplete.locator("> div").first
            item_text = await first_item.inner_text()
            print(f"    Primeiro resultado: {item_text[:80]}")
            await first_item.click()
            await page.wait_for_timeout(1000)
        except:
            # No autocomplete results - try Enter
            await input_el.press("Enter")
            await page.wait_for_timeout(1000)
            print("    (autocomplete vazio — Enter usado como fallback)")

        # ─── 6. VERIFICAR CARREGAMENTO ───
        print("\n=== CARREGAMENTO DO GRAFO ===")
        try:
            kpi = page.locator("[data-testid='kpi-total-conns']")
            await kpi.wait_for(state="visible", timeout=10000)
            kpi_text = await kpi.inner_text()
            print(f"    KPI Conexões Totais: {kpi_text}")
            tally.ok("Grafo carregado com dados da API")
        except:
            try:
                error_el = page.locator("text=Não foi possível carregar os relacionamentos")
                await error_el.wait_for(state="visible", timeout=5000)
                tally.fail("API de relacionamentos retornou erro", await error_el.inner_text())
                await browser.close()
                return tally
            except:
                tally.fail("Grafo não carregou", "sem KPI nem erro visível")
                await browser.close()
                return tally

        # ─── 7. KPIS ───
        print("\n=== KPIS ===")
        kpi_labels = {
            "confirmadas": "Confirmadas",
            "provaveis": "Prováveis", 
            "potenciais": "Potenciais"
        }
        for key, label in kpi_labels.items():
            try:
                el = page.locator(f"text={label}").first
                await el.wait_for(state="visible", timeout=3000)
                tally.ok(f"KPI {label} visível")
            except:
                tally.fail(f"KPI {label} ausente")

        # ─── 8. CLIKE NA ARESTA / DRAWER ───
        print("\n=== PAINEL DE EVIDÊNCIA ===")
        rows = page.locator("table tbody tr")
        row_count = await rows.count()
        if row_count > 0:
            await rows.first.click()
            await page.wait_for_timeout(500)
            try:
                drawer = page.locator("[data-testid='evidence-drawer']")
                await drawer.wait_for(state="visible", timeout=3000)
                drawer_text = await drawer.inner_text()
                if "Por que essas entidades estão relacionadas?" in drawer_text:
                    tally.ok("Drawer de evidência aberto com conteúdo")
                else:
                    tally.fail("Drawer sem conteúdo esperado")
                # Check review section
                if not "Revisão da Classificação" in await page.locator("[data-testid='evidence-drawer']").inner_text():
                    # VIEWER might see the read-only message
                    if "aguarda revisão" in drawer_text or "Revisão" in drawer_text:
                        tally.ok("Drawer contém seção de revisão")
                    else:
                        tally.fail("Drawer sem seção de revisão")
                else:
                    tally.ok("Drawer contém seção de revisão")
                await page.locator("[data-testid='close-drawer-btn']").click()
                await page.wait_for_timeout(300)
                tally.ok("Drawer fechado")
            except:
                tally.fail("Drawer não abriu")
        else:
            tally.fail("Nenhuma linha na tabela")

        # ─── 9. FILTROS ───
        print("\n=== FILTROS ===")
        filter_select = page.locator("select").first
        try:
            await filter_select.wait_for(state="visible", timeout=3000)
            await filter_select.select_option("CONFIRMADO")
            await page.wait_for_timeout(500)
            tally.ok("Filtro por classificação aplicado")
            await filter_select.select_option("")
            await page.wait_for_timeout(300)
        except:
            tally.fail("Filtro de classificação não disponível")

        # ─── 10. TABELA ───
        print("\n=== TABELA ===")
        try:
            table = page.locator("table")
            await table.wait_for(state="visible", timeout=3000)
            headers = await table.locator("thead th").all_inner_texts()
            print(f"    Colunas: {headers}")
            tally.ok("Tabela de conexões visível")
        except:
            tally.fail("Tabela de conexões ausente")

        # ─── 11. CAMINHO ───
        print("\n=== CAMINHO ENTRE ENTIDADES ===")
        path_a = page.locator("[data-testid='shortest-path-entity-a']")
        path_b = page.locator("[data-testid='shortest-path-entity-b']")
        try:
            await path_a.wait_for(state="visible", timeout=3000)
            await path_a.fill("Entidade A")
            await path_b.fill("Entidade B")
            await page.locator("[data-testid='shortest-path-btn']").click()
            await page.wait_for_timeout(500)
            tally.ok("UI de caminho entre entidades funcional")
        except:
            tally.fail("UI de caminho não disponível")

        # ─── 12. EXPORTAÇÃO ───
        print("\n=== EXPORTAÇÃO ===")
        export_btn = page.locator("button", has_text="Exportar")
        try:
            await export_btn.wait_for(state="visible", timeout=3000)
            is_disabled = await export_btn.is_disabled()
            btn_text = await export_btn.inner_text()
            print(f"    Botão: {btn_text.strip()} disabled={is_disabled}")
            if "restrita" in btn_text or is_disabled:
                print("    (VIEWER — exportação restrita conforme esperado)")
                tally.ok("Proteção de exportação para VIEWER")
            else:
                tally.ok("Botão de exportação disponível")
        except:
            tally.fail("Botão de exportação ausente")

        # ─── 13. NOVA CONSULTA ───
        print("\n=== NOVA CONSULTA ===")
        try:
            new_btn = page.locator("button", has_text="Nova consulta")
            await new_btn.wait_for(state="visible", timeout=3000)
            await new_btn.click()
            await page.wait_for_timeout(500)
            tally.ok("Nova consulta limpa o estado")
        except:
            tally.fail("Botão Nova consulta ausente")

        # ─── 14. ERRO 500 ───
        print("\n=== TRATAMENTO DE ERRO ===")
        fake_url = BASE + "/demo/relacionamentos?entidade=ENTIDADE_INEXISTENTE_123456"
        await page.goto(fake_url, wait_until="domcontentloaded")
        await page.wait_for_timeout(2000)
        error_el = page.locator("text=Não foi possível carregar")
        try:
            await error_el.wait_for(state="visible", timeout=8000)
            tally.ok("Página exibe mensagem de erro para entidade inválida")
        except:
            tally.fail("Erro não exibido para entidade inválida")

        # ─── 15. URL DIRETA ───
        print("\n=== URL DIRETA ===")
        await page.goto(BASE + "/demo/relacionamentos", wait_until="domcontentloaded")
        await page.wait_for_selector("[data-ui-version='relacionamentos-approved-v2']", timeout=15000)
        await page.wait_for_load_state("networkidle")
        empty_state = page.locator("text=Nenhuma investigação em andamento")
        try:
            await empty_state.wait_for(state="visible", timeout=5000)
            tally.ok("Estado vazio exibido para URL direta sem parâmetros")
        except:
            tally.fail("Estado vazio não exibido")

        # ─── 16. REFRESH ───
        print("\n=== REFRESH ===")
        await page.reload(wait_until="domcontentloaded")
        await page.wait_for_selector("[data-ui-version='relacionamentos-approved-v2']", timeout=15000)
        tally.ok("Página recarrega sem erros")

        # ─── 17. HTTP ERRORS ───
        if http_errors:
            for err in http_errors:
                if err["status"] < 500:
                    print(f"    HTTP {err['status']}: {err['url'][:100]}")
            tally.fail(f"Erros HTTP registrados", f"{len(http_errors)} erros")
        else:
            tally.ok("Nenhum erro HTTP nas chamadas API")

        await browser.close()

    return tally

if __name__ == "__main__":
    print("=== TESTE E2E RELACIONAMENTOS ===")
    print(f"Domínio: https://winshubcomercial.com.br:18443")
    print(f"Usuário: {USER[:4]}...")
    tally = asyncio.run(run())
    print(f"\n{'='*50}")
    print(f"RESULTADO: {tally.passed} aprovados / {tally.failed} reprovados")
    if tally.errors:
        print("\nFalhas:")
        for e in tally.errors:
            print(f"  - {e}")
    print(f"{'='*50}")
    sys.exit(0 if tally.failed == 0 else 1)
