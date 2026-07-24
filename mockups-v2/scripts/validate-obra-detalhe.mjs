import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'https://winshubcomercial.com.br:18443/mockups-v2';
const screenshotsDir = '/root/wins_hub_unificado/mockups-v2/screenshots';
const reviewDir = '/root/wins_hub_unificado/mockups-v2/review';

if (!existsSync(screenshotsDir)) mkdirSync(screenshotsDir, { recursive: true });
if (!existsSync(reviewDir)) mkdirSync(reviewDir, { recursive: true });

let passed = 0;
let failed = 0;

function check(cond, name) {
  if (cond) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.error(`  ❌ ${name}`);
  }
}

(async () => {
  console.log('\n==================================================');
  console.log('Validando PÁGINA 05 — ENGENHARIA · DETALHE DA OBRA (MOBILE)');
  console.log('==================================================\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
  });

  // 1. Desktop Check (1920×1080)
  const dContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true
  });
  const dPage = await dContext.newPage();
  await dPage.goto(`${BASE_URL}/engenharia/obras/obra-exemplo`, { waitUntil: 'networkidle' });
  await dPage.waitForTimeout(500);

  check(dPage.url().endsWith('/engenharia/obras/obra-exemplo'), 'route ends with /engenharia/obras/obra-exemplo');
  check(await dPage.locator('h1:has-text("Reforço Estrutural — Ponte Atlântica")').isVisible(), 'h1 title: Ponte Atlântica');

  // 2. Mobile Validation (390×844) & Precise Tab Screenshots
  console.log('\n── Mobile (390×844) ──');
  const mContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    ignoreHTTPSErrors: true
  });
  const mPage = await mContext.newPage();
  const mErrors = [];
  mPage.on('console', msg => { if (msg.type() === 'error') mErrors.push(msg.text()); });

  await mPage.goto(`${BASE_URL}/engenharia/obras/obra-exemplo`, { waitUntil: 'networkidle' });
  await mPage.waitForTimeout(500);

  const mScrollY = await mPage.evaluate(() => window.scrollY);
  check(mScrollY === 0, `mobile initial scrollY === 0 (actual: ${mScrollY})`);
  check(await mPage.locator('h1:has-text("Detalhe da Obra")').isVisible(), 'mobile title visible');

  const mOverflow = await mPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  check(mOverflow, 'mobile zero page overflow');
  check(mErrors.length === 0, `mobile zero console errors — ${mErrors.length}`);

  // Mobile Territorial Tab
  console.log('  Capturando 05-engenharia-obra-mobile-territorial.png...');
  await mPage.locator('button').filter({ hasText: /^Territorial$/ }).click();
  await mPage.waitForTimeout(600); // Allow Leaflet map tiles & markers render
  await mPage.evaluate(() => {
    const tabBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Territorial');
    if (tabBtn) tabBtn.scrollIntoView({ block: 'top', behavior: 'instant' });
  });
  await mPage.waitForTimeout(300);

  const mapAttached = await mPage.evaluate(() => !!document.querySelector('.leaflet-container'));
  check(mapAttached, 'mobile Leaflet map attached & rendered');
  check(await mPage.locator('text=Coincidência territorial não representa vínculo').isVisible(), 'mobile territorial disclaimer visible');
  check(await mPage.locator('text=Contexto Territorial de Niterói / RJ').isVisible(), 'mobile territorial context panel visible');

  await mPage.screenshot({ path: join(screenshotsDir, '05-engenharia-obra-mobile-territorial.png'), fullPage: false });
  console.log('  📸 Captured 05-engenharia-obra-mobile-territorial.png (390×844)');

  // Mobile Proveniência Tab
  console.log('  Capturando 05-engenharia-obra-mobile-proveniencia.png...');
  await mPage.locator('button').filter({ hasText: /^Proveniência$/ }).click();
  await mPage.waitForTimeout(400);
  await mPage.evaluate(() => {
    const tabBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Proveniência');
    if (tabBtn) tabBtn.scrollIntoView({ block: 'top', behavior: 'instant' });
  });
  await mPage.waitForTimeout(300);

  check(await mPage.locator('text=Proveniência simulada e rastreabilidade do protótipo').isVisible(), 'mobile proveniência title visible');
  check(await mPage.locator('text=Fonte não consultada neste mockup.').isVisible(), 'mobile proveniência note visible');
  check(await mPage.locator('text=Campo: Município/UF').isVisible(), 'mobile proveniência vertical card field visible');
  check(await mPage.locator('text=Campo: CNPJ').isVisible(), 'mobile proveniência vertical card CNPJ visible');

  const provOverflow = await mPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  check(provOverflow, 'mobile proveniência tab zero page overflow');

  await mPage.screenshot({ path: join(screenshotsDir, '05-engenharia-obra-mobile-proveniencia.png'), fullPage: false });
  console.log('  📸 Captured 05-engenharia-obra-mobile-proveniencia.png (390×844)');

  await browser.close();

  console.log('\n==================================================');
  console.log(`Results: ${passed}/${passed + failed} passed`);
  console.log('==================================================\n');

  if (failed > 0) process.exit(1);
})();
