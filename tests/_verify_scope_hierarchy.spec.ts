import { test, expect } from './_helpers';

/**
 * The group's shape survives into the New audit → Scope step.
 *
 * Only a chart-created engagement has a hierarchy to show — every seeded entity
 * in the repo is parentless — so this walks the whole journey: upload the org
 * chart on Basics, create the programme, then open a new audit on it and check
 * the Scope list indents the same way the creation table did.
 *
 * The two things that matter here:
 *  · the TOGGLES stay in one straight column (user ask) — only the name indents,
 *    because a control you flip should not wander with depth;
 *  · leaving a company out while the company that HOLDS it is in gets named,
 *    which is the decision a flat list used to hide.
 */

const SHOT_DIR = '/private/tmp/claude-501/-Users-aasthajain-Desktop-Product-Irame-Product-handover/e4611527-b2d2-4848-8aa2-dda858a9a11e/scratchpad/org-chart-shots';
const CHART_PDF = '/Users/aasthajain/Desktop/Product-Irame/Product-handover/docs/samples/meridian-global-holdings-org-chart.pdf';

test('the Scope step keeps the group hierarchy, with the toggles in one column', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');

  // ── Create an engagement from the org chart ──────────────────────────────
  await page.getByRole('navigation').getByRole('button', { name: 'Engagements', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'New Engagement' }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('dialog', { name: 'Create Engagement' }).getByText('SOX / ICFR', { exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.waitForTimeout(600);

  const sheet = page.getByRole('dialog', { name: 'New engagement' });
  await sheet.locator('input[aria-label="Upload org chart"]').setInputFiles(CHART_PDF);
  await expect(sheet.getByText(/Read 12 companies off the chart/)).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /^Create FY\d+ programme$/ }).click();
  await page.waitForTimeout(1200);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // ── Open it, then start an audit on it ───────────────────────────────────
  // The library lands on Overview, which is a portfolio summary — the new
  // engagement is only listed under All Engagements.
  await page.getByRole('tab', { name: /All Engagements/ }).click();
  await page.waitForTimeout(700);
  await page.getByText(/ICFR — Meridian Global Holdings/).first().click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'SOX audit', exact: true }).first().click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: /New audit/ }).first().click();
  await page.waitForTimeout(700);

  // Period → Materiality & files → Scope. The date pickers are the app's own
  // component (a button, calendar in a portal), so days are found on `page`.
  const audit = page.getByRole('dialog', { name: 'New audit' });
  for (let i = 0; i < 2; i++) {
    await audit.getByRole('button', { name: /dd\/mm\/yyyy/ }).first().click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Today', exact: true }).click();
    await page.waitForTimeout(300);
  }
  await audit.getByRole('button', { name: /Continue/ }).click();   // → Materiality & files
  await page.waitForTimeout(600);
  await audit.getByRole('button', { name: /Continue/ }).click();   // → Scope
  await page.waitForTimeout(800);
  await expect(audit.getByText('What this audit covers')).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/10-scope-step.png`, fullPage: false });

  // ── The toggles are one straight column ─────────────────────────────────
  const geom = await page.evaluate(() => {
    const switches = Array.from(document.querySelectorAll('[role="switch"]')) as HTMLElement[];
    const lefts = switches.map(s => Math.round(s.getBoundingClientRect().left));
    const nameLeft = (name: string) => {
      const el = Array.from(document.querySelectorAll('span'))
        .find(s => s.textContent?.trim() === name);
      return el ? Math.round(el.getBoundingClientRect().left) : -1;
    };
    return {
      switchCount: switches.length,
      distinctLefts: [...new Set(lefts)],
      root: nameLeft('Meridian Global Holdings, Inc.'),
      level2: nameLeft('Meridian Freight Systems LLC'),
      level3: nameLeft('Meridian Trucking Midwest LLC'),
    };
  });

  expect(geom.switchCount).toBeGreaterThan(3);
  // Every toggle at the same x — the whole point of indenting only the name.
  expect(geom.distinctLefts).toHaveLength(1);

  // ── The names step in with depth ────────────────────────────────────────
  expect(geom.root).toBeGreaterThan(0);
  expect(geom.level2).toBeGreaterThan(geom.root);
  expect(geom.level3).toBeGreaterThan(geom.level2);

  // ── Taking a parent in while its children stay out gets named ───────────
  // Nothing is in scope yet, so there is nothing split and nothing to say.
  await expect(audit.getByText(/held by a company that IS in scope/)).toHaveCount(0);

  await audit.getByRole('switch', { name: /Bring Meridian Freight Systems LLC into scope/ }).click();
  await page.waitForTimeout(400);
  const split = audit.getByText(/held by a company that IS in scope/);
  await expect(split).toBeVisible();
  await expect(audit.getByText(/Meridian Trucking Midwest LLC, Meridian Last Mile LLC/)).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/11-split-family-warning.png` });
});

test('the live Altura group carries its chain into the Scope step', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Engagements', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('tab', { name: /All Engagements/ }).click();
  await page.waitForTimeout(700);
  await page.getByText('FY26 ICFR — Altura Infra Group').first().click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'SOX audit', exact: true }).first().click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: /New audit/ }).first().click();
  await page.waitForTimeout(700);

  const audit = page.getByRole('dialog', { name: 'New audit' });
  for (let i = 0; i < 2; i++) {
    await audit.getByRole('button', { name: /dd\/mm\/yyyy/ }).first().click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Today', exact: true }).click();
    await page.waitForTimeout(300);
  }
  await audit.getByRole('button', { name: /Continue/ }).click();
  await page.waitForTimeout(600);
  await audit.getByRole('button', { name: /Continue/ }).click();
  await page.waitForTimeout(900);
  await expect(audit.getByText('What this audit covers')).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/12-altura-scope.png` });

  const geom = await page.evaluate(() => {
    const lefts = (Array.from(document.querySelectorAll('[role="switch"]')) as HTMLElement[])
      .map(s => Math.round(s.getBoundingClientRect().left));
    const nameLeft = (name: string) => {
      const el = Array.from(document.querySelectorAll('span')).find(s => s.textContent?.trim() === name);
      return el ? Math.round(el.getBoundingClientRect().left) : -1;
    };
    return {
      distinctLefts: [...new Set(lefts)],
      root: nameLeft('Altura Infra Holdings Ltd'),
      level2: nameLeft('Altura Roadways Pvt Ltd'),
      level3: nameLeft('Altura Logistics Parks Pvt Ltd'),
    };
  });
  expect(geom.distinctLefts).toHaveLength(1);
  expect(geom.level2).toBeGreaterThan(geom.root);
  expect(geom.level3).toBeGreaterThan(geom.level2);

  // The warning is about SUB-GROUP splits, not about the ordinary business of
  // leaving an immaterial subsidiary of the parent out. Roadways is in scope and
  // the parks it holds are not, so only the parks are named — Transmission and
  // Water Utilities sit directly under the holding and are nobody's surprise.
  const split = audit.getByText(/held by a company that IS in scope/);
  await expect(split).toBeVisible();
  await expect(split).toContainText('Altura Logistics Parks Pvt Ltd');
  await expect(split).not.toContainText('Altura Water Utilities Pvt Ltd');
  await expect(split).not.toContainText('Altura Transmission Pvt Ltd');
});
