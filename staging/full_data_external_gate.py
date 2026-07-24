import asyncio, hashlib, json, os
from datetime import datetime, timezone
from pathlib import Path
from playwright.async_api import async_playwright

BASE="https://winshubcomercial.com.br:18443"
USER=os.environ["WINS_HUB_GATE_USER"]
PASSWORD=os.environ["WINS_HUB_GATE_PASSWORD"]
if USER.casefold() == "williamvnvn@gmail.com":
  raise RuntimeError("Usuários humanos não podem ser usados por gates automatizados")
OUT=Path("screenshots/full-data-external-20260722")
ROUTES=[
"agro/imoveis","agro/produtores","agro/fazendas","agro/holdings","agro/agronomos","agro/zootecnistas","agro/veterinarios-nominais","agro/empresas-veterinarias","agro/estabelecimentos-veterinarios","agro/reprodutores","agro/touros-central","agro/doadoras","agro/embrioes","agro/avaliacoes-geneticas",
"logistica/transportadores","logistica/agregados-municipais","logistica/empresas","logistica/postos","logistica/bases-apoio","logistica/pedagios","logistica/rodovias","logistica/riscos-rota",
"saude/estabelecimentos","saude/mantenedoras","saude/medicos","saude/operadoras","saude/capacidade-municipal","saude/desertos-medicos","saude/mercado","saude/oportunidades"]

async def main():
  OUT.mkdir(parents=True,exist_ok=True)
  result={"startedAt":datetime.now(timezone.utc).isoformat(),"host":"winshubcomercial.com.br:18443","screens":[],"api":[],"consoleErrors":[],"httpErrors":[]}
  async with async_playwright() as p:
    browser=await p.chromium.launch(executable_path="/usr/bin/chromium-browser",headless=True,args=["--no-sandbox"])
    context=await browser.new_context(viewport={"width":1440,"height":1000})
    page=await context.new_page()
    page.on("console",lambda m: result["consoleErrors"].append({"text":m.text,"url":page.url}) if m.type=="error" else None)
    page.on("response",lambda r: result["api"].append({"status":r.status,"url":r.url}) if "/api/v1/" in r.url else None)
    page.on("response",lambda r: result["httpErrors"].append({"status":r.status,"url":r.url}) if r.status>=400 else None)
    await page.goto(BASE+"/demo/login",wait_until="networkidle")
    await page.get_by_role("button",name="Entrar com Keycloak").click()
    await page.locator("#username").fill(USER);await page.locator("#password").fill(PASSWORD);await page.locator("#kc-login").click()
    await page.wait_for_url("**/demo/**",timeout=30000)
    for route in ROUTES:
      url=f"{BASE}/demo/{route.split('/')[0]}/diretorios/{route.split('/')[1]}"
      await page.goto(url,wait_until="domcontentloaded",timeout=45000)
      await page.locator('[data-testid="real-directory"]').wait_for(timeout=45000)
      await page.locator('.wave1-source').wait_for(timeout=45000)
      selector='[data-testid="real-directory"]'
      filename=route.replace('/','--')+'.png'; path=OUT/filename
      await page.locator(selector).screenshot(path=str(path))
      raw=path.read_bytes();box=await page.locator(selector).bounding_box()
      result["screens"].append({"file":str(path),"bytes":len(raw),"dimensions":[round(box["width"]),round(box["height"])],"sha256":hashlib.sha256(raw).hexdigest(),"timestamp":datetime.now(timezone.utc).isoformat(),"url":page.url,"selector":selector,"entity":route,"visibleText":(await page.locator('.wave1-source').inner_text())[:300]})
      first=page.locator('a.table-open').first
      if await first.count():
        await first.click();await page.locator('[data-testid="real-directory-detail"]').wait_for(timeout=30000)
        result["screens"][-1]["detailValidatedUrl"]=page.url
        result["screens"][-1]["detailSelector"]='[data-testid="real-directory-detail"]'
    # Busca global real.
    async with page.expect_response(lambda r: "/api/v1/busca-global" in r.url and r.status==200,timeout=90000):
      await page.goto(BASE+"/demo/busca?q=Campinas",wait_until="domcontentloaded")
    await page.locator('[data-testid="global-search"]').wait_for(timeout=60000)
    await page.locator('[data-testid="global-search"] .card button').first.wait_for(timeout=60000)
    path=OUT/'busca-global.png';await page.locator('[data-testid="global-search"]').screenshot(path=str(path));raw=path.read_bytes();box=await page.locator('[data-testid="global-search"]').bounding_box()
    result["screens"].append({"file":str(path),"bytes":len(raw),"dimensions":[round(box['width']),round(box['height'])],"sha256":hashlib.sha256(raw).hexdigest(),"timestamp":datetime.now(timezone.utc).isoformat(),"url":page.url,"selector":'[data-testid="global-search"]',"entity":"busca-global"})
    await page.locator('[data-testid="global-search"] .card button').first.click();await page.locator('[data-testid="real-directory-detail"]').wait_for(timeout=30000);result["globalSearchOpenedUrl"]=page.url
    # Busca, filtro e paginação server-side exercitados numa fonte real.
    await page.goto(BASE+"/demo/saude/diretorios/medicos",wait_until="domcontentloaded");await page.locator('.wave1-source').wait_for(timeout=30000)
    await page.get_by_placeholder('Buscar nesta fonte real').fill('MARIA');await page.get_by_role('button',name='Buscar').click();await page.wait_for_url('**search=MARIA*');await page.locator('.wave1-source').wait_for(timeout=30000)
    result["serverSideSearchValidated"]=page.url
    await page.get_by_placeholder('Buscar nesta fonte real').fill('');await page.get_by_role('button',name='Buscar').click();await page.locator('.wave1-source').wait_for(timeout=30000)
    await page.get_by_role('button',name='Próxima').click();await page.wait_for_url('**page=2*');await page.locator('.wave1-source').wait_for(timeout=30000);result["paginationValidated"]=page.url
    # Município integrado real.
    await page.goto(BASE+"/demo/territorial?municipality=Campinas&uf=SP",wait_until="domcontentloaded")
    await page.locator('[data-testid="territorial-real"] .wave1-source').wait_for(timeout=60000)
    path=OUT/'territorial-campinas.png';await page.locator('[data-testid="territorial-real"]').screenshot(path=str(path));raw=path.read_bytes();box=await page.locator('[data-testid="territorial-real"]').bounding_box()
    result["screens"].append({"file":str(path),"bytes":len(raw),"dimensions":[round(box['width']),round(box['height'])],"sha256":hashlib.sha256(raw).hexdigest(),"timestamp":datetime.now(timezone.utc).isoformat(),"url":page.url,"selector":'[data-testid="territorial-real"]',"entity":"inteligencia-territorial"})
    result["endedAt"]=datetime.now(timezone.utc).isoformat();result["uniqueHashes"]=len({x['sha256'] for x in result['screens']})==len(result['screens']);result["invalidStatuses"]=[x for x in result['api'] if x['status'] in (401,503)];result["verdict"]="PASS" if result["uniqueHashes"] and not result["invalidStatuses"] and not result["consoleErrors"] and not result["httpErrors"] else "FAIL"
    await browser.close()
  Path("staging/full_data_external_gate.json").write_text(json.dumps(result,ensure_ascii=False,indent=2,default=str))
  print(json.dumps({k:result[k] for k in ('verdict','uniqueHashes','invalidStatuses','consoleErrors','httpErrors')},ensure_ascii=False,indent=2))

asyncio.run(main())
