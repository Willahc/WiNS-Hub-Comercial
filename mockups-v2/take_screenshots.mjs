import { chromium } from '@playwright/test';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync } from 'fs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const screenshotsDir = join(__dirname, 'screenshots');
const BASE_URL = 'https://winshubcomercial.com.br:18443/mockups-v2';

const resolutions = [
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'laptop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--ignore-certificate-errors'] });

  for (const res of resolutions) {
    for (const dsf of [1, 2]) {
      const context = await browser.newContext({
        viewport: { width: res.width, height: res.height },
        deviceScaleFactor: dsf,
        ignoreHTTPSErrors: true,
      });
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(800);

      const suffix = dsf === 2 ? '@2x' : '';
      const filename = `01-login-${res.name}${suffix}.png`;
      await page.screenshot({ path: join(screenshotsDir, filename), fullPage: false });
      console.log(`  Saved ${filename} (${res.width}x${res.height}${dsf === 2 ? ' @2x' : ''})`);
      await context.close();
    }
  }

  await browser.close();
  console.log('Done.');
})();
