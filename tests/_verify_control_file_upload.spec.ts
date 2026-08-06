import { test, expect } from './_helpers';

const SHOTS = 'test-results/control-file-upload';

/**
 * Entry point 2 of the provenance rule — a control uploads a file the audit
 * hasn't got, answers where it came from ONCE, and the file joins the audit's
 * registry so every other control inherits the answer.
 *
 * Walks the real path: the modal takes a file and the origin question together,
 * Add file is dead until both are in, and what comes back is a selected,
 * provenance-tagged row in the source picker.
 *
 * Navigation copied from _verify_control_flow_v2 — the proven path to the
 * audit-level five-step control page. T-05 is used because its population is
 * not yet extracted, so the source picker is on screen.
 */
test('control-level upload registers the file and selects it', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');

  await page.getByRole('navigation').getByRole('button', { name: 'Engagements', exact: true }).click();
  await page.waitForTimeout(900);
  await page.getByRole('tab', { name: /All Engagements/ }).click();
  await page.waitForTimeout(800);
  await page.getByText(/ICFR/).first().click();
  await page.waitForTimeout(1200);
  await page.getByText('Control Library', { exact: true }).first().click();
  await page.waitForTimeout(900);
  await page.getByText('FX deals confirmed independently of dealing.').first().click();
  await page.waitForTimeout(1300);
  const runCard = page.getByRole('button').filter({ hasText: /Interim|Year-end|Roll-forward/ });
  await expect(runCard.first()).toBeVisible({ timeout: 15_000 });
  await runCard.first().click();
  await page.waitForTimeout(1400);
  await expect(page.getByText('Test of design', { exact: true }).first()).toBeVisible({ timeout: 15_000 });

  // Step ① — if this control already has a population, withdraw it so the
  // source picker (and its upload) is on screen.
  const withdraw = page.getByRole('button', { name: 'Withdraw', exact: true });
  if (await withdraw.count()) {
    await withdraw.first().click();
    await page.waitForTimeout(500);
    const confirm = page.getByRole('button', { name: 'Withdraw', exact: true }).last();
    await confirm.click();
    await page.waitForTimeout(900);
  }
  await expect(page.getByText('Select the source file')).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: `${SHOTS}/00-step1.png`, fullPage: true });

  await page.getByRole('button', { name: /Add a file|Upload a source file/ }).first().click();
  await expect(page.getByText('Add a source file')).toBeVisible();

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: /Choose a file/ }).click(),
  ]);
  await chooser.setFiles({ name: 'Finance & Accounts.xlsx', mimeType: 'application/vnd.ms-excel', buffer: Buffer.from('x') });
  await page.waitForTimeout(1500);
  await expect(page.getByText('Finance & Accounts.xlsx').first()).toBeVisible();

  await page.getByRole('button', { name: /Client-prepared/ }).first().click();
  await page.screenshot({ path: `${SHOTS}/01-modal-ready.png` });

  const addBtn = page.getByRole('button', { name: /^Add file$/ });
  await expect(addBtn).toBeEnabled();
  await addBtn.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/02-after-add.png`, fullPage: true });

  console.log('PAGE ERRORS >>>', JSON.stringify(errors));
  // modal closes, the file is in the picker list
  await expect(page.getByText('Add a source file')).toHaveCount(0);
  await expect(page.getByText('Finance & Accounts.xlsx').first()).toBeVisible();
});
