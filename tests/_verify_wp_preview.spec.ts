import { test, expect } from './_helpers';
import { openFromLibrary } from './_sox_helpers';

const SHOT_DIR = '/private/tmp/claude-501/-Users-aasthajain-Desktop-Product-Irame-Product-handover/b428675a-455c-4a0e-9017-16bd4ea1aa22/scratchpad/wp-preview-shots';

/**
 * The CONTROL working paper, previewed sheet-wise: one section on screen at a
 * time, the same blocks the .xlsx carries, sign-off on its own sheet, and
 * download only from the preview.
 *
 * REWRITTEN Aug 2026. Three things moved out from under this spec:
 *
 *   · The FIXTURE. It used to create an engagement through the wizard, but
 *     creation seeds no RACM any more (3c3e862 — "creation invents nothing"),
 *     so the engagement arrived with zero controls and every count assertion
 *     compared 0 against 0. It runs on the seeded Altura engagement now.
 *
 *   · The ROUTE. Testing lives inside an audit (0b10a9b — "audits run in
 *     rounds; the engagement is a portfolio"), so it opens one level deeper.
 *
 *   · The ENGAGEMENT-level paper lost its door. The register's icon-only
 *     "Export working paper" was parked at the user's request (see the comment
 *     at ControlRegister.tsx:307) and nothing else opens it, so the sheet-wise
 *     ENGAGEMENT paper — Index / Control Summary / TOE / Scope, and the
 *     follows-the-filter behaviour — is currently unreachable from any screen
 *     and cannot be tested through the UI. Those assertions are removed rather
 *     than faked. `buildIcfrPaper` still builds it; only the button is gone,
 *     and the parked block says it is one line from coming back.
 */
test('the control working paper previews sheet-wise, and downloads what it shows', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await openFromLibrary(page, 'FY26 ICFR — Altura Infra Group');
  await page.getByRole('button', { name: /(Open|View) CY 2026/ }).first().click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Control Library' }).last().click();
  await page.waitForTimeout(900);
  const modal = page.locator('.modal-wide');

  // The Working paper button on a control opens the sheet-wise preview —
  // sections of its single sheet — and download happens only from there.
  await page.getByRole('button', { name: /^Open TRY-01/ }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Working paper' }).click();
  await page.waitForTimeout(400);
  await expect(modal.getByText('Working paper — preview')).toBeVisible();
  // Control section opens first — header + control facts
  await expect(modal.getByText(/Working paper .+ — TOD & TOE/)).toBeVisible();
  await expect(modal.getByText('Control frequency', { exact: true })).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/06-control-paper.png` });
  await modal.getByRole('button', { name: 'Sign-off', exact: true }).click();
  await expect(modal.getByText('Sign-off — audit record')).toBeVisible();
  await modal.getByRole('button', { name: 'TOD', exact: true }).click();
  await expect(modal.getByText('TOD', { exact: true }).first()).toBeVisible();
  await modal.getByRole('button', { name: 'TOE', exact: true }).click();
  await expect(modal.getByText(/Details of samples tested|attribute-level/).first()).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/07-control-operating.png` });
  await modal.getByRole('button', { name: 'Results', exact: true }).click();
  await expect(modal.getByText('Test results', { exact: true })).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/08-control-results.png` });
});
