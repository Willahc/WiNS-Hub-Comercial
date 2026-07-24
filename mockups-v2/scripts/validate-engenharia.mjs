import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const screenshotsDir = join(root, 'screenshots');
const reviewDir = join(root, 'review');
mkdirSync(screenshotsDir, { recursive: true });
mkdirSync(reviewDir, { recursive: true });

const BASE = 'https://winshubcomercial.com.br:18443';
const ROUTE = '/mockups-v2/engenharia';
const URL = `${BASE}${ROUTE}`;

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  const icon = ok ? '✅' : '❌';
  console.log(`  ${icon} ${name}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

// ── 1. DESKTOP VALIDATION ──────────────────────
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', msg => {
  if (msg.type() === 'error' && !msg.text().includes('favicon')) consoleErrors.push(msg.text());
});
page.on('pageerror', err => consoleErrors.push(err.message));

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
await page.waitForTimeout(3500);

// Route
check('pathname ends with /mockups-v2/engenharia', page.url().includes(ROUTE));
// h1
check('h1 = Engenharia', (await page.textContent('h1')).trim() === 'Engenharia');
// Subtitle
const bodyText = await page.textContent('body');
check('subtitle visible', bodyText.includes('Carteira de obras, empresas, decisores e oportunidades'));

// 8 KPIs
const kpiLabels = [
  'Obras visíveis', 'CAPEX homologado', 'Municípios cobertos', 'Empresas vinculadas',
  'Oportunidades no recorte', 'Obras sem município', 'Obras sem empresa', 'CAPEX não homologado',
];
let kpiFound = 0;
for (const l of kpiLabels) if (await page.locator(`text=${l}`).count() > 0) kpiFound++;
check('8 KPI cards', kpiFound === 8, `${kpiFound}/8`);

// Sidebar
check('sidebar visible', await page.locator('aside').first().isVisible());
check('sidebar Engenharia active', await page.locator('aside a[href="/engenharia"]').first().isVisible());

// Topbar
check('topbar visible', await page.locator('header').first().isVisible());

// Action bar
check('action bar: Ver obras', await page.getByRole('button', { name: 'Ver obras' }).isVisible());
check('action bar: Fornecedores', await page.getByRole('button', { name: 'Fornecedores' }).isVisible());
check('action bar: Decisores', await page.getByRole('button', { name: 'Decisores' }).isVisible());
check('action bar: Empresas', await page.getByRole('button', { name: 'Empresas', exact: true }).isVisible());
check('action bar: Oportunidades', await page.getByRole('button', { name: 'Oportunidades', exact: true }).isVisible());
check('action bar: Explorar mapa', await page.getByRole('button', { name: 'Explorar mapa' }).isVisible());

// Filters
check('filter card present', await page.locator('text=Filtros da carteira').isVisible());
check('filter: advanced button', await page.locator('text=Avançados').isVisible());
check('filter: apply button', await page.locator('text=Aplicar filtros').isVisible());
check('filter: clear button', await page.locator('text=Limpar').isVisible());
check('filter: save view button', await page.locator('text=Salvar visão').isVisible());

// Open advanced filters and check fields
await page.locator('text=Avançados').click();
await page.waitForTimeout(200);
check('advanced: Setor visible', (await page.locator('text=Setor').count()) > 0);
check('advanced: CAPEX mínimo', (await page.locator('text=CAPEX mínimo').count()) > 0);
check('advanced: CAPEX máximo', (await page.locator('text=CAPEX máximo').count()) > 0);
// Close advanced
await page.locator('text=Avançados').click();

// Works list
check('works list: title', await page.locator('text=Obras prioritárias').isVisible());
check('works list: total count', bodyText.includes('16.633'));

// Context panel
check('context: phase distribution', await page.locator('text=Distribuição por fase').isVisible());
check('context: financial coverage', await page.locator('text=Cobertura financeira').isVisible());
check('context: cadastral quality', await page.locator('text=Qualidade cadastral').isVisible());

// Prioritization
check('prioritization section title', await page.locator('text=Priorização executiva').isVisible());
check('prioritization: maiores investimentos', await page.locator('text=Maiores investimentos').isVisible());
check('prioritization: oportunidades score', await page.locator('text=Oportunidades de maior score').isVisible());
check('prioritization: municípios concentração', await page.locator('text=Municípios com maior concentração').isVisible());
check('prioritization: itens atenção', await page.locator('text=Itens que exigem atenção').isVisible());

// Map
check('map section title', await page.locator('text=Mapa da carteira').isVisible());
check('map visible', await page.locator('.leaflet-container').isVisible());
check('map disclaimer', bodyText.includes('Dados ilustrativos para validação visual do mapa.'));

// Connections
check('connections section title', await page.locator('text=Conexões da carteira').isVisible());
check('connections: CONFIRMADO badge', bodyText.includes('CONFIRMADO'));
check('connections: PROVÁVEL badge', bodyText.includes('PROVÁVEL'));
check('connections: POTENCIAL badge', bodyText.includes('POTENCIAL'));

// Footer
check('footer visible', bodyText.includes('Jul/2026') && bodyText.includes('v2.0.0-mockup'));

// Disclaimer
check('global disclaimer', bodyText.includes('ilustrativos para validação visual do layout'));

// Zero overflow
const overflow = await page.evaluate(() =>
  document.documentElement.scrollWidth <= document.documentElement.clientWidth);
check('zero horizontal overflow', overflow);

// KPI click → toast
await page.locator('[role=button]').first().click();
await page.waitForTimeout(100);
const toastVisible = await page.evaluate(() => {
  const allDivs = document.querySelectorAll('div');
  for (const d of allDivs) {
    if (d.textContent?.includes('disponível na próxima fase')) return true;
  }
  return false;
});
check('KPI click shows toast', toastVisible);

// Console errors
const realErrors = consoleErrors.filter(e => !e.includes('Content Security Policy') && !e.includes('favicon'));
check('zero console errors', realErrors.length === 0, realErrors.length ? realErrors.join('; ') : 'clean');

await ctx.close();

// ── 2. MOBILE VALIDATION ───────────────────────
const mCtx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 } });
const mPage = await mCtx.newPage();
const mErrors = [];
mPage.on('console', msg => {
  if (msg.type() === 'error' && !msg.text().includes('Content Security Policy') && !msg.text().includes('favicon')) mErrors.push(msg.text());
});
mPage.on('pageerror', err => mErrors.push(err.message));
await mPage.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
await mPage.waitForTimeout(2500);

const mSidebarTransform = await mPage.evaluate(() => {
  const aside = document.querySelector('aside');
  return aside?.style?.transform || 'no-transform';
});
check('mobile drawer closed', mSidebarTransform.includes('-100%') || mSidebarTransform === 'no-transform');
check('mobile hamburger', await mPage.locator('button').filter({ has: mPage.locator('svg.lucide-menu') }).count() >= 1);

const mOverflow = await mPage.evaluate(() =>
  document.documentElement.scrollWidth <= document.documentElement.clientWidth);
check('mobile zero overflow', mOverflow);

check('mobile KPIs visible', (await mPage.locator('text=Obras visíveis').count()) > 0);
check('mobile filter card visible', (await mPage.locator('text=Filtros da carteira').count()) > 0);
check('mobile works list visible', (await mPage.locator('text=Obras prioritárias').count()) > 0);
check('mobile prioritization visible', (await mPage.locator('text=Priorização executiva').count()) > 0);
check('mobile map visible', (await mPage.locator('.leaflet-container').count()) > 0);
check('mobile connections visible', (await mPage.locator('text=Conexões da carteira').count()) > 0);

check('mobile zero console errors', mErrors.length === 0, mErrors.length ? mErrors.join('; ') : 'clean');
await mCtx.close();

// ── 3. EXISTING PAGES INTACT ───────────────────
const loginPage = await (await browser.newContext({ ignoreHTTPSErrors: true })).newPage();
await loginPage.goto(`${BASE}/mockups-v2/login`, { waitUntil: 'networkidle0', timeout: 15000 });
const loginText = await loginPage.textContent('body');
check('Login page intact', loginText.includes('Acesso ao WiNS Hub'));
await loginPage.close();

const vgPage = await (await browser.newContext({ ignoreHTTPSErrors: true })).newPage();
await vgPage.goto(`${BASE}/mockups-v2/visao-geral`, { waitUntil: 'networkidle0', timeout: 15000 });
const vgText = await vgPage.textContent('body');
check('Visão Geral intact', vgText.includes('Visão Geral') && vgText.includes('Painel executivo multivertical'));
await vgPage.close();

// ── 4. CAPTURE SCREENSHOTS ─────────────────────
const sizes = [
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'laptop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

for (const size of sizes) {
  const c = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: size.width, height: size.height } });
  const p = await c.newPage();
  await p.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
  await p.waitForTimeout(3000);
  const fp = join(screenshotsDir, `03-engenharia-dashboard-${size.name}.png`);
  await p.screenshot({ path: fp, fullPage: false });
  console.log(`  📸 Captured ${size.name} (${size.width}×${size.height})`);
  await c.close();
}

// Full-page
const fpCtx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1920, height: 1080 } });
const fpPage = await fpCtx.newPage();
await fpPage.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
await fpPage.waitForTimeout(3000);
await fpPage.screenshot({ path: join(screenshotsDir, '03-engenharia-dashboard-fullpage.png'), fullPage: true });
console.log('  📸 Captured fullpage');
await fpCtx.close();

await browser.close();

// ── 5. GENERATE REVIEW HTML ────────────────────
const reviewHtml = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Revisão — Engenharia Dashboard | WiNS Hub</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',sans-serif;background:#1a1a1a;color:#e0e0e0;padding:24px}
  h1{font-size:22px;font-weight:700;margin-bottom:4px}
  h2{font-size:16px;font-weight:600;margin:24px 0 12px;color:#aaa}
  .sub{font-size:13px;color:#888;margin-bottom:20px}
  .card{background:#222;border:1px solid #333;border-radius:12px;padding:20px;margin-bottom:16px}
  .card-header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px}
  .card-title{font-size:18px;font-weight:600;color:#eee}
  .card-desc{font-size:13px;color:#999}
  .img-wrapper{display:flex;justify-content:center;align-items:center;background:#0a0a0a;border-radius:8px;padding:16px;min-height:200px;cursor:zoom-in;overflow:hidden}
  .img-wrapper img{max-width:100%;max-height:75vh;object-fit:contain;display:block;box-shadow:0 2px 12px rgba(0,0,0,0.5)}
  .img-wrapper.zoomed{cursor:zoom-out}
  .img-wrapper.zoomed img{max-width:none;max-height:none;width:100%;height:auto}
  .grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:12px}
  @media(max-width:768px){.grid{grid-template-columns:1fr 1fr}}
  .pass{color:#22C55E;font-weight:600}
  .fail{color:#EF4444;font-weight:600}
</style></head><body>

<h1>WiNS Hub — Engenharia · Validação</h1>
<p class="sub">Validação automatizada via Playwright · Rota: ${ROUTE}</p>

<div class="card">
  <h2 style="margin-top:0">Checks (${results.length})</h2>
  <div class="grid">
${results.map(r => `<div><span style="color:#888">${r.name}</span><br>${r.ok ? '<span class="pass">✓ PASS</span>' : '<span class="fail">✗ FAIL</span>'}<br><span style="font-size:10px;color:#666">${r.detail}</span></div>`).join('\n')}
  </div>
</div>

<h2>Screenshots</h2>
${sizes.map(s => `
<div class="card">
  <div class="card-header">
    <span class="card-title">${s.name.charAt(0).toUpperCase()+s.name.slice(1)}</span>
    <span class="card-desc">${s.width}×${s.height}</span>
  </div>
  <div class="img-wrapper" onclick="this.classList.toggle('zoomed')">
    <img src="../screenshots/03-engenharia-dashboard-${s.name}.png" alt="">
  </div>
</div>`).join('\n')}

<div class="card">
  <div class="card-header">
    <span class="card-title">Full Page</span>
    <span class="card-desc">1920×(completo)</span>
  </div>
  <div class="img-wrapper" onclick="this.classList.toggle('zoomed')">
    <img src="../screenshots/03-engenharia-dashboard-fullpage.png" alt="">
  </div>
</div>

<script>
document.querySelectorAll('.img-wrapper').forEach(w => {
  w.addEventListener('click', () => w.classList.toggle('zoomed'));
});
</script>
</body></html>`;

writeFileSync(join(reviewDir, 'engenharia-dashboard-review.html'), reviewHtml);
console.log('  📄 review HTML generated');

try {
  const fps = sizes.map(s => join(screenshotsDir, `03-engenharia-dashboard-${s.name}.png`));
  execSync(`montage -geometry '400x>+4+4' -tile 3x1 -border 2 -bordercolor '#333' -background '#1a1a1a' ${fps.join(' ')} ${join(reviewDir, 'engenharia-dashboard-contact-sheet.png')}`, { stdio: 'pipe' });
  console.log('  🖼️  contact sheet generated');
} catch (e) { console.log('  ⚠️  montage:', e.message); }

const failed = results.filter(r => !r.ok);
console.log(`\n${'═'.repeat(50)}`);
console.log(`Results: ${results.length - failed.length}/${results.length} passed`);
if (failed.length) failed.forEach(r => console.log(`  ❌ ${r.name}`));
console.log(`${'═'.repeat(50)}`);
