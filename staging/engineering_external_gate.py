import asyncio,hashlib,json,os
from datetime import datetime,timezone
from pathlib import Path
from playwright.async_api import async_playwright

BASE="https://winshubcomercial.com.br:18443";USER=os.environ["WINS_HUB_GATE_USER"];PASSWORD=os.environ["WINS_HUB_GATE_PASSWORD"]
if USER.casefold()=="williamvnvn@gmail.com":raise RuntimeError("Usuário humano bloqueado no gate")
OUT=Path("screenshots/engineering-final-20260722")

async def main():
 OUT.mkdir(parents=True,exist_ok=True);ev={"host":"winshubcomercial.com.br:18443","api":[],"consoleErrors":[],"httpErrors":[],"checks":{},"screenshots":[]}
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path="/usr/bin/chromium-browser",headless=True,args=["--no-sandbox"]);ctx=await browser.new_context(viewport={"width":1440,"height":1000});page=await ctx.new_page()
  page.on("console",lambda m:ev["consoleErrors"].append(m.text) if m.type=="error" else None)
  page.on("response",lambda r:ev["api"].append({"status":r.status,"url":r.url}) if "/api/v1/engenharia/" in r.url else None)
  page.on("response",lambda r:ev["httpErrors"].append({"status":r.status,"url":r.url}) if r.status>=400 and "/api/v1/" in r.url else None)
  await page.goto(BASE+"/demo/login",wait_until="networkidle");await page.get_by_role("button",name="Entrar com Keycloak").click();await page.locator("#username").fill(USER);await page.locator("#password").fill(PASSWORD);await page.locator("#kc-login").click();await page.wait_for_url("**/demo/**")
  async def shot(name):
   path=OUT/f"{name}.png";await page.screenshot(path=str(path),full_page=True);raw=path.read_bytes();ev["screenshots"].append({"file":str(path),"bytes":len(raw),"sha256":hashlib.sha256(raw).hexdigest(),"timestamp":datetime.now(timezone.utc).isoformat(),"url":page.url,"dimensions":[1440,1000]})
  await page.goto(BASE+"/demo/engenharia",wait_until="domcontentloaded",timeout=90000);await page.get_by_text("Empresas multiverticais").wait_for(timeout=90000);body=await page.locator("body").inner_text()
  ev["checks"].update({"totalWorks":"16.633" in body,"financialValue":"R$ 243,5 bi" in body or "R$ 243,5 bi" in body,"coverage":"18,91%" in body,"multiverticalCompanies":"2.959" in body,"multiverticalSuppliers":"632" in body,"confirmedRelations":"3.576" in body,"improperZero":"R$ 0" in body})
  investment=page.get_by_text("Investimento homologado",exact=True).locator("xpath=ancestor::a");ev["checks"]["investmentHref"]=await investment.get_attribute("href");await shot("engenharia-dashboard-final");await investment.click();await page.wait_for_url("**/engenharia/obras?**capex_homologado=true**");await page.get_by_label("CAPEX homologado").wait_for();ev["checks"]["capexFilteredTotal"]=await page.locator(".results-line").first.inner_text();await shot("engenharia-capex-homologado")
  map_cases=[("nacional","/demo/engenharia/mapa"),("uf-pr","/demo/engenharia/mapa?uf=PR&zoom=6"),("municipio-curitiba","/demo/engenharia/mapa?uf=PR&municipality=Curitiba&zoom=10"),("status","/demo/engenharia/mapa?status=Em%20andamento"),("fase","/demo/engenharia/mapa?phase=Licenciamento"),("empresa","/demo/engenharia/mapa?company=02846056000197"),("oportunidade","/demo/engenharia/mapa?hasOpportunity=true"),("capex","/demo/engenharia/mapa?capex_homologado=true")]
  for name,path in map_cases:
   await page.goto(BASE+path,wait_until="domcontentloaded",timeout=90000);await page.get_by_text("sem amostragem",exact=False).wait_for(timeout=90000);txt=await page.locator(".map-count").inner_text();ev["checks"][f"map_{name}"]={"url":page.url,"count":txt,"markers":await page.locator(".leaflet-interactive").count()};
   if name in ("nacional","uf-pr","municipio-curitiba"):await shot("engenharia-mapa-"+name)
  await page.goto(BASE+"/demo/engenharia/mapa",wait_until="domcontentloaded");await page.get_by_text("sem amostragem",exact=False).wait_for(timeout=90000)
  layer_results={}
  for label in ("Obras","Empresas","Fornecedores","Oportunidades"):
   box=page.locator(".map-filterbar label").filter(has_text=label).locator("input");before=await page.locator(".leaflet-interactive").count()
   async with page.expect_response(lambda r:"/api/v1/engenharia/mapa" in r.url,timeout=90000) as pending:await box.uncheck()
   response=await pending.value;await page.get_by_text("sem amostragem",exact=False).wait_for();after=await page.locator(".leaflet-interactive").count();layer_results[label]={"status":response.status,"before":before,"after":after,"disabled":not await box.is_checked()}
  ev["checks"]["layers"]=layer_results
  works_box=page.locator(".map-filterbar label").filter(has_text="Obras").locator("input")
  async with page.expect_response(lambda r:"/api/v1/engenharia/mapa" in r.url,timeout=90000):await works_box.check()
  first=page.locator(".leaflet-interactive").first
  if await first.count():
   old=page.url;await first.click(force=True);await page.get_by_role("link",name="Abrir detalhe").wait_for(timeout=90000);href=await page.get_by_role("link",name="Abrir detalhe").get_attribute("href");ev["checks"]["detailNavigation"]={"href":href,"stateChanged":page.url!=old};await page.go_back();ev["checks"]["backPreserved"]="/engenharia/mapa" in page.url
  await browser.close()
 ok=all([ev["checks"]["totalWorks"],ev["checks"]["financialValue"],ev["checks"]["coverage"],ev["checks"]["multiverticalCompanies"],ev["checks"]["multiverticalSuppliers"],ev["checks"]["confirmedRelations"],not ev["checks"]["improperZero"],"capex_homologado=true" in (ev["checks"]["investmentHref"] or ""),all(x["status"]==200 and x["disabled"] for x in ev["checks"]["layers"].values()),not ev["consoleErrors"],not ev["httpErrors"],all(x["status"]==200 for x in ev["api"])])
 ev["verdict"]="PASS" if ok else "FAIL";Path("staging/engineering_external_gate.json").write_text(json.dumps(ev,ensure_ascii=False,indent=2));print(json.dumps(ev,ensure_ascii=False,indent=2))

try:asyncio.run(main())
except Exception as error:
 Path("staging/engineering_external_gate.json").write_text(json.dumps({"host":"winshubcomercial.com.br:18443","verdict":"FAIL","error":f"{type(error).__name__}: {error}"},ensure_ascii=False,indent=2));raise
