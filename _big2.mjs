import { chromium, webkit, devices } from '@playwright/test';
const file = '/tmp/fifteen.jpg';

async function run(label, browserType, contextOptions) {
  const b = await browserType.launch();
  const ctx = await b.newContext(contextOptions);
  await ctx.addInitScript(() => { try { sessionStorage.setItem('intro','1'); } catch {} });
  const p = await ctx.newPage();

  await p.goto('https://avinashsadana.com/admin', { waitUntil: 'domcontentloaded' });
  await p.fill('#password', 'word12pass');
  await Promise.all([p.waitForLoadState('networkidle'), p.getByRole('button', { name: 'Sign in' }).click()]);
  await p.waitForSelector('[data-writer-file]', { state: 'attached', timeout: 20000 });
  await p.waitForTimeout(800);

  const started = Date.now();
  await p.setInputFiles('[data-writer-file]', file);

  // Wait for a real outcome rather than a fixed sleep.
  let outcome = 'timed out';
  for (let i = 0; i < 60; i++) {
    const status = (await p.locator('[data-writer-status]').textContent()).trim();
    if (/Photo added/.test(status)) { outcome = 'uploaded'; break; }
    if (status && !/Adding photo/.test(status)) { outcome = 'error: ' + status; break; }
    await p.waitForTimeout(1000);
  }
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const body = await p.locator('#writer-body').inputValue();
  const url = (body.match(/\((https:\/\/[^)]+)\)/) || [])[1];
  let kb = '—';
  if (url) {
    const res = await p.request.get(url);
    kb = (Number(res.headers()['content-length'] || 0) / 1024).toFixed(0) + ' KB';
  }
  console.log(`${label.padEnd(22)} ${seconds.padStart(5)}s  ${outcome === 'uploaded' ? 'OK' : 'FAIL'}  stored ${kb}   ${outcome === 'uploaded' ? '' : outcome}`);
  await b.close();
}

await run('Chrome desktop', chromium, { viewport: { width: 1280, height: 900 } });
await run('Safari engine desktop', webkit, { viewport: { width: 1280, height: 900 } });
await run('Safari engine iPhone', webkit, { ...devices['iPhone 14'], isMobile: true, hasTouch: true });
