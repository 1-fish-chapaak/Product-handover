import { expect } from '@playwright/test';
import { test } from './_helpers';
import fs from 'node:fs';

/**
 * Platform-wide smoke sweep: walk every sidebar section (Platform Usage is
 * deliberately excluded) and record console errors, page exceptions and blank
 * renders. Screenshots land in tests/__screenshots__/sweep/.
 */

const SHOT_DIR = 'tests/__screenshots__/sweep';

type Issue = { where: string; kind: string; detail: string };
const issues: Issue[] = [];

const NAV = [
  'Ask IRA', 'Home', 'Recents', 'Audit Planning', 'Engagements', 'My Queue',
  'Process Hub', 'Dashboard', 'Report', 'Risk Register', 'Control Library',
  'Workflow Library', 'AI Concierge', 'Knowledge Hub', 'Admin',
];

const IGNORE = [/Download the React DevTools/i, /\[vite\]/i, /favicon/i];

test('platform sweep — every section except Platform Usage', async ({ page }) => {
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  let current = 'boot';
  page.on('console', (m) => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    const text = m.text();
    if (IGNORE.some((re) => re.test(text))) return;
    issues.push({ where: current, kind: `console.${m.type()}`, detail: text.slice(0, 300) });
  });
  page.on('pageerror', (e) => {
    issues.push({ where: current, kind: 'pageerror', detail: String(e.message).slice(0, 300) });
  });

  await page.goto('/');
  await page.waitForTimeout(800);

  for (const label of NAV) {
    current = label;
    const item = page.getByRole('button', { name: new RegExp(`^${label}`, 'i') }).first();
    if ((await item.count()) === 0) {
      issues.push({ where: label, kind: 'nav-missing', detail: 'sidebar item not found' });
      continue;
    }
    await item.click();
    await page.waitForTimeout(1400); // the shell flashes a 400ms skeleton on view change

    const body = (await page.locator('body').innerText()).trim();
    if (body.length < 40) issues.push({ where: label, kind: 'blank', detail: `body text length ${body.length}` });
    if (/something went wrong|unexpected error/i.test(body)) {
      issues.push({ where: label, kind: 'error-boundary', detail: body.slice(0, 200) });
    }

    await page.screenshot({ path: `${SHOT_DIR}/${label.toLowerCase().replace(/\s+/g, '-')}.png` });
  }

  fs.writeFileSync(`${SHOT_DIR}/issues.json`, JSON.stringify(issues, null, 2));
  console.log('\n=== SWEEP ISSUES ===\n' + JSON.stringify(issues, null, 2));
  expect(issues).toEqual([]);
});
