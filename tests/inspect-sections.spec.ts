import { test, type Page } from './_helpers';

async function clearStorage(page: Page) {
  await page.addInitScript(() => {
    try { window.localStorage.clear(); } catch {}
    try { window.sessionStorage.clear(); } catch {}
  });
}

async function gotoBPDetail(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Process Hub' }).first().click();
  // Wait for hub to render.
  await page.getByText('Procure to Pay').first().waitFor({ state: 'visible' });
  await page.getByText('Procure to Pay').first().click();
  // BP detail: wait for breadcrumb-back "Process Hub" to render in the detail header.
  await page.waitForTimeout(800);
}

test.beforeEach(async ({ page }) => {
  await clearStorage(page);
});

test('inspect — capture each drilled section header area', async ({ page }) => {
  await gotoBPDetail(page);

  // Index page first.
  await page.screenshot({ path: 'test-results/section-00-index.png', fullPage: true });

  // SOP
  await page.getByText(/^SOPs?$/).first().click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'test-results/section-01-sop.png', fullPage: true });

  // RACM
  await page.getByRole('button', { name: /Switch to RACM/i }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'test-results/section-02-racm.png', fullPage: true });

  // Risks
  await page.getByRole('button', { name: /Switch to Risks/i }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'test-results/section-03-risks.png', fullPage: true });

  // Controls
  await page.getByRole('button', { name: /Switch to Controls/i }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'test-results/section-04-controls.png', fullPage: true });

  // Workflows
  await page.getByRole('button', { name: /Switch to Workflows/i }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'test-results/section-05-workflows.png', fullPage: true });
});
