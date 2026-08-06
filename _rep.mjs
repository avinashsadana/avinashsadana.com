import { chromium } from '@playwright/test';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(() => { try { sessionStorage.setItem('intro','1'); } catch {} });
const p = await ctx.newPage();

const blocked = [];
p.on('console', m => { if (m.type() === 'error') blocked.push(m.text().slice(0, 160)); });

await p.goto('https://avinashsadana.com/admin', { waitUntil: 'networkidle' });
await p.fill('#password', 'word12pass');
await p.getByRole('button', { name: 'Sign in' }).click();
await p.waitForTimeout(3000);

await p.fill('#writer-title', 'Photo upload reproduction');
await p.setInputFiles('[data-writer-file]', '/tmp/upl.jpg');
await p.waitForTimeout(4000);

console.log('status shown to user:', await p.locator('[data-writer-status]').textContent());
console.log('photos counted:', await p.locator('[data-writer-photo-count]').textContent());
console.log('');
console.log('console errors:');
for (const e of blocked.slice(0, 5)) console.log('  -', e);
await b.close();
