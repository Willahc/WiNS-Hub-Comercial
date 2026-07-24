import asyncio, json, os
from pathlib import Path
from playwright.async_api import async_playwright

BASE="https://winshubcomercial.com.br:18443"
USER=os.environ['WINS_HUB_GATE_USER']
PASSWORD=os.environ['WINS_HUB_GATE_PASSWORD']
if USER.casefold() == 'williamvnvn@gmail.com': raise RuntimeError('Usuários humanos não podem ser usados por gates automatizados')

async def main():
 result={}
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium-browser',headless=True,args=['--no-sandbox'])
  context=await browser.new_context()
  page=await context.new_page()
  await page.goto(BASE+'/demo/login',wait_until='networkidle')
  await page.get_by_role('button',name='Entrar com Keycloak').click()
  await page.locator('#username').fill(USER)
  await page.locator('#password').fill(PASSWORD)
  await page.locator('#kc-login').click(); await page.wait_for_url('**/demo/**')
  async def fail(route): await route.abort('failed')
  await page.route('**/api/v1/agro/**',fail)
  await page.goto(BASE+'/demo/agro',wait_until='networkidle')
  error=page.locator('.empty-state.error')
  await error.wait_for(state='visible')
  body=await page.locator('body').inner_text()
  result={'error_visible':True,'retry_visible':await page.get_by_role('button',name='Tentar novamente').count()>0,'data_rows':await page.locator('.works-table tbody tr').count(),'synthetic_markers':any(x in body for x in ['obra-001','emp-01','hub-co-01','12.345.678']),'stale_real_entity_visible':'MA-2114007' in body}
  await page.unroute('**/api/v1/agro/**',fail)
  await page.get_by_role('button',name='Tentar novamente').click()
  await page.get_by_text('Imóveis Rurais Cadastrados (CAR)').wait_for(state='visible',timeout=30000)
  result['restored']=await page.locator('.works-table tbody tr').count()>0
  await browser.close()
 print(json.dumps(result,ensure_ascii=False))
 if not(result['error_visible'] and result['retry_visible'] and result['data_rows']==0 and not result['synthetic_markers'] and not result['stale_real_entity_visible'] and result['restored']):raise SystemExit(1)

asyncio.run(main())
