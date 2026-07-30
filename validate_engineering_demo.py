import asyncio
import os
import subprocess
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path('/root/wins_hub_unificado')
OUT = ROOT / 'screenshots' / 'demo'
OUT.mkdir(parents=True, exist_ok=True)
ROUTES = {
    'engenharia': '/demo/engenharia',
    'mapa': '/demo/engenharia/mapa',
    'detalhe-obra': '/demo/engenharia/obras/obra-001',
    'empresa-360': '/demo/empresas/emp-01',
}

async def main():
    target = os.environ.get('DEMO_TARGET', 'http://127.0.0.1:4173')
    server = None
    if target.startswith('http://127.0.0.1:4173'):
        server = subprocess.Popen(['npm','run','preview','--','--host','127.0.0.1','--port','4173'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        await asyncio.sleep(2)
    errors, broken = [], []
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            for width, height in [(1920,1080),(1366,768)]:
                context = await browser.new_context(viewport={'width':width,'height':height})
                for name, route in ROUTES.items():
                    page = await context.new_page()
                    page.on('pageerror', lambda error: errors.append(str(error)))
                    page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
                    page.on('response', lambda response: broken.append(f'{response.status} {response.url}') if response.status >= 400 else None)
                    await page.goto(f'{target}{route}', wait_until='networkidle')
                    await page.screenshot(path=OUT/f'{name}_{width}x{height}.png', full_page=True)
                    if 'engenharia' not in (await page.locator('body').inner_text()).lower():
                        errors.append(f'Conteúdo de Engenharia ausente em {route}')
                    await page.reload(wait_until='networkidle')
                    await page.close()
                context = await browser.new_context(viewport={'width':390,'height':844}, is_mobile=True)
                page = await context.new_page()
                await page.goto(f'{target}/demo/engenharia', wait_until='networkidle')
                await page.locator('.topbar .sidebar-toggle').click()
                if not await page.locator('.sidebar.open').is_visible(): errors.append('Menu mobile não abriu')
                await page.locator('.sidebar a[href="/demo/engenharia/mapa"]').click()
                await page.wait_for_url('**/demo/engenharia/mapa')
                await context.close()
            await browser.close()
    finally:
        if server:
            server.terminate(); server.wait()
    print(f'console_errors={len(errors)}')
    print(f'broken_responses={len(broken)}')
    for item in errors + broken: print(item)
    raise SystemExit(1 if errors or broken else 0)

if __name__ == '__main__': asyncio.run(main())
