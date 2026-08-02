import { chromium } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

const BASE = 'https://avinashsadana.com';
const routes = ['/', '/work', '/ventures', '/ventures/wedesi-festival', '/endurance', '/about', '/writing', '/contact', '/guestbook', '/resume'];

const browser = await chromium.launch();
let total = 0;

for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
  const page = await ctx.newPage();

  for (const route of routes) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    if (violations.length) {
      total += violations.length;
      console.log(`\n${theme} ${route}`);
      for (const v of violations) {
        console.log(`  [${v.impact}] ${v.id}: ${v.help}`);
        for (const n of v.nodes.slice(0, 2)) console.log(`      ${n.target.join(' ')} :: ${(n.failureSummary||'').split('\n')[1]?.trim() ?? ''}`);
      }
    }
  }
  await ctx.close();
}

console.log(total === 0 ? '\nNo WCAG 2.1 A/AA violations across 10 pages x 2 themes.' : `\n${total} violation groups found.`);
await browser.close();
