import { test, expect, type Page } from '@playwright/test';
import { enterWorkspace } from './_helpers';

// Verifies the "Link Workflow to Control" modal's "Create Workflow" button opens
// the AI workflow builder (chat view) in a NEW TAB, deep-linked so the hero
// composer's Query/Workflow toggle starts on Workflow.

async function openLinkWorkflowModal(page: Page) {
  await page.addInitScript(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ } });
  await page.goto('/');
  await enterWorkspace(page);
  await page.getByRole('button', { name: 'Process Hub' }).first().click();
  await page.getByText('Procure to Pay').first().click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Switch to Controls' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Link workflow' }).first().click();
}

test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 1100 }); });

test('Create Workflow opens the chat builder in a new tab with Workflow pre-selected', async ({ page, context }) => {
  await openLinkWorkflowModal(page);
  const dialog = page.getByRole('dialog', { name: 'Link Workflow to Control' });
  const createBtn = dialog.getByRole('button', { name: 'Create Workflow' });
  await expect(createBtn).toBeVisible();

  // Clicking opens a new tab; capture it.
  const [newPage] = await Promise.all([
    context.waitForEvent('page'),
    createBtn.click(),
  ]);
  await newPage.waitForLoadState('domcontentloaded');

  // New tab deep-links into the chat builder in workflow-compose mode.
  expect(newPage.url()).toContain('view=chat');
  expect(newPage.url()).toContain('compose=workflow');

  await enterWorkspace(newPage); // dismiss the login gate if the new tab shows it
  await newPage.waitForTimeout(400);

  // Hero composer's Workflow toggle is selected by default; Chat is not.
  await expect(newPage.getByRole('radio', { name: 'Workflow' })).toBeChecked();
  await expect(newPage.getByRole('radio', { name: 'Chat' })).not.toBeChecked();
  await newPage.screenshot({ path: 'test-results/link-wf-new-tab.png', fullPage: true });

  // Original modal closed in the first tab.
  await expect(dialog).toBeHidden();
});
