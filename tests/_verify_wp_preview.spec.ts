import { test, expect } from './_helpers';
import { createSoxEngagement, openFromLibrary } from './_sox_helpers';

const SHOT_DIR = '/private/tmp/claude-501/-Users-aasthajain-Desktop-Product-Irame-Product-handover/b428675a-455c-4a0e-9017-16bd4ea1aa22/scratchpad/wp-preview-shots';

/**
 * Engagement working-paper preview on the control library: an excel-style
 * sheet-tab strip, one sheet on screen at a time (preview ≡ xlsx), the live
 * sign-off on its own sheet — and the paper follows the register's filters,
 * only visible controls' data goes in. Walked on a scoping-born engagement
 * created from Engagements (7 derived processes, so the Treasury search has
 * something to narrow to).
 */
test('working-paper preview is sheet-wise and follows filters', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await createSoxEngagement(page, 'FY27 ICFR — Airline Group');
  await openFromLibrary(page, 'FY27 ICFR — Airline Group');
  await page.getByText('Control Library', { exact: true }).first().click();
  await page.waitForTimeout(600);

  await page.getByRole('button', { name: 'Export working paper' }).click();
  await page.waitForTimeout(400);
  const modal = page.locator('.modal-wide');
  await expect(modal.getByText('Working paper — preview')).toBeVisible();

  // Index opens first; the other sheets' content is not on screen yet
  await expect(modal.getByText('Internal Control over Financial Reporting (ICFR) — Working Paper')).toBeVisible();
  await expect(modal.getByText('Controls in scope', { exact: true })).toBeVisible();
  await expect(modal.getByText('TOE method', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${SHOT_DIR}/01-index.png` });

  // Every sheet has a tab; clicking swaps the content
  await modal.getByRole('button', { name: 'Sign-off', exact: true }).click();
  await expect(modal.getByText('Sign-off — included in the file')).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/02-signoff.png` });

  await modal.getByRole('button', { name: 'Control Summary', exact: true }).click();
  await expect(modal.getByText('TOE method', { exact: true })).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/03-summary.png` });

  await modal.getByRole('button', { name: 'Operating Testing', exact: true }).click();
  await expect(modal.getByText(/\d+ attribute rows/)).toBeVisible();

  await modal.getByRole('button', { name: 'Scope', exact: true }).click();
  await expect(modal.getByText(/significant accounts/).first()).toBeVisible();

  // no filter note when nothing is filtered
  await modal.getByRole('button', { name: 'Index', exact: true }).click();
  await expect(modal.getByText(/filtered out/)).toHaveCount(0);
  await modal.getByRole('button', { name: 'Close' }).click();

  // Apply a filter (search narrows the register), reopen — the paper follows
  // the visible subset
  await page.getByPlaceholder(/Search controls/).fill('Treasury');
  await page.waitForTimeout(400);
  const showing = await page.getByText(/Showing \d+ of \d+ controls/).textContent();
  const [, visible, total] = showing!.match(/Showing (\d+) of (\d+)/)!;
  expect(Number(visible)).toBeLessThan(Number(total));

  await page.getByRole('button', { name: 'Export working paper' }).click();
  await page.waitForTimeout(400);
  await expect(modal.getByText(new RegExp(`covers the ${visible} controls visible`))).toBeVisible();
  await expect(modal.getByText(new RegExp(`filtered — ${visible} of ${total} controls`))).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/04-filtered-index.png` });
  await modal.getByRole('button', { name: 'Control Summary', exact: true }).click();
  await expect(modal.getByText(`${visible} controls`, { exact: true })).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/05-filtered-summary.png` });
  await modal.getByRole('button', { name: 'Close' }).click();

  // Control detail page: the Working paper button opens the same sheet-wise
  // preview (sections of its single sheet), download only from there
  await page.getByPlaceholder(/Search controls/).fill('');
  await page.waitForTimeout(400);
  await page.getByText('Procure to Pay transactions are approved before processing.').first().click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Working paper' }).click();
  await page.waitForTimeout(400);
  await expect(modal.getByText('Working paper — preview')).toBeVisible();
  // Control section opens first — header + control facts
  await expect(modal.getByText(/Working paper PX-01 — Test of Design/)).toBeVisible();
  await expect(modal.getByText('Control frequency', { exact: true })).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/06-control-paper.png` });
  await modal.getByRole('button', { name: 'Sign-off', exact: true }).click();
  await expect(modal.getByText('Sign-off — audit record')).toBeVisible();
  await modal.getByRole('button', { name: 'Design Testing', exact: true }).click();
  await expect(modal.getByText('Test of design', { exact: true })).toBeVisible();
  await modal.getByRole('button', { name: 'Operating Testing', exact: true }).click();
  await expect(modal.getByText(/Details of samples tested|attribute-level/).first()).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/07-control-operating.png` });
  await modal.getByRole('button', { name: 'Results', exact: true }).click();
  await expect(modal.getByText('Test results', { exact: true })).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/08-control-results.png` });
});
