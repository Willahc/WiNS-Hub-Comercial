import { spawn } from 'child_process';
import puppeteer from 'puppeteer';

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const resp = await fetch(url);
      if (resp.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error('Server did not start');
}

async function main() {
  // Start preview server
  const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--host', '0.0.0.0'], {
    cwd: '/root/wins_hub_unificado/mockups-v2',
    stdio: 'pipe',
    shell: true,
  });

  server.stdout.on('data', d => process.stdout.write(d));
  server.stderr.on('data', d => process.stderr.write(d));

  await waitForServer('http://localhost:4173/mockups-v2/visao-geral');
  console.log('Server is up');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/root/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome',
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(30000);

  const sizes = [
    { name: 'desktop', width: 1920, height: 1080 },
    { name: 'laptop', width: 1440, height: 900 },
  ];

  for (const size of sizes) {
    await page.setViewport({ width: size.width, height: size.height });
    await page.goto('http://localhost:4173/mockups-v2/visao-geral', { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({
      path: `/root/wins_hub_unificado/mockups-v2/screenshots/02-visao-geral-${size.name}.png`,
      fullPage: false,
    });
    console.log(`Captured 02-visao-geral-${size.name}.png`);
  }

  await browser.close();
  server.kill();
  console.log('Done');
}

main().catch(err => { console.error(err); process.exit(1); });
