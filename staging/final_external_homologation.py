import asyncio
import base64
import hashlib
import json
import os
import struct
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright

BASE = "https://winshubcomercial.com.br:18443"
USER = os.environ["WINS_HUB_GATE_USER"]
PASSWORD = os.environ["WINS_HUB_GATE_PASSWORD"]
if USER.casefold() == "williamvnvn@gmail.com":
    raise RuntimeError("Usuários humanos não podem ser usados por gates automatizados")
OUT = Path("/root/wins_hub_unificado/screenshots/final-external-20260722")

def jwt_payload(token):
    raw = token.split('.')[1]
    raw += '=' * (-len(raw) % 4)
    return json.loads(base64.urlsafe_b64decode(raw))

def png_size(path):
    with path.open('rb') as f:
        f.read(16)
        return struct.unpack('>II', f.read(8))

async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob('*.png'):
        old.unlink()
    result = {"base": BASE + "/demo/", "auth": {}, "screens": [], "console_errors": [], "http_errors": []}
    token_data = {}
    token_exchanges = []
    current_screen = "auth"
    screen_api = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path="/usr/bin/chromium-browser", headless=True, args=["--no-sandbox"])
        context = await browser.new_context(viewport={"width": 1440, "height": 900}, ignore_https_errors=False)
        page = await context.new_page()

        async def on_response(response):
            nonlocal token_data
            if "/protocol/openid-connect/token" in response.url:
                try:
                    body = await response.json()
                    if body.get("access_token"):
                        token_data = body
                    post_data = response.request.post_data or ""
                    token_exchanges.append({"status": response.status, "request_keys": sorted(part.split('=', 1)[0] for part in post_data.split('&') if '=' in part), "error": body.get("error")})
                except Exception:
                    pass
            if response.url.startswith(BASE + "/api/"):
                screen_api.append({"screen": current_screen, "status": response.status, "url": response.url})
            if response.status >= 400:
                result["http_errors"].append({"screen": current_screen, "status": response.status, "url": response.url})
        page.on("response", on_response)
        page.on("console", lambda m: result["console_errors"].append({"screen": current_screen, "type": m.type, "text": m.text}) if m.type == "error" else None)
        page.on("pageerror", lambda e: result["console_errors"].append({"screen": current_screen, "type": "pageerror", "text": str(e)}))

        await page.goto(BASE + "/demo/login", wait_until="networkidle")
        await page.get_by_role("button", name="Entrar com Keycloak").click()
        await page.locator("#username").fill(USER)
        await page.locator("#password").fill(PASSWORD)
        await page.locator("#kc-login").click()
        await page.wait_for_url("**/demo/**", timeout=30000)
        await page.wait_for_load_state("networkidle")
        if not token_data.get("access_token"):
            raise RuntimeError("Authorization Code + PKCE não emitiu token")
        claims = jwt_payload(token_data["access_token"])
        roles = claims.get("realm_access", {}).get("roles", [])
        result["auth"] = {
            "flow": "authorization_code + PKCE S256",
            "token_issued": True,
            "refresh_token_issued": bool(token_data.get("refresh_token")),
            "issuer": claims.get("iss"),
            "audience": claims.get("aud"),
            "subject": claims.get("sub"),
            "roles": roles,
            "expires_at": claims.get("exp"),
            "authorization_code_exchanges": token_exchanges,
        }
        result["auth"]["session_cookies"] = [{"name": c["name"], "domain": c["domain"], "secure": c["secure"], "sameSite": c["sameSite"]} for c in await context.cookies() if "winshubcomercial.com.br" in c["domain"]]
        date_probe = await context.request.get(BASE + "/demo/")
        result["auth"]["server_date"] = date_probe.headers.get("date")
        headers = {"Authorization": "Bearer " + token_data["access_token"]}

        refresh = await context.request.post(BASE + "/auth/realms/wins-hub-staging/protocol/openid-connect/token", form={
            "client_id": "wins-hub-spa", "grant_type": "refresh_token", "refresh_token": token_data["refresh_token"]
        })
        refreshed = await refresh.json()
        result["auth"]["refresh_status"] = refresh.status
        result["auth"]["refresh_token_rotated"] = bool(refreshed.get("refresh_token"))
        if refresh.status != 200:
            raise RuntimeError("Refresh token rejeitado")

        async def api(path):
            response = await context.request.get(BASE + "/api/v1" + path, headers=headers)
            if response.status != 200:
                raise RuntimeError(f"API {path}: HTTP {response.status}")
            return await response.json()

        work = (await api("/engenharia/obras?page_size=1&sort=investment_desc"))["items"][0]
        company = (await api("/empresas?page_size=1&active=true&sort=updated_desc"))["items"][0]
        prop = (await api("/agro/imoveis?page_size=1"))["items"][0]
        cnes = (await api("/saude/estabelecimentos?page_size=1"))["items"][0]
        complete = await api("/agro/reprodutores/CXP0272")
        absent = await api("/agro/genealogia/JCVL3176")
        complete_genealogy = await api("/agro/genealogia/CXP0272")
        veterinary = await api("/agro/veterinaria/classificacao")
        result["genealogy"] = {
            "absent": {"registro": absent["individual"]["registro"], "classification": absent["classification"], "message": absent["message"], "parents_null": absent["sire"] is None and absent["dam"] is None and absent["maternalGrandSire"] is None},
            "complete": {"registro": complete_genealogy["individual"]["registro"], "classification": complete_genealogy["classification"], "sire": complete_genealogy["sire"], "dam": complete_genealogy["dam"], "maternalGrandSire": complete_genealogy["maternalGrandSire"], "source": complete.get("fonte_programa"), "evaluations": len(complete.get("avaliacoes", []))},
        }
        result["veterinary_categories"] = veterinary["categories"]
        result["veterinary_companies_sample"] = veterinary["companies"][:3]

        screens = [
            ("engenharia", "/demo/engenharia", "h1", work["nome"], "wins_agro.engenharia.obras"),
            ("detalhe-obra", f"/demo/engenharia/obras/{work['source_id']}", "h1", work["nome"], "wins_agro.engenharia.obras"),
            ("empresa-360", f"/demo/empresas/{company['source_id']}", "h1", company.get("razao_social") or company["source_id"], "wins_agro.core.empresa"),
            ("agro", "/demo/agro", "h1", "Inteligência Agro Real", "SICAR / CAR / CREA / RFB"),
            ("detalhe-imovel", f"/demo/agro/imoveis/{prop['source_id']}", '[data-testid="agro-imovel-detail"]', prop.get("nome_imovel") or prop["codigo_car"], "wins_agro.prospeccao.imovel_rural"),
            ("ficha-reprodutor", "/demo/agro/reprodutores/CXP0272", '[data-testid="agro-reprodutor-detail"]', "CAFE · CXP0272", "wins_agro.mercado.reprodutor"),
            ("genealogia-ausente", "/demo/agro/genealogia/JCVL3176", '[data-testid="genealogia-ausente"]', "JCVL3176", "wins_agro.mercado.reprodutor"),
            ("genealogia-completa", "/demo/agro/genealogia/CXP0272", '[data-testid="genealogia-arvore"]', "CXP0272", "wins_agro.mercado.reprodutor"),
            ("doadoras", "/demo/agro/doadoras", '[data-testid="agro-doadoras"]', "6 doadoras", "wins_agro.mercado.doadora"),
            ("embrioes", "/demo/agro/embrioes", '[data-testid="agro-embrioes"]', "34 lotes", "wins_agro.mercado.oferta_embriao"),
            ("logistica", "/demo/logistica", "h1", "Inteligência Logística Real", "caminhao_vazio_staging.rntrc_transportadores"),
            ("saude", "/demo/saude", "h1", "Inteligência em Saúde Real", "wins_saude_staging.estabelecimentos"),
            ("detalhe-cnes", f"/demo/saude/estabelecimentos/{cnes['cnes_id']}", '[data-testid="saude-cnes-detail"]', cnes.get("nome_fantasia") or cnes.get("razao_social"), "DATASUS CNES"),
            ("relacionamentos", "/demo/relacionamentos", "h1", "Relacionamentos", "fontes reais multiverticais"),
        ]
        for index, (name, route, selector, entity, source) in enumerate(screens, 1):
            current_screen = name
            before = len(screen_api)
            await page.goto(BASE + route, wait_until="networkidle", timeout=60000)
            await page.locator(selector).first.wait_for(state="visible", timeout=30000)
            if await page.locator('[data-testid="real-data-error"]').count():
                raise RuntimeError(f"Estado de erro visível em {name}")
            file = OUT / f"{index:02d}-{name}.png"
            await page.screenshot(path=file, full_page=True)
            width, height = png_size(file)
            result["screens"].append({
                "name": name, "file": str(file), "sha256": hashlib.sha256(file.read_bytes()).hexdigest(),
                "bytes": file.stat().st_size, "width": width, "height": height,
                "timestamp": datetime.now(timezone.utc).isoformat(), "url": page.url,
                "host": urlparse(page.url).netloc, "selector": selector, "entity": entity,
                "source": source, "api": screen_api[before:]
            })
        hashes = [x["sha256"] for x in result["screens"]]
        result["unique_hashes"] = len(hashes) == len(set(hashes))
        current_screen = "logout"
        await page.get_by_title("Sair da Conta").click()
        await page.wait_for_timeout(1500)
        result["auth"]["logout_url"] = page.url
        await browser.close()
    Path("/root/wins_hub_unificado/staging/final_external_homologation.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if result["console_errors"] or result["http_errors"] or not result["unique_hashes"]:
        raise SystemExit(1)

if __name__ == "__main__":
    asyncio.run(main())
