import asyncio,hashlib,json,os
from datetime import datetime,timezone
from pathlib import Path
from playwright.async_api import async_playwright
BASE='https://winshubcomercial.com.br:18443';USER=os.environ['WINS_HUB_GATE_USER'];PASSWORD=os.environ['WINS_HUB_GATE_PASSWORD']
if USER.casefold() == 'williamvnvn@gmail.com': raise RuntimeError('Usuários humanos não podem ser usados por gates automatizados')
async def main():
 result={'api':[],'consoleErrors':[],'httpErrors':[]}
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium-browser',headless=True,args=['--no-sandbox']);context=await browser.new_context(viewport={'width':1440,'height':1000});page=await context.new_page()
  page.on('console',lambda m:result['consoleErrors'].append(m.text) if m.type=='error' else None);page.on('response',lambda r:result['api'].append({'status':r.status,'url':r.url}) if '/api/v1/' in r.url else None);page.on('response',lambda r:result['httpErrors'].append({'status':r.status,'url':r.url}) if r.status>=400 else None)
  await page.goto(BASE+'/demo/login',wait_until='networkidle');await page.get_by_role('button',name='Entrar com Keycloak').click();await page.locator('#username').fill(USER);await page.locator('#password').fill(PASSWORD);await page.locator('#kc-login').click();await page.wait_for_url('**/demo/**')
  await page.goto(BASE+'/demo/empresas/09103055000100',wait_until='domcontentloaded');await page.locator('[data-testid="empresa360-agro"]').wait_for(timeout=30000)
  path=Path('screenshots/full-data-external-20260722/empresa360-quatro-verticais.png');await page.locator('.engineering-page').screenshot(path=str(path));raw=path.read_bytes();box=await page.locator('.engineering-page').bounding_box()
  result['screen']={'file':str(path),'bytes':len(raw),'dimensions':[round(box['width']),round(box['height'])],'sha256':hashlib.sha256(raw).hexdigest(),'timestamp':datetime.now(timezone.utc).isoformat(),'url':page.url,'selector':'.engineering-page','agroOccurrenceVisible':await page.get_by_text('ARLEY EMPREENDIMENTOS S.S. LTDA').count()>0}
  result['verdict']='PASS' if result['screen']['agroOccurrenceVisible'] and not result['consoleErrors'] and not result['httpErrors'] and all(x['status']==200 for x in result['api']) else 'FAIL';await browser.close()
 Path('staging/company360_external_gate.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps({'verdict':result['verdict'],'screen':result['screen'],'api':result['api']},ensure_ascii=False,indent=2))
asyncio.run(main())
