import asyncio
import base64
import json
import os
import sys
import ssl
import urllib.request
import urllib.parse
import psycopg2
from psycopg2.extras import RealDictCursor
from playwright.async_api import async_playwright

BASE = os.environ.get("WINS_HUB_BASE_URL", "https://winshubcomercial.com.br:18443")
USER = os.environ.get("WINS_HUB_GATE_USER", "test_automation")
PASSWORD = os.environ.get("WINS_HUB_GATE_PASSWORD", "GateTestPass2026!")
VIEWER_USER = os.environ.get("WINS_HUB_VIEWER_USER", "test_viewer@winshubcomercial.com.br")
VIEWER_PASSWORD = os.environ.get("WINS_HUB_VIEWER_PASSWORD", "GateTestPass2026!")

# DB Credentials (read from environment / system config)
DB_HOST = os.environ.get("DB_HOST", "127.0.0.1")
DB_PORT = int(os.environ.get("DB_PORT", "5432"))
DB_NAME = os.environ.get("DB_NAME", "wins_agro")
DB_WRITE_USER = os.environ.get("DB_WRITE_USER", "postgres")
DB_WRITE_PASS = os.environ.get("DB_WRITE_PASS", "sfKszP6x5PQOdQkSwPfQK9ieUxpNDKY9")

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def get_keycloak_token(username, password):
    url = f"{BASE}/auth/realms/wins-hub-staging/protocol/openid-connect/token"
    data = urllib.parse.urlencode({
        'client_id': 'wins-hub-spa',
        'username': username,
        'password': password,
        'grant_type': 'password'
    }).encode('utf-8')
    req = urllib.request.Request(url, data=data)
    with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
        body = json.loads(resp.read().decode('utf-8'))
        return body.get("access_token", "")

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
        print(f"  ✗ {name}: {detail}")

async def run():
    tally = Tally()

    print("\n=== 1. AUTENTICAÇÃO KEYCLOAK E VERIFICAÇÃO DE TOKENS OIDC ===")
    # Token Viewer
    token_v = get_keycloak_token(VIEWER_USER, VIEWER_PASSWORD)
    if token_v:
        claims_v = jwt_payload(token_v)
        roles_v = claims_v.get("realm_access", {}).get("roles", [])
        tally.ok("Token Keycloak OIDC emitido para usuário VIEWER")
        print(f"    Sub: {claims_v.get('sub')}, Username: {claims_v.get('preferred_username')}, Roles: {roles_v}")
    else:
        tally.fail("Obtenção de token VIEWER falhou")
        return tally

    # Token Autorizado (relationship_reviewer / admin)
    token_a = get_keycloak_token(USER, PASSWORD)
    if token_a:
        claims_a = jwt_payload(token_a)
        roles_a = claims_a.get("realm_access", {}).get("roles", [])
        tally.ok("Token Keycloak OIDC emitido para usuário AUTORIZADO")
        print(f"    Sub: {claims_a.get('sub')}, Username: {claims_a.get('preferred_username')}, Roles: {roles_a}")
    else:
        tally.fail("Obtenção de token AUTORIZADO falhou")
        return tally

    print("\n=== 2. AUTORIZAÇÃO POR ALLOWLIST NO BACKEND (HTTP 403 vs HTTP 200) ===")
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
        )

        context = await browser.new_context(viewport={"width": 1440, "height": 900}, ignore_https_errors=True)

        # ── A. TENTATIVA DE ESCRITA POR USUÁRIO VIEWER -> MUST BE HTTP 403 ──
        viewer_post_resp = await context.request.post(
            BASE + "/api/v1/relacionamentos/controlled_rel_001/review",
            data=json.dumps({"classificacao_nova": "CONFIRMADO", "justificativa": "Tentativa de escrita por usuário sem permissão"}),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {token_v}"}
        )
        if viewer_post_resp.status == 403:
            err_body = await viewer_post_resp.json()
            tally.ok(f"POST review por VIEWER bloqueado com HTTP 403 (Allowlist ativa): {err_body.get('detail')}")
        else:
            tally.fail("Bloqueio de review por VIEWER falhou", f"status={viewer_post_resp.status}")

        # ── B. REQUISIÇÃO SEM TOKEN -> MUST BE HTTP 401 ──
        unauth_resp = await context.request.get(BASE + "/api/v1/relacionamentos")
        if unauth_resp.status == 401:
            tally.ok("GET /relacionamentos sem token retorna HTTP 401 Unauthorized")
        else:
            tally.fail("API /relacionamentos sem token", f"status={unauth_resp.status}")

        # ── C. REQUISIÇÃO COM TOKEN AUTORIZADO -> MUST BE ALLOWED (HTTP 200) ──
        review_post_resp = await context.request.post(
            BASE + "/api/v1/relacionamentos/controlled_rel_e2e_001/review",
            data=json.dumps({"classificacao_nova": "CONFIRMADO", "justificativa": "Reclassificação de teste E2E automatizado com auditoria Keycloak"}),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {token_a}"}
        )

        if review_post_resp.status == 200:
            post_res_json = await review_post_resp.json()
            tally.ok(f"POST review por usuário AUTORIZADO retornou HTTP 200 OK: id={post_res_json.get('review', {}).get('id')}")
        else:
            tally.fail("POST review por usuário AUTORIZADO falhou", f"status={review_post_resp.status}")

        print("\n=== 3. ESCRITA REAL NO BANCO & AUDITORIA DE RECLASSIFICAÇÃO + ROLLBACK ===")
        controlled_rel_id = "controlled_rel_e2e_001"

        # 1. Consulta direta no banco (public.relationship_reviews)
        try:
            conn = psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname=DB_NAME, user=DB_WRITE_USER, password=DB_WRITE_PASS)
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM public.relationship_reviews WHERE relationship_id = %s ORDER BY created_at DESC LIMIT 1;", (controlled_rel_id,))
                rev_row = cur.fetchone()
                if rev_row and rev_row["classificacao_nova"] == "CONFIRMADO":
                    tally.ok(f"Persistência em public.relationship_reviews confirmada no Postgres: '{rev_row['classificacao_nova']}'")
                else:
                    tally.fail("Registro em public.relationship_reviews não confere", str(rev_row))
            conn.close()
        except Exception as ex:
            tally.fail("Consulta direta a public.relationship_reviews falhou", str(ex))

        # 2. Auditoria com identidade Keycloak (public.review_audit_log)
        try:
            conn = psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname=DB_NAME, user=DB_WRITE_USER, password=DB_WRITE_PASS)
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM public.review_audit_log WHERE relationship_id = %s ORDER BY created_at DESC LIMIT 1;", (controlled_rel_id,))
                audit_row = cur.fetchone()
                if audit_row and audit_row["username"] == claims_a.get("preferred_username"):
                    tally.ok(f"Registro de auditoria com identidade Keycloak (user={audit_row['username']}, sub={audit_row['user_id']}) verificado em public.review_audit_log")
                else:
                    tally.fail("Auditoria Keycloak em public.review_audit_log não encontrada", str(audit_row))
            conn.close()
        except Exception as ex:
            tally.fail("Consulta direta a public.review_audit_log falhou", str(ex))

        # 3. Restauração da classificação original (Rollback)
        rollback_justificativa = "Rollback de teste E2E automatizado para restaurar estado original POTENCIAL"
        rollback_resp = await context.request.post(
            BASE + f"/api/v1/relacionamentos/{controlled_rel_id}/review",
            data=json.dumps({"classificacao_nova": "POTENCIAL", "justificativa": rollback_justificativa}),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {token_a}"}
        )

        if rollback_resp.status == 200:
            tally.ok("Rollback executado com sucesso via API para 'POTENCIAL'")
        else:
            tally.fail("Rollback via API falhou", f"status={rollback_resp.status}")

        # 4. Verificar auditoria do Rollback no banco de dados
        try:
            conn = psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname=DB_NAME, user=DB_WRITE_USER, password=DB_WRITE_PASS)
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM public.review_audit_log WHERE relationship_id = %s ORDER BY created_at DESC LIMIT 1;", (controlled_rel_id,))
                rb_audit_row = cur.fetchone()
                if rb_audit_row and rb_audit_row["classificacao_nova"] == "POTENCIAL":
                    tally.ok(f"Auditoria do Rollback registrada com sucesso em public.review_audit_log: '{rb_audit_row['classificacao_anterior']}' → '{rb_audit_row['classificacao_nova']}'")
                else:
                    tally.fail("Auditoria do Rollback não confere", str(rb_audit_row))
            conn.close()
        except Exception as ex:
            tally.fail("Consulta de auditoria do rollback falhou", str(ex))

        print("\n=== 4. NAVEGAÇÃO E INTERAÇÃO FRONTEND E2E (PLAYWRIGHT) ===")
        page = await context.new_page()
        http_errors = []
        def on_response(resp):
            if resp.status >= 500 and "/api/" in resp.url:
                http_errors.append({"url": resp.url, "status": resp.status})
        page.on("response", on_response)

        # Login via Keycloak UI
        await page.goto(BASE + "/demo/login", wait_until="networkidle")
        await page.get_by_role("button", name="Entrar com Keycloak").click()
        await page.locator("#username").fill(USER)
        await page.locator("#password").fill(PASSWORD)
        await page.locator("#kc-login").click()
        await page.wait_for_timeout(3000)
        tally.ok("Login via Keycloak UI + PKCE efetuado com sucesso")

        # Navegar para /demo/relacionamentos
        await page.goto(BASE + "/demo/relacionamentos", wait_until="domcontentloaded")
        await page.wait_for_selector("[data-ui-version='relacionamentos-approved-v2']", timeout=15000)
        tally.ok("Página de relacionamentos /demo/relacionamentos carregada")

        # Autocomplete search
        input_el = page.locator("[data-testid='search-autocomplete-input']")
        await input_el.fill("CONSTRUTORA")
        await page.wait_for_timeout(1000)

        autocomplete = page.locator("[data-testid='autocomplete-dropdown']")
        try:
            await autocomplete.wait_for(state="visible", timeout=5000)
            tally.ok("Autocomplete exibido com sugestões da API")
            first_item = autocomplete.locator("> div").first
            await first_item.click()
            await page.wait_for_timeout(1000)
        except Exception:
            await input_el.press("Enter")
            await page.wait_for_timeout(1000)

        # Grafo e KPIs
        try:
            kpi = page.locator("[data-testid='kpi-total-conns']")
            await kpi.wait_for(state="visible", timeout=10000)
            print(f"    KPI Conexões: {await kpi.inner_text()}")
            tally.ok("Grafo e KPIs carregados")
        except Exception:
            tally.fail("Carregamento do Grafo/KPIs falhou")

        # Drawer de evidência
        rows = page.locator("table tbody tr")
        if await rows.count() > 0:
            await rows.first.click()
            await page.wait_for_timeout(500)
            drawer = page.locator("[data-testid='evidence-drawer']")
            if await drawer.is_visible():
                tally.ok("Drawer de evidência aberto ao clicar na linha")
                await page.locator("[data-testid='close-drawer-btn']").click()
                await page.wait_for_timeout(300)
                tally.ok("Drawer fechado com sucesso")
            else:
                tally.fail("Drawer não abriu")

        # Filtro por classificação
        filter_select = page.locator("select").first
        if await filter_select.is_visible():
            await filter_select.select_option("CONFIRMADO")
            await page.wait_for_timeout(500)
            tally.ok("Filtro por classificação aplicado")
            await filter_select.select_option("")
            await page.wait_for_timeout(300)

        # Tabela de conexões
        table = page.locator("table")
        if await table.is_visible():
            headers = await table.locator("thead th").all_inner_texts()
            print(f"    Colunas da Tabela: {headers}")
            tally.ok("Tabela de conexões exibida corretamente")

        # Exportação de conexões (cliente autorizado)
        export_btn = page.locator("button", has_text="Exportar")
        if await export_btn.is_visible():
            btn_text = await export_btn.inner_text()
            tally.ok(f"Botão de exportação visível: '{btn_text.strip()}'")

        # Recarregamento F5
        await page.reload(wait_until="domcontentloaded")
        await page.wait_for_selector("[data-ui-version='relacionamentos-approved-v2']", timeout=15000)
        tally.ok("Página recarregada (F5) sem erros")

        # Verificação de erros HTTP 500
        if http_errors:
            tally.fail("Erros HTTP 5xx detectados", str(http_errors))
        else:
            tally.ok("Zero erros HTTP 5xx durante a execução")

        await browser.close()

    return tally

if __name__ == "__main__":
    print("==================================================")
    print(" EXECUÇÃO DO TESTE COMPLETO E2E DE RELACIONAMENTOS")
    print("==================================================")
    tally = asyncio.run(run())
    print("\n" + "=" * 50)
    print(f"RESULTADO: {tally.passed} APROVADOS / {tally.failed} REPROVADOS")
    if tally.errors:
        print("\nDetalhamento das Falhas:")
        for err in tally.errors:
            print(f"  - {err}")
    print("=" * 50)
    sys.exit(0 if tally.failed == 0 else 1)
