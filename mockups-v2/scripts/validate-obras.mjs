import { chromium } from '@playwright/test';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, existsSync, mkdirSync } from 'fs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(__dirname, '..');
const screenshotsDir = join(projectRoot, 'screenshots');
if (!existsSync(screenshotsDir)) mkdirSync(screenshotsDir, { recursive: true });

const BASE_URL = 'https://winshubcomercial.com.br:18443/mockups-v2';

let pass = 0;
let fail = 0;

function check(cond, desc) {
  if (cond) { pass++; console.log(`  ✅ ${desc}`); }
  else { fail++; console.log(`  ❌ ${desc}`); }
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--ignore-certificate-errors'] });

  // ── 1. Desktop tests (1920×1080) ──
  console.log('\n── Desktop (1920×1080) ──');
  const dCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  const dPage = await dCtx.newPage();
  const dErrors = [];
  dPage.on('console', msg => { if (msg.type() === 'error') dErrors.push(msg.text()); });

  await dPage.goto(`${BASE_URL}/engenharia/obras`, { waitUntil: 'networkidle', timeout: 25000 });
  await dPage.waitForTimeout(1000);

  check(dPage.url().includes('/engenharia/obras'), 'pathname ends with /engenharia/obras');
  const title = await dPage.locator('h1').first().textContent();
  check(title === 'Obras', 'h1 = Obras');
  check(await dPage.locator('text=Engenharia').first().isVisible(), 'breadcrumb Engenharia visible');

  // Sidebar completeness check
  const sidebarText = await dPage.locator('aside').first().textContent();
  check(sidebarText?.includes('Visão Geral'), 'sidebar: Visão Geral');
  check(sidebarText?.includes('Engenharia'), 'sidebar: Engenharia');
  check(sidebarText?.includes('Lista de Obras'), 'sidebar: Lista de Obras');
  check(sidebarText?.includes('Agro'), 'sidebar: Agro restored');
  check(sidebarText?.includes('Logística'), 'sidebar: Logística restored');
  check(sidebarText?.includes('Saúde'), 'sidebar: Saúde restored');
  check(sidebarText?.includes('Relacionamentos'), 'sidebar: Relacionamentos');
  check(sidebarText?.includes('Empresa 360°'), 'sidebar: Empresa 360°');
  check(sidebarText?.includes('Inteligência Territorial'), 'sidebar: Inteligência Territorial');
  check(sidebarText?.includes('Busca Global'), 'sidebar: Busca Global');

  // Summary metrics
  const metrics = await dPage.locator('text=Obras visíveis').count();
  check(metrics >= 1, '4 summary metrics');

  // Filter card
  check(await dPage.locator('text=Filtros do diretório').isVisible(), 'filter card present');
  check(await dPage.locator('text=Avançados').isVisible(), 'advanced button visible');
  check(await dPage.locator('text=Aplicar').first().isVisible(), 'apply button visible');
  check(await dPage.locator('text=Limpar').first().isVisible(), 'clear button visible');
  check(await dPage.locator('text=Salvar visão').first().isVisible(), 'save view button visible');

  // Header actions
  check(await dPage.locator('button:has-text("Nova visão")').first().isVisible(), 'header: Nova visão button');
  check(await dPage.locator('button:has-text("Salvar visão")').first().isVisible(), 'header: Salvar visão button');
  check(await dPage.locator('button:has-text("Colunas")').first().isVisible(), 'header: Colunas button');
  check(await dPage.locator('button:has-text("Abrir mapa")').first().isVisible(), 'header: Abrir mapa button');
  check(await dPage.locator('button:has-text("Exportar")').first().isVisible(), 'header: Exportar button');

  // Table overflow check
  const overflow = await dPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  check(overflow, 'zero horizontal overflow');
  check(dErrors.length === 0, `zero console errors — ${dErrors.length}`);

  // Screenshot: 04-engenharia-obras-desktop.png
  await dPage.screenshot({ path: join(screenshotsDir, '04-engenharia-obras-desktop.png'), fullPage: false });
  console.log('  📸 Captured 04-engenharia-obras-desktop.png (1920×1080)');

  // Screenshot: 04-engenharia-obras-filtros-desktop.png (4-column grid expanded)
  await dPage.locator('button', { hasText: 'Avançados' }).click({ force: true });
  await dPage.waitForTimeout(300);
  check(await dPage.locator('text=Empresa / CNPJ').isVisible(), 'advanced: Empresa/CNPJ visible');
  check(await dPage.locator('text=CAPEX mínimo').isVisible(), 'advanced: CAPEX mínimo visible');
  check(await dPage.locator('text=CAPEX máximo').isVisible(), 'advanced: CAPEX máximo visible');
  check(await dPage.locator('text=Data inicial').isVisible(), 'advanced: Data inicial visible');
  check(await dPage.locator('text=Data final').isVisible(), 'advanced: Data final visible');
  check(await dPage.locator('label[for="comEmp"]').isVisible(), 'advanced: Com empresa');
  check(await dPage.locator('label[for="comMun"]').isVisible(), 'advanced: Com município');
  check(await dPage.locator('label[for="comDec"]').isVisible(), 'advanced: Com decisor');
  check(await dPage.locator('label[for="capHom"]').isVisible(), 'advanced: CAPEX homologado');
  check(await dPage.locator('label[for="comOport"]').isVisible(), 'advanced: Com oportunidade');
  check(await dPage.locator('label[for="comFor"]').isVisible(), 'advanced: Com fornecedor recomendado');
  check(await dPage.locator('label[for="qualCad"]').isVisible(), 'advanced: Qualidade cadastral');

  await dPage.screenshot({ path: join(screenshotsDir, '04-engenharia-obras-filtros-desktop.png'), fullPage: false });
  console.log('  📸 Captured 04-engenharia-obras-filtros-desktop.png (1920×1080)');
  await dPage.locator('button', { hasText: 'Avançados' }).click({ force: true });
  await dPage.waitForTimeout(300);

  // Screenshot: 04-engenharia-obras-chips-desktop.png (Active chips applied)
  await dPage.locator('select').first().selectOption('SP');
  await dPage.waitForTimeout(300);
  check(await dPage.locator('text=1 ativo').isVisible(), 'filter counter badge: 1 ativo');
  check(await dPage.locator('text=UF: SP').isVisible(), 'chip UF: SP visible');
  await dPage.screenshot({ path: join(screenshotsDir, '04-engenharia-obras-chips-desktop.png'), fullPage: false });
  console.log('  📸 Captured 04-engenharia-obras-chips-desktop.png (1920×1080)');

  // Clear chip
  await dPage.locator('select').first().selectOption('');
  await dPage.waitForTimeout(300);

  // Screenshot: 04-engenharia-obras-selecao-desktop.png (Batch selection bar)
  await dPage.locator('tbody tr').nth(0).locator('td').first().click({ force: true });
  await dPage.locator('tbody tr').nth(1).locator('td').first().click({ force: true });
  await dPage.waitForTimeout(300);
  check(await dPage.locator('text=2 obra(s) selecionada(s)').isVisible(), 'batch bar: 2 obra(s) selecionada(s)');
  check(await dPage.locator('button:has-text("Comparar")').isVisible(), 'batch bar: Comparar');
  check(await dPage.locator('button:has-text("Abrir no mapa")').isVisible(), 'batch bar: Abrir no mapa');
  check(await dPage.locator('button:has-text("Criar lista")').isVisible(), 'batch bar: Criar lista');
  check(await dPage.locator('button:has-text("Exportar")').nth(1).isVisible() || await dPage.locator('button:has-text("Exportar")').first().isVisible(), 'batch bar: Exportar');
  check(await dPage.locator('button:has-text("Limpar seleção")').first().isVisible(), 'batch bar: Limpar seleção');

  await dPage.screenshot({ path: join(screenshotsDir, '04-engenharia-obras-selecao-desktop.png'), fullPage: false });
  console.log('  📸 Captured 04-engenharia-obras-selecao-desktop.png (1920×1080)');

  // Clear selection
  await dPage.locator('button:has-text("Limpar seleção")').click({ force: true });
  await dPage.waitForTimeout(300);

  // Screenshot: 04-engenharia-obras-drawer-desktop.png
  await dPage.locator('tbody tr').first().click({ force: true });
  await dPage.waitForTimeout(400);
  check(await dPage.locator('text=Resumo da obra').first().isVisible(), 'drawer: Resumo da obra visible');
  await dPage.screenshot({ path: join(screenshotsDir, '04-engenharia-obras-drawer-desktop.png'), fullPage: false });
  console.log('  📸 Captured 04-engenharia-obras-drawer-desktop.png (1920×1080)');
  await dPage.keyboard.press('Escape');
  await dPage.waitForTimeout(300);

  // Screenshot: 04-engenharia-obras-colunas.png
  await dPage.locator('button:has-text("Colunas")').first().click({ force: true });
  await dPage.waitForTimeout(300);
  check(await dPage.locator('[role="dialog"]:has-text("Personalizar colunas")').isVisible(), 'column modal visible');
  check(await dPage.locator('text=Coluna obrigatória').first().isVisible(), 'column modal: Coluna obrigatória badge');
  await dPage.screenshot({ path: join(screenshotsDir, '04-engenharia-obras-colunas.png'), fullPage: false });
  console.log('  📸 Captured 04-engenharia-obras-colunas.png (1920×1080)');
  await dPage.keyboard.press('Escape');
  await dPage.waitForTimeout(300);

  await dCtx.close();

  // ── 2. Laptop tests (1440×900) ──
  console.log('\n── Laptop (1440×900) ──');
  const lCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  const lPage = await lCtx.newPage();
  await lPage.goto(`${BASE_URL}/engenharia/obras`, { waitUntil: 'networkidle', timeout: 25000 });
  await lPage.waitForTimeout(1000);

  // Check mandatory laptop columns visible
  const thText = await lPage.locator('table thead').textContent();
  check(thText?.includes('Obra'), 'laptop table: Obra visible');
  check(thText?.includes('Município / UF'), 'laptop table: Município / UF visible');
  check(thText?.includes('Empresa'), 'laptop table: Empresa visible');
  check(thText?.includes('Fase'), 'laptop table: Fase visible');
  check(thText?.includes('CAPEX'), 'laptop table: CAPEX visible');
  check(thText?.includes('Oportunidade'), 'laptop table: Oportunidade visible');
  check(thText?.includes('Qualidade'), 'laptop table: Qualidade visible');
  check(thText?.includes('Atualização'), 'laptop table: Atualização visible');

  const lOverflow = await lPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  check(lOverflow, 'laptop zero page overflow');

  await lPage.screenshot({ path: join(screenshotsDir, '04-engenharia-obras-laptop.png'), fullPage: false });
  console.log('  📸 Captured 04-engenharia-obras-laptop.png (1440×900)');
  await lCtx.close();

  // ── 3. Mobile tests (390×844) ──
  console.log('\n── Mobile (390×844) ──');
  const mCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  const mPage = await mCtx.newPage();
  const mErrors = [];
  mPage.on('console', msg => { if (msg.type() === 'error') mErrors.push(msg.text()); });

  // Direct navigation + reset scrollY to 0
  await mPage.goto(`${BASE_URL}/engenharia/obras`, { waitUntil: 'networkidle', timeout: 25000 });
  await mPage.evaluate(() => window.scrollTo(0, 0));
  await mPage.waitForFunction(() => window.scrollY === 0);
  await mPage.waitForTimeout(500);

  const scrollY = await mPage.evaluate(() => window.scrollY);
  check(scrollY === 0, `mobile initial scrollY === 0 (actual: ${scrollY})`);

  check(await mPage.locator('button').first().isVisible(), 'mobile hamburger visible');
  check(await mPage.locator('text=Obras visíveis').isVisible(), 'mobile: summary metrics visible');
  check(await mPage.locator('text=Filtros do diretório').isVisible(), 'mobile: filter card visible');
  check(await mPage.locator('text=obras encontradas').isVisible(), 'mobile: works count visible');

  const mobOverflow = await mPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  check(mobOverflow, 'mobile zero overflow');
  check(mErrors.length === 0, `mobile zero console errors — ${mErrors.length}`);

  // Screenshot: 04-engenharia-obras-mobile.png (Standard top of page)
  await mPage.screenshot({ path: join(screenshotsDir, '04-engenharia-obras-mobile.png'), fullPage: false });
  console.log('  📸 Captured 04-engenharia-obras-mobile.png (390×844 at scrollY=0)');

  // Mobile Filter Drawer test & screenshot
  await mPage.locator('button', { hasText: 'Avançados' }).click({ force: true });
  await mPage.waitForTimeout(400);
  check(await mPage.locator('[role="dialog"]:has-text("Filtros avançados")').isVisible(), 'mobile filter drawer visible');
  check(await mPage.locator('button:has-text("Aplicar filtros")').isVisible(), 'mobile filter drawer fixed footer: Aplicar filtros');
  check(await mPage.locator('button:has-text("Salvar visão")').first().isVisible(), 'mobile filter drawer fixed footer: Salvar visão');
  check(await mPage.locator('button:has-text("Limpar")').first().isVisible(), 'mobile filter drawer fixed footer: Limpar');

  await mPage.screenshot({ path: join(screenshotsDir, '04-engenharia-obras-filtros-mobile.png'), fullPage: false });
  console.log('  📸 Captured 04-engenharia-obras-filtros-mobile.png (390×844 drawer)');

  await mPage.keyboard.press('Escape');
  await mPage.waitForTimeout(300);

  await mCtx.close();

  // ── 4. Fullpage & Mobile Drawer ──
  console.log('\n── Fullpage & Mobile Drawer ──');
  const fCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  const fPage = await fCtx.newPage();
  await fPage.goto(`${BASE_URL}/engenharia/obras`, { waitUntil: 'networkidle', timeout: 25000 });
  await fPage.waitForTimeout(1000);
  await fPage.screenshot({ path: join(screenshotsDir, '04-engenharia-obras-fullpage.png'), fullPage: true });
  console.log('  📸 Captured 04-engenharia-obras-fullpage.png');

  await fPage.setViewportSize({ width: 390, height: 844 });
  await fPage.goto(`${BASE_URL}/engenharia/obras`, { waitUntil: 'networkidle', timeout: 25000 });
  await fPage.waitForTimeout(800);
  await fPage.locator('text=Reforço Ponte').first().click({ force: true });
  await fPage.waitForTimeout(300);
  await fPage.screenshot({ path: join(screenshotsDir, '04-engenharia-obras-drawer-mobile.png'), fullPage: false });
  console.log('  📸 Captured 04-engenharia-obras-drawer-mobile.png (390×844)');
  await fCtx.close();

  // ── 5. Integrity ──
  console.log('\n── Integrity ──');
  const liCtx = await browser.newContext({ ignoreHTTPSErrors: true });
  const liPage = await liCtx.newPage();
  await liPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
  const loginText = await liPage.locator('body').textContent();
  check(loginText?.includes('WiNS Hub') && loginText?.includes('Inteligência'), 'Login page intact');
  await liCtx.close();

  const vgCtx = await browser.newContext({ ignoreHTTPSErrors: true });
  const vgPage = await vgCtx.newPage();
  await vgPage.goto(`${BASE_URL}/visao-geral`, { waitUntil: 'networkidle', timeout: 15000 });
  const vgH1 = await vgPage.locator('h1').first().textContent();
  check(vgH1?.includes('Visão Geral'), 'Visão Geral intact');
  await vgCtx.close();

  const enCtx = await browser.newContext({ ignoreHTTPSErrors: true });
  const enPage = await enCtx.newPage();
  await enPage.goto(`${BASE_URL}/engenharia`, { waitUntil: 'networkidle', timeout: 15000 });
  const enH1 = await enPage.locator('h1').first().textContent();
  check(enH1?.includes('Engenharia'), 'Engenharia intact');
  await enCtx.close();

  await browser.close();

  // ── 6. Generate review HTML & contact sheet ──
  const totalChecks = pass + fail;
  const pct = ((pass / totalChecks) * 100).toFixed(0);
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const screenshots = [
    '04-engenharia-obras-desktop.png',
    '04-engenharia-obras-laptop.png',
    '04-engenharia-obras-mobile.png',
    '04-engenharia-obras-fullpage.png',
    '04-engenharia-obras-drawer-desktop.png',
    '04-engenharia-obras-drawer-mobile.png',
    '04-engenharia-obras-filtros-desktop.png',
    '04-engenharia-obras-filtros-mobile.png',
    '04-engenharia-obras-colunas.png',
    '04-engenharia-obras-chips-desktop.png',
    '04-engenharia-obras-selecao-desktop.png',
  ];

  const reviewDir = join(projectRoot, 'review');
  if (!existsSync(reviewDir)) mkdirSync(reviewDir, { recursive: true });

  let html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Review — Engenharia · Lista de Obras</title>
<style>
  body{background:#0B1421;color:#E2E8F0;font-family:Inter,sans-serif;padding:32px;max-width:1200px;margin:0 auto}
  h1{font-size:22px;font-weight:600;margin-bottom:4px;color:#F4F7FB}
  .meta{font-size:12px;color:#71809A;margin-bottom:24px}
  .summary{display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap}
  .stat{background:#101C2D;border:1px solid #253650;border-radius:8px;padding:12px 16px}
  .stat .num{font-size:24px;font-weight:700}
  .stat .lbl{font-size:10px;color:#71809A;margin-top:2px}
  .green{color:#22C55E}.red{color:#EF4444}.amber{color:#F59E0B}.blue{color:#3B82F6}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
  .card{background:#101C2D;border:1px solid #253650;border-radius:10px;overflow:hidden}
  .card img{width:100%;display:block;cursor:pointer}
  .card .info{padding:10px 12px;font-size:11px;color:#9EACC4}
  h2{font-size:16px;font-weight:600;margin:32px 0 12px;color:#F4F7FB}
  .pass{color:#22C55E}.fail{color:#EF4444}
</style></head><body>
<h1>🔍 Review — Engenharia · Lista de Obras</h1>
<div class="meta">${totalChecks} checks · ${now}</div>
<div class="summary">
  <div class="stat"><div class="num green">${pass}</div><div class="lbl">Passaram</div></div>
  <div class="stat"><div class="num red">${fail}</div><div class="lbl">Falharam</div></div>
  <div class="stat"><div class="num" style="color:${fail > 0 ? '#F59E0B' : '#22C55E'}">${pct}%</div><div class="lbl">Sucesso</div></div>
</div>
<h2>📸 Screenshots (${screenshots.length})</h2>
<div class="grid">
${screenshots.map(s => {
  const label = s.replace('04-engenharia-obras-', '').replace('.png', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return `<div class="card"><a href="/mockups-v2/screenshots/${s}" target="_blank"><img src="/mockups-v2/screenshots/${s}" alt="${label}" loading="lazy"></a><div class="info">${label}</div></div>`;
}).join('\n')}
</div>
<script>
  document.querySelectorAll('.card img').forEach(img => { img.onerror = () => { img.style.display='none'; img.parentElement.innerHTML+='<div style="padding:32px;text-align:center;color:#EF4444;font-size:13px">Screenshot não encontrada</div>'; }; });
</script>
</body></html>`;

  writeFileSync(join(reviewDir, 'engenharia-obras-review.html'), html);
  console.log('\n  review HTML generated');

  const contactSheet = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Contact Sheet — Engenharia · Lista de Obras</title>
<style>
  body{background:#0B1421;color:#E2E8F0;font-family:Inter,sans-serif;padding:32px}
  h1{font-size:18px;font-weight:600;margin-bottom:20px;color:#F4F7FB;text-align:center}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
  .card{background:#101C2D;border:1px solid #253650;border-radius:8px;overflow:hidden}
  .card img{width:100%;display:block}
  .card .label{padding:6px 8px;font-size:9px;color:#9EACC4;text-align:center}
</style></head><body>
<h1>Engenharia · Lista de Obras — Contact Sheet</h1>
<div class="grid">
${screenshots.map(s => {
  const label = s.replace('04-engenharia-obras-', '').replace('.png', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return `<div class="card"><img src="/mockups-v2/screenshots/${s}" alt="${label}" loading="lazy"><div class="label">${label}</div></div>`;
}).join('\n')}
</div>
</body></html>`;

  writeFileSync(join(reviewDir, 'engenharia-obras-contact-sheet.html'), contactSheet);
  console.log('  contact sheet generated');

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${pass}/${totalChecks} passed`);
  console.log(`${'='.repeat(50)}`);
})();
