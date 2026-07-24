import { chromium } from '@playwright/test';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'https://winshubcomercial.com.br:18443/mockups-v2';
const screenshotsDir = '/root/wins_hub_unificado/mockups-v2/screenshots';

if (!existsSync(screenshotsDir)) mkdirSync(screenshotsDir, { recursive: true });

(async () => {
  console.log('\n==================================================');
  console.log('Recapturando EVIDÊNCIA MOBILE TERRITORIAL (390×844)');
  console.log('==================================================\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
  });

  const mContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    ignoreHTTPSErrors: true
  });
  const mPage = await mContext.newPage();
  const mErrors = [];
  mPage.on('console', msg => { if (msg.type() === 'error') mErrors.push(msg.text()); });

  // 1. Abrir diretamente
  await mPage.goto(`${BASE_URL}/engenharia/obras/obra-exemplo`, { waitUntil: 'networkidle' });
  await mPage.waitForTimeout(600);

  // 2. Selecionar a aba "Territorial"
  await mPage.locator('button').filter({ hasText: /^Territorial$/ }).click();
  await mPage.waitForTimeout(400);

  // 3. Executar scrollIntoView no início da barra de abas para trazer a aba e o mapa para a viewport
  await mPage.evaluate(() => {
    const tabBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Territorial');
    if (tabBtn) {
      // Find the tab bar container
      const tabsBar = tabBtn.parentElement;
      if (tabsBar) {
        tabsBar.scrollIntoView({ block: 'top', behavior: 'instant' });
      }
    }
  });

  // Compensate for sticky topbar (56px) so top of tab bar aligns below topbar
  await mPage.evaluate(() => {
    window.scrollBy(0, -56);
  });
  await mPage.waitForTimeout(800); // Allow Leaflet tiles & markers to render completely

  // 4. Bounding box & Playwright assertions
  const mapBox = await mPage.locator('.leaflet-container').boundingBox();
  console.log('  Map bounding box:', mapBox);

  const isMapVisible = await mPage.locator('.leaflet-container').isVisible();
  const hasMinHeight = mapBox && mapBox.height >= 260;
  const isMapTopInViewport = mapBox && mapBox.y >= 0 && mapBox.y < 844;
  const isMapBottomInViewport = mapBox && (mapBox.y + mapBox.height) <= 844;
  const hasAttribution = await mPage.locator('.leaflet-control-attribution').isVisible();
  const hasDisclaimer = await mPage.locator('text=Coincidência territorial não representa vínculo').isVisible();
  const hasContextPanel = await mPage.locator('text=Contexto Territorial de Niterói / RJ').isVisible();
  const zeroOverflow = await mPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  const scrollY = await mPage.evaluate(() => window.scrollY);

  console.log('  ScrollY:', scrollY);
  console.log('  1. .leaflet-container visível:', isMapVisible);
  console.log('  2. Height >= 260:', hasMinHeight, `(actual: ${mapBox?.height})`);
  console.log('  3. Topo do mapa na viewport:', isMapTopInViewport, `(y: ${mapBox?.y})`);
  console.log('  4. Base do mapa na viewport:', isMapBottomInViewport, `(y + h: ${mapBox ? mapBox.y + mapBox.height : 0})`);
  console.log('  5. Atribuição Leaflet/CARTO/OSM visível:', hasAttribution);
  console.log('  6. Ressalva/legenda visível:', hasDisclaimer);
  console.log('  7. Painel territorial abaixo visível:', hasContextPanel);
  console.log('  8. Zero overflow (scrollWidth === clientWidth):', zeroOverflow);
  console.log('  9. Zero erros de console:', mErrors.length === 0);

  if (!isMapVisible || !hasMinHeight || !isMapTopInViewport || !isMapBottomInViewport || !hasAttribution || !hasDisclaimer || !hasContextPanel || !zeroOverflow || mErrors.length > 0) {
    console.error('\n❌ Falha na validação das precondições da captura!');
    await browser.close();
    process.exit(1);
  }

  // 5. Salvar substituindo 05-engenharia-obra-mobile-territorial.png
  const screenshotPath = join(screenshotsDir, '05-engenharia-obra-mobile-territorial.png');
  await mPage.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`\n📸 Captura salva com sucesso em: ${screenshotPath}`);

  await browser.close();
})();
