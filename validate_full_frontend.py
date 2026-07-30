import asyncio, os, subprocess
from pathlib import Path
from playwright.async_api import async_playwright

ROOT=Path('/root/wins_hub_unificado'); OUT=ROOT/'screenshots'/'full'; OUT.mkdir(parents=True,exist_ok=True)
ROUTES={
 'visao-geral':'/demo/visao-geral','eventos':'/demo/eventos','evento-detalhe':'/demo/eventos/evt-01',
 'mapa-global':'/demo/mapa','oportunidades':'/demo/oportunidades','oportunidade-detalhe':'/demo/oportunidades/hub-opp-01',
 'empresas-pessoas':'/demo/empresas','empresa-360':'/demo/empresas/hub-co-01','comercial':'/demo/comercial',
 'engenharia':'/demo/engenharia','engenharia-mapa':'/demo/engenharia/mapa','engenharia-obras':'/demo/engenharia/obras',
 'engenharia-detalhe':'/demo/engenharia/obras/obra-001','logistica':'/demo/logistica','agro':'/demo/agro',
 'saude':'/demo/saude','inteligencia-territorial':'/demo/territorial','configuracoes':'/demo/configuracoes','acesso-negado':'/demo/acesso-negado','relatorios':'/demo/relatorios'
}
async def main():
 target=os.environ.get('DEMO_TARGET','http://127.0.0.1:4173'); server=None
 if target.startswith('http://127.0.0.1'):
  server=subprocess.Popen(['npm','run','preview','--','--host','127.0.0.1','--port','4173'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); await asyncio.sleep(2)
 errors=[]; broken=[]
 try:
  async with async_playwright() as p:
   browser=await p.chromium.launch(headless=True,args=['--no-sandbox'])
   context=await browser.new_context(viewport={'width':1920,'height':1080}); page=await context.new_page()
   page.on('pageerror',lambda e:errors.append(f'pageerror: {e}'))
   page.on('console',lambda m:errors.append(f'console: {m.text}') if m.type=='error' else None)
   page.on('response',lambda r:broken.append(f'{r.status} {r.url}') if r.status>=400 else None)
   await page.goto(target+'/demo/login'); await page.evaluate("localStorage.setItem('wins_simulated_user','anonymous')"); await page.reload(wait_until='networkidle'); await page.screenshot(path=OUT/'login_1920x1080.png',full_page=True)
   await page.get_by_role('button',name='Rodrigo Almeida (Admin Geral)').click(); await page.wait_for_url('**/visao-geral')
   for name,route in ROUTES.items():
    await page.goto(target+route,wait_until='networkidle'); body=(await page.locator('body').inner_text()).lower()
    if 'módulo' in body and 'integrado' in body: errors.append(f'placeholder em {route}')
    if 'routeplaceholder' in body: errors.append(f'placeholder técnico em {route}')
    await page.screenshot(path=OUT/f'{name}_1920x1080.png',full_page=True); await page.reload(wait_until='networkidle')
   nav=await page.locator('.nav-section').all_inner_texts(); vert=await page.locator('.sidebar a[href*="/engenharia"],.sidebar a[href*="/logistica"],.sidebar a[href*="/agro"],.sidebar a[href*="/saude"]').count()
   if vert!=4: errors.append(f'verticais na sidebar={vert}')
   await context.close()
   for theme in ['dark','light']:
    for width,height in [(1366,768),(768,1024),(390,844)]:
     ctx=await browser.new_context(viewport={'width':width,'height':height},is_mobile=width==390); pg=await ctx.new_page()
     pg.on('pageerror',lambda e:errors.append(f'pageerror responsive: {e}')); pg.on('console',lambda m:errors.append(f'console responsive: {m.text}') if m.type=='error' else None)
     await pg.goto(target+'/demo/visao-geral',wait_until='networkidle'); await pg.evaluate(f"localStorage.setItem('wins_simulated_user','admin');localStorage.setItem('wins-theme','{theme}')"); await pg.reload(wait_until='networkidle')
     if width==390:
      await pg.locator('.topbar .sidebar-toggle').click()
      if not await pg.locator('.sidebar.open').is_visible():errors.append(f'menu mobile falhou {theme}')
     await pg.screenshot(path=OUT/f'visao-geral_{theme}_{width}x{height}.png',full_page=True)
     await pg.goto(target+'/demo/logistica',wait_until='networkidle'); await pg.screenshot(path=OUT/f'logistica_{theme}_{width}x{height}.png',full_page=True)
     await ctx.close()
   await browser.close()
 finally:
  if server:server.terminate();server.wait()
 print(f'routes={len(ROUTES)} console_errors={len(errors)} broken_responses={len(broken)} screenshots={len(list(OUT.glob("*.png")))}')
 for x in errors+broken:print(x)
 raise SystemExit(1 if errors or broken else 0)
if __name__=='__main__':asyncio.run(main())
