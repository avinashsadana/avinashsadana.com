import { chromium, devices } from '@playwright/test';
const file = '/tmp/fifteen.jpg';

async function run(label, contextOptions) {
  const b = await chromium.launch();
  const ctx = await b.newContext(contextOptions);
  await ctx.addInitScript(() => { try { sessionStorage.setItem('intro','1'); } catch {} });
  const p = await ctx.newPage();

  await p.goto('https://avinashsadana.com/admin', { waitUntil: 'domcontentloaded' });
  await p.fill('#password', 'word12pass');
  await Promise.all([p.waitForLoadState('networkidle'), p.getByRole('button', { name: 'Sign in' }).click()]);
  await p.waitForSelector('[data-writer-file]', { state: 'attached', timeout: 20000 });
  await p.waitForTimeout(1000);

  const started = Date.now();
  await p.setInputFiles('[data-writer-file]', file);
  await p.waitForTimeout(25000);

  const status = (await p.locator('[data-writer-status]').textContent()).trim();
  const body = await p.locator('#writer-body').inputValue();
  const url = (body.match(/\((https:\/\/[^)]+)\)/) || [])[1];

  let stored = 'none';
  if (url) {
    const res = await p.request.get(url);
    stored = res.status() + ', ' + (Number(res.headers()['content-length'] || 0) / 1024).toFixed(0) + ' KB';
  }
  console.log(`${label.padEnd(16)} ${((Date.now()-started)/1000).toFixed(1)}s  | ${url ? 'UPLOADED' : 'FAILED'} | stored: ${stored}`);
  console.log(`${''.padEnd(16)} status: ${status}`);
  await b.close();
}

await run('desktop', { viewport: { width: 1280, height: 900 } });
await run('iPhone 14', { ...devices['iPhone 14'], isMobile: true, hasTouch: true });
