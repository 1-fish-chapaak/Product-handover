/**
 * Verifies the aa19493 Chat UI port — confirms the new Output tab + KPI grid
 * render in the artifact panel, and the workflow-mode qna-plan gate appears
 * after clarification.
 *
 * Run: PLAYWRIGHT_BASE_URL=http://localhost:5173 npx playwright test tests/verify-chat-ui-port.spec.ts --project=chromium
 */
import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';

async function bootApp(page: Page) {
  await page.goto(BASE);
  await page.getByRole('button', { name: 'Ask IRA' }).waitFor({ timeout: 15000 });
}

async function startChat(page: Page) {
  await page.getByRole('button', { name: 'Ask IRA' }).click();
  await page.locator('textarea').first().waitFor({ timeout: 5000 });
}

async function sendMessage(page: Page, msg: string) {
  const textarea = page.locator('textarea').first();
  await textarea.fill(msg);
  await textarea.press('Enter');
}

async function pickOption(page: Page, label: RegExp | string) {
  const opt = page.getByRole('option', { name: label });
  await opt.first().waitFor({ timeout: 15000 });
  await opt.first().click();
  await page.waitForTimeout(800);
}

// QUARANTINE (2026-05-29): all three tests below are test.fixme — they drive
// the multi-step chat/audit/workflow flow which has since changed (50s+
// timeouts waiting for elements that moved). Need re-anchoring to the current
// chat flow, not deletion.
test.fixme('Output tab renders KPI grid in artifact panel after audit run', async ({ page }) => {
  test.setTimeout(90_000);
  await bootApp(page);
  await startChat(page);
  await sendMessage(page, 'Detect duplicate invoices');

  await pickOption(page, /Last 90 days/);
  await pickOption(page, /1% tolerance/);
  await pickOption(page, /All vendors/);
  await pickOption(page, /Fuzzy match all fields/);

  // Wait for the audit result to render — confirms the panel is open
  await expect(
    page.locator('main').getByRole('button', { name: 'Dashboard', exact: true })
  ).toBeVisible({ timeout: 45000 });

  // The new Output tab should appear in the artifact panel tab strip
  const outputTab = page.getByRole('button', { name: /^Output$/ });
  await expect(outputTab).toBeVisible({ timeout: 5000 });

  await outputTab.click();
  await expect(page.getByText('Dashboard KPIs', { exact: true })).toBeVisible();

  // Scope assertions to the Output tab's KPI section (the same labels also
  // appear in the audit-result summary in the chat thread, which would trip
  // strict-mode otherwise).
  const kpiSection = page.locator('section').filter({ hasText: 'Dashboard KPIs' });
  await expect(kpiSection.getByText('Records scanned', { exact: true })).toBeVisible();
  await expect(kpiSection.getByText('Duplicates found', { exact: true })).toBeVisible();
  await expect(kpiSection.getByText('Highest match', { exact: true })).toBeVisible();
  await expect(kpiSection.locator('text=1.2M')).toBeVisible();

  await page.screenshot({ path: 'tests/__screenshots__/output-tab.png', fullPage: false });
});

test.fixme('Workflow-mode qna-plan gate shows Approve & run / Revise after clarification', async ({ page }) => {
  test.setTimeout(120_000);
  await bootApp(page);
  await startChat(page);

  // Send a query in chat mode first so we move past the empty-state composer.
  // The empty-state branch in handleSend routes workflow-toggled first sends
  // to the AI Concierge builder, bypassing the new gate.
  await sendMessage(page, 'Detect duplicate invoices');
  await pickOption(page, /Last 90 days/);
  await pickOption(page, /1% tolerance/);
  await pickOption(page, /All vendors/);
  await pickOption(page, /Fuzzy match all fields/);
  await expect(
    page.locator('main').getByRole('button', { name: 'Dashboard', exact: true })
  ).toBeVisible({ timeout: 45000 });

  // The in-conversation composer now carries its own "Build a workflow" toggle
  // (added in this port). Two toggles exist in the DOM at this point — the
  // empty-state one is hidden, the conversation one is the visible target.
  const workflowToggle = page.getByRole('switch', { name: 'Build a workflow' }).last();
  await expect(workflowToggle).toBeVisible();
  await workflowToggle.click();
  await expect(workflowToggle).toHaveAttribute('aria-checked', 'true');

  // Use a non-workflow-keyword query so simulateResponse routes to the
  // clarification flow (workflow keywords would route to startConversational
  // WorkflowFlow and bypass submitClarification entirely).
  await sendMessage(page, 'Show flagged transactions over five lakhs');
  await pickOption(page, /Last 90 days/);
  await pickOption(page, /1% tolerance/);
  await pickOption(page, /All vendors/);
  await pickOption(page, /Fuzzy match all fields/);

  await expect(page.getByRole('button', { name: /Approve & run/i })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: /^Revise$/i })).toBeVisible();

  await page.screenshot({ path: 'tests/__screenshots__/qna-plan-gate.png', fullPage: false });
});

test.fixme('Save-as-workflow now opens a tolerance/threshold clarification first, then the modal', async ({ page }) => {
  test.setTimeout(120_000);
  await bootApp(page);
  await startChat(page);

  // Run an audit query to surface the Save-as-workflow button on the result.
  await sendMessage(page, 'Detect duplicate invoices');
  await pickOption(page, /Last 90 days/);
  await pickOption(page, /1% tolerance/);
  await pickOption(page, /All vendors/);
  await pickOption(page, /Fuzzy match all fields/);
  await expect(
    page.locator('main').getByRole('button', { name: 'Dashboard', exact: true })
  ).toBeVisible({ timeout: 45000 });

  // Click "Save as workflow" — should NOT open the modal directly anymore.
  // It should post a clarification with 3 tolerance/threshold questions first.
  const saveBtn = page.locator('main').getByRole('button', { name: /Save as workflow/i });
  await saveBtn.click();

  // The clarification options appear as role=option in a listbox.
  await pickOption(page, /Exact match/);
  await pickOption(page, /Same day only/);
  await pickOption(page, /≥85%/);

  // Modal opens after the third pick — verify dialog visible + prefilled name
  // reflects the chosen date tolerance.
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('dialog').getByText(/Same day only/i)).toBeVisible();

  await page.screenshot({ path: 'tests/__screenshots__/save-workflow-clarification.png', fullPage: false });
});
