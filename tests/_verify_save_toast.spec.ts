import { test, expect, type Page } from '@playwright/test';
import { enterWorkspace } from './_helpers';

// Save as workflow keeps its existing behaviour; the success toast now carries
// the workflow name + a "View in library" action that redirects to the
// workflow library where the new workflow sits.

test.setTimeout(120000);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.addInitScript(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ } });
});

async function answerClarification(page: Page, max = 8) {
  await page.getByText(/Question 1 of/).waitFor({ timeout: 8000 });
  for (let guard = 0; guard < max; guard++) {
    await page.locator('[role=radio], [role=checkbox]').first().click().catch(() => {});
    const done = page.getByRole('button', { name: 'Done' });
    if (await done.count() > 0) { await done.click().catch(() => {}); break; }
    const next = page.getByRole('button', { name: 'Next' });
    if (await next.count() > 0) await next.click().catch(() => {}); else break;
  }
}

test('save-as-workflow toast → View in library lands on the saved workflow', async ({ page }) => {
  await page.goto('/?view=chat');
  await enterWorkspace(page);
  await page.getByRole('textbox', { name: 'Message IRA' }).fill('Find duplicate invoices in Q1');
  await page.getByRole('button', { name: 'Send message' }).click();
  await answerClarification(page);
  await page.getByText('Flagged duplicate pairs').waitFor({ timeout: 20000 });

  await page.getByRole('button', { name: 'Save as workflow' }).click();
  await page.waitForTimeout(700);
  if (await page.getByText(/Question 1 of/).count() > 0) {
    await answerClarification(page);
  }

  // Drive the modal: BP → sub-process → wait Next enabled → Next → confirm.
  await page.locator('#wf-bp-trigger').waitFor({ timeout: 8000 });
  await page.locator('#wf-bp-trigger').click();
  await page.locator('[role=option]').first().click();
  await page.locator('#wf-sub-trigger').click();
  await page.locator('[role=option]').first().click();
  const next = page.getByRole('button', { name: /^Next/ });
  await expect(next).toBeEnabled({ timeout: 5000 });
  await next.click();

  const confirm = page.getByRole('button', { name: /Save & switch to workflow/ });
  await expect(confirm).toBeVisible({ timeout: 5000 });
  await confirm.click();

  // Success toast appears, with the workflow name + a "View in library" action.
  const toast = page.getByText(/Workflow draft ".*" created/);
  await expect(toast).toBeVisible({ timeout: 6000 });
  const toastText = await toast.innerText();
  const savedName = (toastText.match(/Workflow draft "(.+?)" created/) || [])[1] || '';
  const viewInLib = page.getByRole('button', { name: 'View in library' });
  await expect(viewInLib).toBeVisible();
  await page.screenshot({ path: 'test-results/save-toast.png' });

  // Click it → redirected to the workflow library (chat composer gone).
  await viewInLib.click();
  await expect(page.getByRole('textbox', { name: 'Message IRA' })).toHaveCount(0, { timeout: 6000 });
  // Dismiss the toast so the saved name can ONLY match a real library row,
  // not the toast text — proves the workflow actually sits in the library.
  await page.getByRole('button', { name: 'Dismiss' }).click().catch(() => {});
  await page.waitForTimeout(300);
  expect(savedName.length).toBeGreaterThan(0);
  await expect(page.getByText(savedName, { exact: false }).first()).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: 'test-results/save-library.png' });
  console.log(`[[savedName]] "${savedName}"`);
});
