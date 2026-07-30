import { test } from './_helpers';

/**
 * One-off design-review capture — the complete SOX/ICFR journey, click by
 * click, at 1440×900. Output goes to the session scratchpad, not the repo.
 * Best-effort: each segment re-enters the engagement fresh so a missed
 * selector only loses its own shots.
 */
test.use({ viewport: { width: 1440, height: 900 } });

const OUT = '/private/tmp/claude-501/-Users-aasthajain-Desktop-Product-Irame-Product-handover/dbc3250c-e873-40ca-afd8-acbb58e7a081/scratchpad/sox-shots';

test('capture SOX end-to-end journey', async ({ page }) => {
  test.setTimeout(300_000);

  const shot = async (name: string) => {
    await page.mouse.move(1420, 500); // park off the nav rail so it stays folded
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 80 });
  };

  const enterEngagement = async () => {
    await page.goto('/');
    await page.locator('[title="Engagements"]').first().click();
    await page.waitForTimeout(600);
    await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
    await page.waitForTimeout(1000);
  };

  const tryStep = async (label: string, fn: () => Promise<void>) => {
    try { await fn(); } catch (e) { console.log(`SKIPPED ${label}: ${String(e).slice(0, 120)}`); }
  };

  // ---- Segment A: entry + overview + scope (Auditor) ----
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  await shot('01-engagements-list');
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);
  await shot('02-overview-auditor');
  await tryStep('signoff scroll', async () => {
    await page.evaluate(() => document.getElementById('eng-signoff')?.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(500);
    await shot('03-overview-signoff');
    await page.evaluate(() => window.scrollTo(0, 0));
  });
  await tryStep('scope', async () => {
    await page.getByRole('button', { name: /Materiality & scope/i }).first().click();
    await page.waitForTimeout(800);
    await shot('04-scope');
  });

  // ---- Segment B: RACM landing → matrix → spreadsheet editor ----
  await enterEngagement();
  await page.getByRole('button', { name: 'RACM', exact: true }).first().click();
  await page.waitForTimeout(700);
  await shot('05-racm-landing');
  await tryStep('racm matrix', async () => {
    await page.locator('tr.reg-row').first().click();
    await page.waitForTimeout(900);
    await shot('06-racm-matrix');
  });
  await tryStep('racm editor popup', async () => {
    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 5000 }),
      page.getByRole('button', { name: /Open spreadsheet editor/i }).first().click(),
    ]);
    await popup.waitForLoadState();
    await popup.setViewportSize({ width: 1440, height: 900 });
    await popup.waitForTimeout(1500);
    await popup.screenshot({ path: `${OUT}/07-racm-editor.jpg`, type: 'jpeg', quality: 80 });
    await popup.close();
  });

  // ---- Segment C: libraries → dossier → working paper ----
  await enterEngagement();
  await page.getByRole('button', { name: 'Risk Register' }).first().click();
  await page.waitForTimeout(700);
  await shot('08-risk-library');
  await page.getByRole('button', { name: 'Control Library' }).first().click();
  await page.waitForTimeout(700);
  await shot('09-control-library');
  await tryStep('dossier', async () => {
    await page.locator('tr.reg-row').first().click();
    await page.waitForTimeout(900);
    await shot('10-control-dossier');
    await page.keyboard.press('End');
    await page.waitForTimeout(500);
    await shot('11-control-dossier-bottom');
  });
  await tryStep('working paper modal', async () => {
    await page.getByRole('button', { name: /Working paper/i }).first().click();
    await page.waitForTimeout(900);
    await shot('12-working-paper-modal');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  // ---- Segment D: test runs → expanded run → bulk tests ----
  await enterEngagement();
  await page.getByRole('button', { name: 'Test runs' }).first().click();
  await page.waitForTimeout(700);
  await shot('13-test-runs');
  await tryStep('run expanded', async () => {
    await page.locator('button[aria-expanded="false"]').first().click();
    await page.waitForTimeout(600);
    await shot('14-test-run-expanded');
  });
  await tryStep('bulk tests', async () => {
    await page.getByRole('button', { name: 'Bulk tests' }).first().click();
    await page.waitForTimeout(700);
    await shot('15-bulk-tests');
  });

  // ---- Segment E: notifications bell → exceptions ----
  await enterEngagement();
  await tryStep('notifications', async () => {
    await page.locator('button[aria-label^="To-do"]').first().click();
    await page.waitForTimeout(600);
    await shot('16-notifications-open');
    await page.keyboard.press('Escape');
    await page.mouse.click(400, 850);
    await page.waitForTimeout(300);
  });
  await tryStep('exceptions', async () => {
    await page.getByRole('button', { name: /Manage exceptions/i }).first().click();
    await page.waitForTimeout(800);
    await shot('17-exceptions');
  });

  // ---- Segment F: Reviewer desk → reviewer dossier ----
  await enterEngagement();
  await page.getByRole('button', { name: 'Reviewer' }).first().click();
  await page.waitForTimeout(1000);
  await shot('18-reviewer-overview');
  await tryStep('reviewer queue drill-in', async () => {
    const section = page.locator('button[aria-expanded]').first();
    if ((await section.getAttribute('aria-expanded')) === 'false') {
      await section.click();
      await page.waitForTimeout(500);
    }
    await shot('19-reviewer-queue-expanded');
    await page.locator('button[aria-expanded] ~ * button, [class*="reg-row"]').first().click();
    await page.waitForTimeout(900);
    await shot('20-reviewer-dossier');
  });

  // ---- Segment G: Risk Owner portal → owner task ----
  await enterEngagement();
  await page.getByRole('button', { name: 'Risk Owner' }).first().click();
  await page.waitForTimeout(1000);
  await shot('21-owner-portal');
  await tryStep('owner task drill-in', async () => {
    await page.locator('[role="button"][tabindex="0"]').first().click();
    await page.waitForTimeout(900);
    await shot('22-owner-dossier');
  });
});
