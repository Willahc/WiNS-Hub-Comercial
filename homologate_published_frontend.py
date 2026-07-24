import asyncio
import os
from pathlib import Path
from playwright.async_api import async_playwright

BASE=os.environ.get('DEMO_BASE', 'https://winshubcomercial.com.br:18443').rstrip('/')
OUT=Path('/root/wins_hub_unificado/screenshots/homologacao-final'); OUT.mkdir(parents=True,exist_ok=True)
ROUTES={
 'visao-geral':'/demo/',
 'eventos':'/demo/eventos',
 'mapa':'/demo/mapa',
 'oportunidades':'/demo/oportunidades',
 'empresas':'/demo/empresas',
 'comercial':'/demo/comercial',
 'engenharia':'/demo/engenharia',
 'logistica':'/demo/logistica',
 'agro':'/demo/agro',
 'saude':'/demo/saude',
 'territorial':'/demo/territorial',
 'configuracoes':'/demo/configuracoes',
 'login':'/demo/login',
 'evento-detalhe':'/demo/eventos/evt-01',
 'oportunidade-detalhe':'/demo/oportunidades/hub-opp-01',
 'empresa-360':'/demo/empresas/hub-co-01',
 'obra-detalhe':'/demo/engenharia/obras/obra-001',
 'engenharia-mapa':'/demo/engenharia/mapa',
 'engenharia-obras':'/demo/engenharia/obras',
 'engenharia-empresas':'/demo/engenharia/empresas',
}
FORBIDDEN=['módulo integrado','esta tela está acoplada','portal institucional','caminhao-vazio','/agro/empresa-360']

async def main():
 errors=[]; broken=[]; results=[]
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,args=['--no-sandbox'])
  for theme in ['dark','light']:
   for width,height in [(1920,1080),(390,844)]:
    ctx=await browser.new_context(viewport={'width':width,'height':height},is_mobile=width==390)
    page=await ctx.new_page()
    page.on('pageerror',lambda e:errors.append(f'pageerror {e}'))
    page.on('console',lambda m:errors.append(f'console {m.text}') if m.type=='error' else None)
    page.on('response',lambda r:broken.append(f'{r.status} {r.url}') if r.status>=400 else None)
    await page.goto(BASE+'/demo/',wait_until='networkidle')
    for name,path in ROUTES.items():
     profile='anonymous' if name=='login' else 'admin'
     await page.evaluate(f"localStorage.setItem('wins_simulated_user','{profile}');localStorage.setItem('wins-theme','{theme}')")
     await page.goto(BASE+path,wait_until='networkidle')
     body=(await page.locator('body').inner_text()).lower()
     final=page.url
     if '/demo/' not in final: errors.append(f'fora de /demo/: {path} -> {final}')
     if any(x in body for x in FORBIDDEN): errors.append(f'conteúdo proibido em {path}')
     if 'wins hub' not in body: errors.append(f'WiNS Hub ausente em {path}')
     if name=='logistica' and 'otimização de retorno de frota' not in body: errors.append('Caminhão Vazio ausente do contexto Logística')
     if name!='logistica' and 'otimização caminhão vazio' in body and name not in ('oportunidades','oportunidade-detalhe','comercial','empresa-360'): errors.append(f'Caminhão Vazio como identidade fora de Logística em {path}')
     if name=='empresa-360' and 'visão transversal' not in body: errors.append('Empresa 360 não identificada como transversal')
     results.append((theme,width,path,final))
     if theme=='dark' and width==1920 and name in ('visao-geral','engenharia','logistica','agro','saude','empresa-360'):
      await page.screenshot(path=OUT/f'{name}_1920x1080.png',full_page=True)
     await page.reload(wait_until='networkidle')
    if width==390:
     await page.goto(BASE+'/demo/',wait_until='networkidle')
     await page.locator('.topbar .sidebar-toggle').click()
     if not await page.locator('.sidebar.open').is_visible(): errors.append(f'menu mobile não abriu no tema {theme}')
    await ctx.close()
  check=await browser.new_page(viewport={'width':1366,'height':768})
  await check.goto(BASE+'/demo/',wait_until='networkidle')
  vertical_links=check.locator('.sidebar .nav-section:has-text("Verticais Oficiais") ~ a')
  names=[]
  for i in range(await vertical_links.count()):
   text=(await vertical_links.nth(i).inner_text()).strip()
   if text in ('Engenharia','Logística','Agro','Saúde'): names.append(text)
  if names!=['Engenharia','Logística','Agro','Saúde']:errors.append(f'verticais inválidas: {names}')
  await browser.close()
 print(f'base={BASE}/demo/ routes={len(ROUTES)} executions={len(results)} console_errors={len(errors)} broken={len(broken)}')
 for _,_,path,final in results[:20]:print(f'OK {path} -> {final}')
 for item in errors+broken:print(f'ERROR {item}')
 raise SystemExit(1 if errors or broken else 0)

if __name__=='__main__':asyncio.run(main())
