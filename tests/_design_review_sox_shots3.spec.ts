import { test } from './_helpers';

/** Design-review capture, part 3 — the three views parts 1-2 missed. */
test.use({ viewport: { width: 1440, height: 900 } });

const OUT = '/private/tmp/claude-501/-Users-aasthajain-Desktop-Product-Irame-Product-handover/dbc3250c-e873-40ca-afd8-acbb58e7a081/scratchpad/sox-shots';

test('capture SOX journey part 3', async ({ page }) => {
  test.setTimeout(200_000);

  const shot = async (name: string) => {
    await page.mouse.move(1420, 500);
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 80 });
  };

  const enterEngagement = async () => {
    await page.goto('/');
    await page.locator('[title="Engagements"]').first().click();
    await page.waitForTimeout(500);
    await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
    await page.waitForTimeout(900);
  };

  const tryStep = async (label: string, fn: () => Promise<void>) => {
    try { await fn(); } catch (e) { console.log(`SKIPPED ${label}: ${String(e).slice(0, 120)}`); }
  };

  // 17 — Exceptions drill-in (straight from a fresh overview)
  await enterEngagement();
  await tryStep('exceptions', async () => {
    await page.locator('button', { hasText: 'Manage exceptions' }).first().click({ timeout: 8000 });
    await page.waitForTimeout(900);
    await shot('17-exceptions');
  });

  // 15 — Bulk tests view inside Test runs
  await enterEngagement();
  await page.locator('[title="Drag to reorder"] button', { hasText: 'Test runs' }).first().click();
  await page.waitForTimeout(700);
  await tryStep('bulk tests', async () => {
    await page.locator('button', { hasText: 'Bulk tests' }).first().click({ timeout: 8000 });
    await page.waitForTimeout(700);
    await shot('15-bulk-tests');
  });

  // 20 — Reviewer dossier (countersign context)
  await enterEngagement();
  await page.getByRole('button', { name: 'Reviewer' }).first().click();
  await page.waitForTimeout(1000);
  await tryStep('reviewer dossier', async () => {
    await page.locator('button:has-text("C-0")').first().click({ timeout: 8000 });
    await page.waitForTimeout(900);
    await shot('20-reviewer-dossier');
  });
});
