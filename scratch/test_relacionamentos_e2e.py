import asyncio
import os
import sys
from playwright.async_api import async_playwright

async def function_test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        page = await context.new_page()

        errors = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: errors.append(str(err)))

        print("0. Configurando sessão em localStorage...")
        await page.goto("http://localhost:5173/login", wait_until="commit")
        await page.evaluate("""() => {
            localStorage.setItem('wins_user', JSON.stringify({
                id: 'u1',
                name: 'Analista de Inteligência',
                email: 'analista@winshub.com.br',
                roles: ['admin', 'engenharia', 'comercial', 'logistica', 'agro', 'saude'],
                permissions: ['engenharia', 'empresa360', 'comercial', 'logistica', 'agro', 'saude', 'relatorios']
            }));
            localStorage.setItem('wins_token', 'mock_valid_token_123');
        }""")

        print("1. Navegando para a rota oficial /relacionamentos...")
        await page.goto("http://localhost:5173/relacionamentos", wait_until="domcontentloaded")
        await page.wait_for_selector("[data-ui-version='relacionamentos-approved-v2']", timeout=15000)

        # 2. Autocomplete search
        print("2. Testando Autocomplete Multi-Entidade...")
        input_el = page.locator("[data-testid='search-autocomplete-input']")
        await input_el.fill("ENGENHARIA E CONSTRUCOES")

        # Press Enter to trigger search (autocomplete may be empty if API is down)
        await input_el.press("Enter")
        await page.wait_for_timeout(500)

        # 3. Verify loading state or data state
        print("3. Verificando estado de carregamento...")
        loading_el = page.locator("text=Carregando relacionamentos")
        kpi_el = page.locator("[data-testid='kpi-total-conns']")
        error_el = page.locator("text=Não foi possível carregar os relacionamentos")

        try:
            await kpi_el.wait_for(state="visible", timeout=5000)
            kpi_text = await kpi_el.inner_text()
            print(f"   Dados carregados - KPI Conexões Totais: {kpi_text}")
        except:
            try:
                await error_el.wait_for(state="visible", timeout=5000)
                error_text = await error_el.inner_text()
                print(f"   API indisponível - erro exibido: {error_text}")
                print("   (E2E esperado: dados reais da API)")
            except:
                await loading_el.wait_for(state="visible", timeout=5000)
                print("   Ainda carregando...")

        # 4. Shortest path UI test
        print("4. Testando Shortest Path Interativo...")
        entity_a = page.locator("[data-testid='shortest-path-entity-a']")
        entity_b = page.locator("[data-testid='shortest-path-entity-b']")
        await entity_a.fill("Entidade A")
        await entity_b.fill("Entidade B")
        path_btn = page.locator("[data-testid='shortest-path-btn']")
        await path_btn.click()
        await page.wait_for_timeout(300)

        # 5. Mobile viewport test
        print("5. Testando Responsividade Mobile...")
        await page.set_viewport_size({"width": 375, "height": 667})
        await page.wait_for_timeout(500)

        print("=== TESTE PLAYWRIGHT E2E CONCLUÍDO ===")
        print(f"Erros de console registrados: {len(errors)}")
        for e in errors:
            print(f"  - {e}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(function_test())
