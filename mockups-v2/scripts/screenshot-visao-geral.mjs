import puppeteer from 'puppeteer';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const screenshotsDir = resolve(__dirname, '..', 'screenshots');
mkdirSync(screenshotsDir, { recursive: true });

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
page.setDefaultNavigationTimeout(60000);

const sizes = [
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'laptop', width: 1440, height: 900 },
];

for (const size of sizes) {
  await page.setViewport({ width: size.width, height: size.height });
  await page.goto('http://localhost:4173/mockups-v2/visao-geral', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({
    path: `${screenshotsDir}/02-visao-geral-${size.name}.png`,
    fullPage: false,
  });
  console.log(`Captured 02-visao-geral-${size.name}.png`);
}

await browser.close();
console.log('All screenshots captured');
