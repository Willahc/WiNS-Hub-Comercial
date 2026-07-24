import { chromium } from '@playwright/test';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const screenshotsDir = join(__dirname, 'screenshots');
const BASE_URL = 'https://winshubcomercial.com.br:18443/mockups-v2';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--ignore-certificate-errors'] });

  // 1. Mobile — Ações abertas
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/engenharia`, { waitUntil: 'networkidle', timeout: 25000 });
    await page.waitForTimeout(1000);

    // Click "Ações" button (mobile only)
    const acoesBtn = page.locator('button', { hasText: 'Ações' });
    await acoesBtn.click();
    await page.waitForTimeout(500);

    // Verify bottom sheet is open
    const sheet = page.locator('[role="dialog"]');
    await sheet.waitFor({ state: 'visible', timeout: 5000 });

    await page.screenshot({ path: join(screenshotsDir, '03-engenharia-acoes-abertas-mobile.png'), fullPage: false });
    console.log('  Saved 03-engenharia-acoes-abertas-mobile.png');

    // Validate: close by Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await sheet.waitFor({ state: 'hidden', timeout: 3000 });
    console.log('  ✓ Escape closes the sheet');

    await ctx.close();
  }

  // 2. Desktop — Filtros avançados abertos
  {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/engenharia`, { waitUntil: 'networkidle', timeout: 25000 });
    await page.waitForTimeout(800);

    const avancadosBtn = page.locator('button', { hasText: 'Avançados' });
    await avancadosBtn.click();
    await page.waitForTimeout(400);

    await page.screenshot({ path: join(screenshotsDir, '03-engenharia-filtros-abertos-desktop.png'), fullPage: false });
    console.log('  Saved 03-engenharia-filtros-abertos-desktop.png');

    await ctx.close();
  }

  // 3. Mobile — Filtros avançados abertos
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/engenharia`, { waitUntil: 'networkidle', timeout: 25000 });
    await page.waitForTimeout(800);

    const avancadosBtn = page.locator('button', { hasText: 'Avançados' });
    await avancadosBtn.click();
    await page.waitForTimeout(400);

    await page.screenshot({ path: join(screenshotsDir, '03-engenharia-filtros-abertos-mobile.png'), fullPage: false });
    console.log('  Saved 03-engenharia-filtros-abertos-mobile.png');

    await ctx.close();
  }

  await browser.close();
  console.log('\nAll interactive screenshots captured.');
})();
