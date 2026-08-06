import { chromium, request as pwRequest } from '@playwright/test';

// Get a session cookie without driving the login form, so no reload races us.
const api = await pwRequest.newContext({ baseURL: 'https://avinashsadana.com' });
await api.post('/api/admin/login', { data: { password: 'word12pass' } });
const state = await api.storageState();

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, storageState: state });
await ctx.addInitScript(() => { try { sessionStorage.setItem('intro','1'); } catch {} });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('  [pageerror]', e.message.slice(0,140)));
p.on('console', m => { if (m.type()==='error') console.log('  [console]', m.text().slice(0,150)); });

await p.goto('https://avinashsadana.com/admin', { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);

console.log('elements:', await p.evaluate(() => ({
  writer: !!document.querySelector('[data-writer]'),
  fileInput: !!document.querySelector('[data-writer-file]'),
  bound: document.querySelector('[data-writer]')?.dataset.bound,
})));

const blobResult = await p.evaluate(async () => {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 4; c.getContext('2d').fillRect(0,0,4,4);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const url = URL.createObjectURL(blob);
  return await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve('LOADS fine');
    img.onerror = () => resolve('BLOCKED  <-- this is the bug');
    img.src = url;
    setTimeout(() => resolve('timed out'), 3000);
  });
});
console.log('blob: URL in an <img> ->', blobResult);
console.log('CSP img-src ->', (await p.evaluate(() => document.querySelector('meta[http-equiv]')?.content)) ?? '(header only)');
await b.close();
await api.dispose();
