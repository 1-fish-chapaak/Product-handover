import { test } from './_helpers';
import fs from 'node:fs';

/**
 * DOM validity + layout audit across every section (Platform Usage excluded):
 *  - nested interactive elements (button inside button / a inside button …)
 *  - horizontal overflow on the page shell
 *  - images without alt text
 */

const NAV = [
  'Ask IRA', 'Home', 'Recents', 'Audit Planning', 'Engagements', 'My Queue',
  'Process Hub', 'Dashboard', 'Report', 'Risk Register', 'Control Library',
  'Workflow Library', 'AI Concierge', 'Knowledge Hub', 'Admin',
];

test('DOM audit — nested interactives, overflow, alt text', async ({ page }) => {
  const report: Record<string, unknown>[] = [];

  await page.goto('/');
  await page.waitForTimeout(800);

  for (const label of NAV) {
    await page.getByRole('button', { name: new RegExp(`^${label}`, 'i') }).first().click();
    await page.waitForTimeout(1300);

    const audit = await page.evaluate(() => {
      const nested: string[] = [];
      document.querySelectorAll('button, a[href]').forEach((el) => {
        el.querySelectorAll('button, a[href]').forEach((inner) => {
          const label =
            (inner.getAttribute('aria-label') || inner.textContent || '').trim().slice(0, 40);
          const outer =
            (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40);
          nested.push(`<${el.tagName.toLowerCase()} "${outer}"> contains <${inner.tagName.toLowerCase()} "${label}">`);
        });
      });

      const noAlt = Array.from(document.querySelectorAll('img'))
        .filter((i) => !i.hasAttribute('alt'))
        .map((i) => (i as HTMLImageElement).src.slice(-50));

      const doc = document.documentElement;
      return {
        nested: Array.from(new Set(nested)),
        overflowX: doc.scrollWidth > doc.clientWidth ? `${doc.scrollWidth} > ${doc.clientWidth}` : null,
        imgsWithoutAlt: noAlt,
      };
    });

    if (audit.nested.length || audit.overflowX || audit.imgsWithoutAlt.length) {
      report.push({ section: label, ...audit });
    }
  }

  fs.writeFileSync('tests/__screenshots__/dom-audit.json', JSON.stringify(report, null, 2));
  console.log('\n=== DOM AUDIT ===\n' + JSON.stringify(report, null, 2));
});
