import { test } from './_helpers';

/**
 * Design-review capture, part 2 — segments the first run missed (10-22).
 * Tab clicks are scoped to the engagement tab bar (Reorder.Item wrappers,
 * title="Drag to reorder") so the left nav rail can't hijack the name match.
 */
test.use({ viewport: { width: 1440, height: 900 } });

const OUT = '/private/tmp/claude-501/-Users-aasthajain-Desktop-Product-Irame-Product-handover/dbc3250c-e873-40ca-afd8-acbb58e7a081/scratchpad/sox-shots';

test('capture SOX journey part 2', async ({ page }) => {
  test.setTimeout(280_000);

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

  const clickTab = async (label: string) => {
    await page.locator('[title="Drag to reorder"] button', { hasText: label }).first().click();
    await page.waitForTimeout(700);
  };

  const tryStep = async (label: string, fn: () => Promise<void>) => {
    try { await fn(); } catch (e) { console.log(`SKIPPED ${label}: ${String(e).slice(0, 120)}`); }
  };

  // ---- Segment C: control library tab → dossier → working paper ----
  await enterEngagement();
  await clickTab('Control Library');
  await shot('09-control-library');
  await tryStep('dossier', async () => {
    await page.locator('tr.reg-row, .ac-card').first().click();
    await page.waitForTimeout(900);
    await shot('10-control-dossier');
    await page.keyboard.press('End');
    await page.waitForTimeout(500);
    await shot('11-control-dossier-bottom');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
  });
  await tryStep('working paper modal', async () => {
    await page.getByRole('button', { name: /Working paper/i }).first().click({ timeout: 6000 });
    await page.waitForTimeout(900);
    await shot('12-working-paper-modal');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  // ---- Segment D: test runs → expanded run → bulk tests ----
  await enterEngagement();
  await clickTab('Test runs');
  await shot('13-test-runs');
  await tryStep('run expanded', async () => {
    await page.locator('button[aria-expanded="false"]').first().click({ timeout: 6000 });
    await page.waitForTimeout(600);
    await shot('14-test-run-expanded');
  });
  await tryStep('bulk tests', async () => {
    await page.getByRole('button', { name: 'Bulk tests' }).first().click({ timeout: 6000 });
    await page.waitForTimeout(700);
    await shot('15-bulk-tests');
  });

  // ---- Segment E: notifications bell → exceptions ----
  await enterEngagement();
  await tryStep('notifications', async () => {
    await page.locator('button[aria-label^="To-do"]').first().click({ timeout: 6000 });
    await page.waitForTimeout(600);
    await shot('16-notifications-open');
    await page.keyboard.press('Escape');
    await page.mouse.click(400, 850);
    await page.waitForTimeout(300);
  });
  await tryStep('exceptions', async () => {
    await page.getByRole('button', { name: /Manage exceptions/i }).first().click({ timeout: 6000 });
    await page.waitForTimeout(800);
    await shot('17-exceptions');
  });

  // ---- Segment F: Reviewer desk → reviewer dossier ----
  await enterEngagement();
  await page.getByRole('button', { name: 'Reviewer' }).first().click();
  await page.waitForTimeout(1000);
  await shot('18-reviewer-overview');
  await tryStep('reviewer queue drill-in', async () => {
    const section = page.locator('button[aria-expanded="false"]').first();
    if (await section.count()) {
      await section.click({ timeout: 5000 });
      await page.waitForTimeout(500);
      await shot('19-reviewer-queue-expanded');
    }
    await page.getByRole('button', { name: /C-0\d/ }).first().click({ timeout: 6000 });
    await page.waitForTimeout(900);
    await shot('20-reviewer-dossier');
  });

  // ---- Segment G: Risk Owner portal → owner task ----
  await enterEngagement();
  await page.getByRole('button', { name: 'Risk Owner' }).first().click();
  await page.waitForTimeout(1000);
  await shot('21-owner-portal');
  await tryStep('owner task drill-in', async () => {
    await page.locator('[role="button"][tabindex="0"]').first().click({ timeout: 6000 });
    await page.waitForTimeout(900);
    await shot('22-owner-dossier');
  });
});
