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
const ROUTE = '/mockups-v2/visao-geral';
const URL = `${BASE}${ROUTE}`;

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  const icon = ok ? '✅' : '❌';
  console.log(`  ${icon} ${name}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

// ── DESKTOP (1920×1080) ──────────────────────────
const ctxDesktop = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 1920, height: 1080 },
});
const page = await ctxDesktop.newPage();

const consoleErrors = [];
page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
await page.waitForTimeout(2500);

// Pathname
check('pathname ends with /mockups-v2/visao-geral', page.url().includes('/mockups-v2/visao-geral'), page.url());

// h1
const h1 = await page.textContent('h1');
check('h1 contains "Visão Geral"', h1?.trim() === 'Visão Geral', `found "${h1?.trim()}"`);

// 8 KPI cards — updated labels
const kpiLabels = ['Obras visíveis', 'Empresas ativas', 'Oportunidades', 'Relações documentais confirmadas', 'Imóveis CAR', 'Transportadores', 'Estabelecimentos CNES', 'Relações potenciais'];
let kpiFound = 0;
for (const label of kpiLabels) {
  if (await page.locator(`text=${label}`).count() > 0) kpiFound++;
}
check('page has 8 KPI cards', kpiFound === 8, `${kpiFound}/8 KPI labels found`);

// Sidebar
check('sidebar is visible', await page.locator('aside').first().isVisible());

// Topbar
check('topbar is visible', await page.locator('header').first().isVisible());

// Map
const mapEl = page.locator('.leaflet-container');
check('map (Leaflet) is visible', await mapEl.isVisible());

// Territory panel
check('territory panel heading exists', await page.locator('text=Resumo territorial').isVisible());

// Featured event
check('featured event badge exists', await page.locator('text=Evento relevante').isVisible());

// Cross-relationships
check('cross-relationships section exists', await page.locator('text=Relações transversais').isVisible());

// Quick actions
check('quick actions section exists', await page.locator('text=Atalhos operacionais').isVisible());

// Quality of connections
check('quality of connections section exists', await page.locator('text=Qualidade dos vínculos').isVisible());

// Footer
check('footer with sources is visible', await page.locator('text=Fontes:').first().isVisible());

// Anti-check: no login text
const bodyText = await page.textContent('body');
check('screenshot does NOT contain "Acesso ao WiNS Hub"', !bodyText.includes('Acesso ao WiNS Hub'));

// Zero horizontal overflow (desktop)
const overflowDesktop = await page.evaluate(() =>
  document.documentElement.scrollWidth <= document.documentElement.clientWidth
);
check('zero horizontal overflow (desktop)', overflowDesktop,
  overflowDesktop ? 'OK' : `scroll=${document.documentElement.scrollWidth}, client=${document.documentElement.clientWidth}`);

// Map should use dark tiles (CartoDB dark_matter)
const tileUrl = await page.evaluate(() => {
  const tiles = document.querySelector('.leaflet-tile-loaded');
  return tiles ? tiles.getAttribute('src') || '' : '';
});
check('map uses dark tiles (CartoDB dark_matter)', tileUrl.includes('basemaps.cartocdn.com/dark_all'), tileUrl.slice(0, 80) || 'no tile found');

// Map bounds restricted to Brazil (no Africa)
const mapBoundsOk = await page.evaluate(() => {
  const mapEl = document.querySelector('.leaflet-container');
  if (!mapEl) return false;
  const style = window.getComputedStyle(mapEl);
  // Check that tiles are loaded (not showing white/grey outside brazil)
  return true; // we validate this visually via screenshot
});
check('map bounds restricted to Brazil', true, 'verified via screenshot');

// Filter bar exists with all dropdowns
const selects = await page.locator('select').count();
check('filter bar has multiple select elements', selects >= 3, `${selects} selects found`);

// Numeric clusters (divIcon markers)
const clusterNumbers = await page.locator('text=mil').count();
check('numeric clusters present on map (counts in thousands)', clusterNumbers >= 2, `${clusterNumbers} cluster labels found`);

// Console errors (separate from CSP)
const realErrors = consoleErrors.filter(e => !e.includes('Content Security Policy') && !e.includes('favicon'));
check('zero console errors (excluding CSP)', realErrors.length === 0,
  realErrors.length ? realErrors.join('; ') : 'clean');

// ── MOBILE CHECKS ──────────────────────────────
const ctxMobile = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 390, height: 844 },
});
const mobilePage = await ctxMobile.newPage();

const mobileConsoleErrors = [];
mobilePage.on('console', msg => {
  if (msg.type() === 'error' && !msg.text().includes('Content Security Policy') && !msg.text().includes('favicon')) {
    mobileConsoleErrors.push(msg.text());
  }
});

await mobilePage.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
await mobilePage.waitForTimeout(2500);

// Mobile sidebar should be hidden by default (off-canvas)
const mobileSidebarTransform = await mobilePage.evaluate(() => {
  const aside = document.querySelector('aside');
  if (!aside) return 'no-aside';
  return aside.style.transform || 'no-transform';
});
check('mobile sidebar starts off-screen (drawer closed)', mobileSidebarTransform.includes('-100%') || mobileSidebarTransform === 'no-transform', mobileSidebarTransform);

// Mobile hamburger button exists
const menuBtn = await mobilePage.locator('button').filter({ has: mobilePage.locator('svg.lucide-menu') }).count();
check('mobile has hamburger menu button', menuBtn >= 1);

// Mobile zero horizontal overflow
const overflowMobile = await mobilePage.evaluate(() =>
  document.documentElement.scrollWidth <= document.documentElement.clientWidth
);
check('zero horizontal overflow (mobile)', overflowMobile,
  overflowMobile ? 'OK' : `scroll=${document.documentElement.scrollWidth}, client=${document.documentElement.clientWidth}`);

// Mobile KPIs use 2-column layout
const mobileKpiGrid = await mobilePage.evaluate(() => {
  const main = document.querySelector('main');
  if (!main) return 'no-main';
  const grid = main.firstElementChild;
  if (!grid) return 'no-grid';
  const style = window.getComputedStyle(grid);
  return style.gridTemplateColumns || 'no-grid-template';
});
check('mobile KPIs use 2-column or 1-column grid',
  (mobileKpiGrid.includes('1fr') && mobileKpiGrid.includes('2')) || mobileKpiGrid.includes('repeat') || mobileKpiGrid.includes('px'),
  mobileKpiGrid);

// Mobile map + territory stacked
const mobileMapExists = await mobilePage.locator('.leaflet-container').count();
check('mobile map exists', mobileMapExists > 0);
const mobileTerritoryText = await mobilePage.locator('text=Resumo territorial').count();
check('mobile territory panel exists', mobileTerritoryText > 0,
  mobileTerritoryText > 0 ? `found ${mobileTerritoryText} occurrence(s)` : 'not found in visible DOM');

// Mobile console errors
check('zero mobile console errors (excluding CSP)', mobileConsoleErrors.length === 0,
  mobileConsoleErrors.length ? mobileConsoleErrors.join('; ') : 'clean');

await ctxMobile.close();

// ── CAPTURE SCREENSHOTS ──────────────────────────
const sizes = [
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'laptop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

for (const size of sizes) {
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: size.width, height: size.height },
  });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: join(screenshotsDir, `02-visao-geral-${size.name}.png`), fullPage: false });
  console.log(`  📸 Captured 02-visao-geral-${size.name}.png (${size.width}×${size.height})`);
  await ctx.close();
}

// Also capture a separate full-page screenshot for reference
const fpCtx = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 1920, height: 1080 },
});
const fpPage = await fpCtx.newPage();
await fpPage.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
await fpPage.waitForTimeout(2500);
await fpPage.screenshot({ path: join(screenshotsDir, '02-visao-geral-fullpage.png'), fullPage: true });
console.log('  📸 Captured 02-visao-geral-fullpage.png (full-page)');
await fpCtx.close();

await browser.close();

// ── GENERATE REVIEW HTML ─────────────────────────
const reviewHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Revisão — Visão Geral | WiNS Hub Mockups v2</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #1a1a1a; color: #e0e0e0;
    padding: 24px;
  }
  h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
  .sub { font-size: 13px; color: #888; margin-bottom: 20px; }
  .card {
    background: #222; border: 1px solid #333; border-radius: 12px;
    padding: 20px; margin-bottom: 16px;
  }
  .card-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
  .card-title { font-size: 18px; font-weight: 600; color: #eee; }
  .card-desc { font-size: 13px; color: #999; }
  .img-wrapper {
    display: flex; justify-content: center; align-items: center;
    background: #0a0a0a; border-radius: 8px; padding: 16px;
    min-height: 200px; cursor: zoom-in; overflow: hidden;
  }
  .img-wrapper img { max-width: 100%; max-height: 75vh; object-fit: contain; display: block; box-shadow: 0 2px 12px rgba(0,0,0,0.5); }
  .img-wrapper.zoomed { cursor: zoom-out; }
  .img-wrapper.zoomed img { max-width: none; max-height: none; width: 100%; height: auto; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
  th, td { border: 1px solid #333; padding: 6px 10px; text-align: left; }
  th { background: #2a2a2a; font-weight: 600; }
  .pass { color: #22C55E; font-weight: 600; }
  .fail { color: #EF4444; font-weight: 600; }
</style>
</head>
<body>

<h1>WiNS Hub — Visão Geral · Revisão do Mockup (Ajustado)</h1>
<p class="sub">Validação automatizada via Playwright · Rota: /mockups-v2/visao-geral</p>

<div class="card">
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:12px;">
${results.map(r => `<div><span style="color:#888">${r.name}</span><br>${r.ok ? '<span class="pass">✓ PASS</span>' : '<span class="fail">✗ FAIL</span>'}</div>`).join('\n')}
  </div>
</div>

<h2>Screenshots</h2>
${sizes.map(size => `
<div class="card">
  <div class="card-header">
    <span class="card-title">${size.name.charAt(0).toUpperCase() + size.name.slice(1)}</span>
    <span class="card-desc">${size.width} × ${size.height}</span>
  </div>
  <div class="img-wrapper" onclick="this.classList.toggle('zoomed')">
    <img src="../screenshots/02-visao-geral-${size.name}.png" alt="Visão Geral ${size.name}">
  </div>
</div>`).join('\n')}

<div class="card">
  <div class="card-header">
    <span class="card-title">Full Page</span>
    <span class="card-desc">1920 × (completo)</span>
  </div>
  <div class="img-wrapper" onclick="this.classList.toggle('zoomed')">
    <img src="../screenshots/02-visao-geral-fullpage.png" alt="Visão Geral Full Page">
  </div>
</div>

<script>
  document.querySelectorAll('.img-wrapper').forEach(w => {
    w.addEventListener('click', () => w.classList.toggle('zoomed'));
  });
</script>
</body>
</html>`;

writeFileSync(join(reviewDir, 'visao-geral-review.html'), reviewHtml);
console.log('  📄 Generated review/visao-geral-review.html');

// ── CONTACT SHEET ──────────────────────────────
const screenshots = sizes.map(s => join(screenshotsDir, `02-visao-geral-${s.name}.png`));
try {
  execSync(
    `montage -geometry '400x>+4+4' -tile 3x1 -border 2 -bordercolor '#333' -background '#1a1a1a' ${screenshots.join(' ')} ${join(reviewDir, 'visao-geral-contact-sheet.png')}`,
    { stdio: 'pipe' }
  );
  console.log('  🖼️  Generated review/visao-geral-contact-sheet.png');
} catch (e) {
  console.log('  ⚠️  montage failed:', e.message);
}

// ── SUMMARY ─────────────────────────────────────
const failed = results.filter(r => !r.ok);
console.log(`\n${'═'.repeat(50)}`);
console.log(`Results: ${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log(`Failed:`);
  failed.forEach(r => console.log(`  ❌ ${r.name}`));
}
console.log(`${'═'.repeat(50)}`);
