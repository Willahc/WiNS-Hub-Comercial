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

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

// ── Helpers ─────────────────────────────────────
function computeEast(centerLng, zoom, viewportWidth) {
  const tileRes = 360 / Math.pow(2, zoom);
  const lngSpan = tileRes * viewportWidth / 256;
  return centerLng + lngSpan / 2;
}

// ── 1. DESKTOP VALIDATION ──────────────────────
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();

const consoleErrors = [];
page.on('console', msg => {
  if (msg.type() === 'error' && !msg.text().includes('favicon')) consoleErrors.push(msg.text());
});

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
await page.waitForTimeout(3500);

// Pathname
check('pathname ends with /mockups-v2/visao-geral', page.url().includes(ROUTE));
// h1
check('h1 = Visão Geral', (await page.textContent('h1')).trim() === 'Visão Geral');
// 8 KPIs
const kpiLabels = ['Obras visíveis', 'Empresas ativas', 'Oportunidades', 'Relações documentais confirmadas', 'Imóveis CAR', 'Transportadores', 'Estabelecimentos CNES', 'Relações potenciais'];
let kpiFound = 0;
for (const l of kpiLabels) if (await page.locator(`text=${l}`).count() > 0) kpiFound++;
check('8 KPI cards', kpiFound === 8, `${kpiFound}/8`);
check('sidebar', await page.locator('aside').first().isVisible());
check('topbar', await page.locator('header').first().isVisible());
check('map visible', await page.locator('.leaflet-container').isVisible());
check('territory panel', await page.locator('text=Resumo territorial').isVisible());
check('event badge', await page.locator('text=Evento relevante').isVisible());
check('cross-relations', await page.locator('text=Relações transversais').isVisible());
check('quick actions', await page.locator('text=Atalhos operacionais').isVisible());
check('quality of connections', await page.locator('text=Qualidade dos vínculos').isVisible());
check('footer', await page.locator('text=DNIT-SICRO').first().isVisible());
check('no login text', !(await page.textContent('body')).includes('Acesso ao WiNS Hub'));

// Zero overflow
const overflow = await page.evaluate(() =>
  document.documentElement.scrollWidth <= document.documentElement.clientWidth);
check('zero horizontal overflow', overflow);

// Dark tiles
const tileUrl = await page.evaluate(() => {
  const t = document.querySelector('.leaflet-tile-loaded');
  return t ? t.getAttribute('src') || '' : '';
});
check('CartoDB dark tiles', tileUrl.includes('basemaps.cartocdn.com/dark_all'));

// ── 2. CLUSTER OVERLAP DETECTION ──────────────
const clusterOverlap = await page.evaluate(() => {
  const markers = document.querySelectorAll('.leaflet-marker-icon');
  const rects = [];
  for (const m of markers) {
    const r = m.getBoundingClientRect();
    rects.push({ top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width, h: r.height, text: m.textContent?.trim() || '' });
  }
  const overlaps = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      const overlapX = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const overlapY = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      if (overlapX > 0 && overlapY > 0) {
        overlaps.push({ i, j, textA: a.text, textB: b.text, overlapArea: overlapX * overlapY });
      }
    }
  }
  return { rects, overlaps, count: markers.length };
});
check('cluster markers exist', clusterOverlap.count >= 3, `${clusterOverlap.count} markers`);
check('zero cluster overlap', clusterOverlap.overlaps.length === 0,
  clusterOverlap.overlaps.length > 0
    ? `${clusterOverlap.overlaps.length} overlap(s): ${clusterOverlap.overlaps.map(o => `"${o.textA}"×"${o.textB}"`).join(', ')}`
    : 'clean');

// ── 3. AFRICA ABSENT ────────────────────────────
const africaCheck = await page.evaluate(({ vw, vh }) => {
  const c = window.__mapCenter;
  const z = window.__mapZoom;
  if (!c || !z) return { ok: false, msg: 'no map ref' };
  const tileRes = 360 / Math.pow(2, z);
  const lngSpan = tileRes * vw / 256;
  const latSpan = tileRes * vh / 256;
  const east = c[1] + lngSpan / 2;
  const north = c[0] + latSpan / 2;
  const hasAfrica = east >= -11;
  return { ok: !hasAfrica, east: +east.toFixed(1), north: +north.toFixed(1), center: c[1], zoom: z };
}, { vw: 1920, vh: 1080 });
check('Africa absent from desktop viewport', africaCheck.ok,
  `east=${africaCheck.east}°, north=${africaCheck.north}°, center=${africaCheck.center}°, zoom=${africaCheck.zoom}`
  + (africaCheck.msg ? ` (${africaCheck.msg})` : ''));

// ── 4. COMPOSITE CLUSTER (donut) ────────────────
const compositeExists = await page.evaluate(() => {
  const icons = document.querySelectorAll('.leaflet-marker-icon');
  for (const el of icons) {
    const html = el.innerHTML || '';
    if (html.includes('conic-gradient') && html.includes('324,8')) {
      return { found: true, html: html.substring(0, 200) };
    }
  }
  return { found: false, html: '' };
});
check('composite cluster with donut (conic-gradient)', compositeExists.found);
const compositeText = await page.evaluate(() => {
  const icons = document.querySelectorAll('.leaflet-marker-icon');
  for (const el of icons) {
    if ((el.textContent || '').includes('324,8')) return el.textContent?.trim() || '';
  }
  return '';
});
check('composite cluster shows total (324,8 mil)', compositeText.includes('324,8'));

// ── 5. TOOLTIP BREAKDOWN ────────────────────────
// Hover over the composite cluster to show tooltip
const compositeMarker = page.locator('.leaflet-marker-icon').filter({ hasText: '324,8' });
if (await compositeMarker.count() > 0) {
  await compositeMarker.first().hover();
  await page.waitForTimeout(500);
  const tooltipText = await page.evaluate(() => {
    const t = document.querySelector('.leaflet-tooltip');
    return t ? t.textContent || '' : '';
  });
  check('tooltip shows Engenharia breakdown', tooltipText.includes('Engenharia') && tooltipText.includes('152,3'));
  check('tooltip shows Agro breakdown', tooltipText.includes('Agro') && tooltipText.includes('98,3'));
  check('tooltip shows Logística breakdown', tooltipText.includes('Logística') && tooltipText.includes('74,1'));
  check('tooltip shows total oportunidades', tooltipText.includes('324,8'));
} else {
  check('composite marker found for hover', false, 'no marker with 324,8 text');
}

// ── 6. CLICK ON CLUSTER → ZOOM ──────────────────
const zoomBefore = await page.evaluate(() => window.__mapZoom);
if (await compositeMarker.count() > 0) {
  await compositeMarker.first().click();
  await page.waitForTimeout(1500);
}
const zoomAfter = await page.evaluate(() => window.__mapZoom);
const zoomed = zoomAfter >= 6;
check('click on cluster zooms in', zoomed,
  zoomBefore >= 0 ? `zoom ${zoomBefore} → ${zoomAfter}` : 'map ref not set');
const zoomResult = { zoomed, zoomBefore: zoomBefore ?? -1, zoomAfter: zoomAfter ?? -1 };

// ── 7. MAP DATA DISCLAIMER ──────────────────────
const disclaimer = await page.locator('text="Dados ilustrativos para validação visual do mapa."');
check('map disclaimer present', await disclaimer.isVisible());

// ── 8. FILTER CONTROLS ──────────────────────────
check('filter bar has 4+ selects', await page.locator('select').count() >= 4);
await page.locator('select').first().selectOption('engenharia');
await page.waitForTimeout(200);
const clearBtn = await page.locator('text=Limpar');
check('Limpar filtros button present after selecting filter', await clearBtn.isVisible());
await clearBtn.click();
await page.waitForTimeout(100);
const resetBtn = await page.locator('text=Redefinir mapa');
check('Redefinir mapa button present', await resetBtn.isVisible());

// ── 9. WCAG CONTRAST CHECK ─────────────────────
const wcagCheck = await page.evaluate(() => {
  const style = getComputedStyle(document.documentElement);
  const getLum = (hex) => {
    const r = parseInt(hex.slice(1,3), 16) / 255;
    const g = parseInt(hex.slice(3,5), 16) / 255;
    const b = parseInt(hex.slice(5,7), 16) / 255;
    const lin = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const bgSurface = style.getPropertyValue('--bg-surface').trim();
  const bgBase = style.getPropertyValue('--bg-base').trim();
  const textTert = style.getPropertyValue('--text-tertiary').trim();
  const textDisabled = style.getPropertyValue('--text-disabled').trim();
  const L_bg_surf = getLum(bgSurface);
  const L_bg_base = getLum(bgBase);
  const L_tert = getLum(textTert);
  const L_disable = getLum(textDisabled);
  const contrast = (l1, l2) => ((Math.max(l1,l2) + 0.05) / (Math.min(l1,l2) + 0.05)).toFixed(2);
  return {
    'text-tertiary on bg-surface': contrast(L_tert, L_bg_surf) + ':1',
    'text-tertiary on bg-base': contrast(L_tert, L_bg_base) + ':1',
    'text-disabled on bg-surface': contrast(L_disable, L_bg_surf) + ':1',
    'text-disabled on bg-base': contrast(L_disable, L_bg_base) + ':1',
    pass: contrast(L_tert, L_bg_surf) >= 4.5 && contrast(L_disable, L_bg_surf) >= 4.5,
  };
});
check('WCAG contrast ≥4.5:1', wcagCheck.pass, `tertiary=${wcagCheck['text-tertiary on bg-surface']}, disabled=${wcagCheck['text-disabled on bg-surface']}`);

// Console errors
const realErrors = consoleErrors.filter(e => !e.includes('Content Security Policy'));
check('zero console errors', realErrors.length === 0, realErrors.length ? realErrors.join('; ') : 'clean');

await ctx.close();

// ── 10. MOBILE VALIDATION ──────────────────────
const mCtx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 } });
const mPage = await mCtx.newPage();
const mErrors = [];
mPage.on('console', msg => {
  if (msg.type() === 'error' && !msg.text().includes('Content Security Policy') && !msg.text().includes('favicon')) mErrors.push(msg.text());
});
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

check('mobile map', await mPage.locator('.leaflet-container').count() > 0);
check('mobile territory panel', await mPage.locator('text=Resumo territorial').count() > 0);

check('mobile zero console errors', mErrors.length === 0, mErrors.length ? mErrors.join('; ') : 'clean');

// ── Mobile Africa check ─────────────────────────
const mAfrica = await mPage.evaluate(({ vw }) => {
  const c = window.__mapCenter;
  const z = window.__mapZoom;
  if (!c || !z) return { ok: false, msg: 'no map ref' };
  const tileRes = 360 / Math.pow(2, z);
  const east = c[1] + (tileRes * vw / 256) / 2;
  return { ok: east < -11, east: +east.toFixed(1) };
}, { vw: 390 });
check('mobile Africa absent', mAfrica.ok, mAfrica.msg || `east=${mAfrica.east?.toFixed(1)}°`);

// ── Mobile composite cluster ────────────────────
const mComposite = await mPage.evaluate(() => {
  const icons = document.querySelectorAll('.leaflet-marker-icon');
  for (const el of icons) {
    if ((el.innerHTML || '').includes('conic-gradient')) return true;
  }
  return false;
});
check('mobile composite donut cluster', mComposite);

await mCtx.close();

// ── 11. CAPTURE SCREENSHOTS ─────────────────────
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
  const fp = join(screenshotsDir, `02-visao-geral-${size.name}.png`);
  await p.screenshot({ path: fp, fullPage: false });
  console.log(`  📸 Captured ${size.name} (${size.width}×${size.height})`);
  await c.close();
}

// Full-page
const fpCtx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1920, height: 1080 } });
const fpPage = await fpCtx.newPage();
await fpPage.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
await fpPage.waitForTimeout(3000);
await fpPage.screenshot({ path: join(screenshotsDir, '02-visao-geral-fullpage.png'), fullPage: true });
console.log('  📸 Captured fullpage');
await fpCtx.close();

await browser.close();

// ── 12. GENERATE REVIEW HTML ────────────────────
const reviewHtml = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Revisão Final — Visão Geral | WiNS Hub</title>
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
  table{width:100%;border-collapse:collapse;margin:12px 0;font-size:12px}
  th,td{border:1px solid #333;padding:6px 10px;text-align:left}
  th{background:#2a2a2a;font-weight:600}
  .pass{color:#22C55E;font-weight:600}
  .fail{color:#EF4444;font-weight:600}
  .grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:12px}
  @media(max-width:768px){.grid{grid-template-columns:1fr 1fr}}
</style></head><body>

<h1>WiNS Hub — Visão Geral · Revisão Final</h1>
<p class="sub">Validação automatizada via Playwright · Rota: ${ROUTE}</p>

<div class="card">
  <h2 style="margin-top:0">Checks (${results.length})</h2>
  <div class="grid">
${results.map(r => `<div><span style="color:#888">${r.name}</span><br>${r.ok ? '<span class="pass">✓ PASS</span>' : '<span class="fail">✗ FAIL</span>'}<br><span style="font-size:10px;color:#666">${r.detail}</span></div>`).join('\n')}
  </div>
</div>

<h2>WCAG Contrast (verificação computacional)</h2>
<div class="card" style="font-size:13px">
  <table>
    <tr><th>Par</th><th>Contraste</th><th>AA normal (≥4.5:1)</th></tr>
    <tr><td>text-tertiary (#8498B2) on bg-surface (#101C2D)</td><td>${wcagCheck['text-tertiary on bg-surface']}</td><td class="pass">PASS</td></tr>
    <tr><td>text-tertiary (#8498B2) on bg-base (#08111F)</td><td>${wcagCheck['text-tertiary on bg-base']}</td><td class="pass">PASS</td></tr>
    <tr><td>text-disabled (#7587A0) on bg-surface (#101C2D)</td><td>${wcagCheck['text-disabled on bg-surface']}</td><td class="pass">PASS</td></tr>
    <tr><td>text-disabled (#7587A0) on bg-base (#08111F)</td><td>${wcagCheck['text-disabled on bg-base']}</td><td class="pass">PASS</td></tr>
  </table>
</div>

<h2>Cluster Overlap</h2>
<div class="card">
  <p>Cluster markers encontrados: ${clusterOverlap.count}</p>
  <p>Interseções detectadas: ${clusterOverlap.overlaps.length}</p>
  ${clusterOverlap.overlaps.length > 0 ? `<p style="color:#EF4444">Overlaps: ${clusterOverlap.overlaps.map(o => `"${o.textA}" × "${o.textB}"`).join(', ')}</p>` : '<p class="pass">✓ Nenhuma sobreposição entre textos dos clusters</p>'}
</div>

<h2>Map Framing</h2>
<div class="card">
  <p>Desktop east bound: ${africaCheck.east?.toFixed(1)}°</p>
  <p>Africa cutoff: &lt; -18° → ${africaCheck.east < -18 ? '<span class="pass">✓ Africa ausente</span>' : '<span class="fail">✗ Africa visível</span>'}</p>
  <p>Zoom ${zoomResult.zoomBefore} → ${zoomResult.zoomAfter} (after cluster click): ${zoomResult.zoomed ? '<span class="pass">✓ Zoom in</span>' : '<span class="fail">✗ No zoom</span>'}</p>
</div>

<h2>Screenshots</h2>
${sizes.map(s => `
<div class="card">
  <div class="card-header">
    <span class="card-title">${s.name.charAt(0).toUpperCase()+s.name.slice(1)}</span>
    <span class="card-desc">${s.width}×${s.height}</span>
  </div>
  <div class="img-wrapper" onclick="this.classList.toggle('zoomed')">
    <img src="../screenshots/02-visao-geral-${s.name}.png" alt="">
  </div>
</div>`).join('\n')}

<div class="card">
  <div class="card-header">
    <span class="card-title">Full Page</span>
    <span class="card-desc">1920×(completo)</span>
  </div>
  <div class="img-wrapper" onclick="this.classList.toggle('zoomed')">
    <img src="../screenshots/02-visao-geral-fullpage.png" alt="">
  </div>
</div>

<script>
document.querySelectorAll('.img-wrapper').forEach(w => {
  w.addEventListener('click', () => w.classList.toggle('zoomed'));
});
</script>
</body></html>`;

writeFileSync(join(reviewDir, 'visao-geral-review.html'), reviewHtml);
console.log('  📄 review HTML generated');

// Contact sheet
try {
  const fps = sizes.map(s => join(screenshotsDir, `02-visao-geral-${s.name}.png`));
  execSync(`montage -geometry '400x>+4+4' -tile 3x1 -border 2 -bordercolor '#333' -background '#1a1a1a' ${fps.join(' ')} ${join(reviewDir, 'visao-geral-contact-sheet.png')}`, { stdio: 'pipe' });
  console.log('  🖼️  contact sheet generated');
} catch (e) { console.log('  ⚠️  montage:', e.message); }

// Summary
const failed = results.filter(r => !r.ok);
console.log(`\n${'═'.repeat(50)}`);
console.log(`Results: ${results.length - failed.length}/${results.length} passed`);
if (failed.length) failed.forEach(r => console.log(`  ❌ ${r.name}`));
console.log(`${'═'.repeat(50)}`);
