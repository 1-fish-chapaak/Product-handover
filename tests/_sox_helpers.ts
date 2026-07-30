import { expect } from './_helpers';

type Page = import('@playwright/test').Page;

/**
 * The one door to the SOX scoping journey since the SOX Testing sidebar entry
 * was parked: Engagements → Create Engagement → pick SOX / ICFR → Next hands
 * off to the scoping side sheet (Type step dropped). Walks Basics → Scoping
 * (bulk file upload via the native picker — three files auto-classify to the
 * RACM / TB / GL requirements) → Review → Create. Ends back on the library
 * with the new engagement at the top.
 */
export async function createSoxEngagement(page: Page, name: string, opts?: { skipScoping?: boolean }) {
  await page.getByRole('navigation').getByRole('button', { name: 'Engagements', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'New Engagement' }).first().click();
  await page.waitForTimeout(500);

  const typeSheet = page.getByRole('dialog', { name: 'Create Engagement' });
  await expect(typeSheet).toBeVisible();
  await typeSheet.getByText('SOX / ICFR', { exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.waitForTimeout(600);

  // scoping sheet, opened on Basics (Type answered on the classic sheet)
  await page.getByPlaceholder('e.g. P2P — SOX Q3 Testing').fill(name);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForTimeout(400);

  if (opts?.skipScoping) {
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.waitForTimeout(300);
  } else {
    await page.locator('input[aria-label="Upload recommended files"]').setInputFiles([
      { name: 'airline-group-racm.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('racm') },
      { name: 'airline-group-tb-fy27.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('tb') },
      { name: 'airline-group-gl.csv', mimeType: 'text/csv', buffer: Buffer.from('gl') },
    ]);
    await page.waitForTimeout(1500); // simulated RACM + TB parses fill the entity table
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(400);
  }

  await page.getByRole('button', { name: 'Create FY27 programme' }).click();
  await page.waitForTimeout(900);
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/** Library card click → the SOX workspace. The Engagements page opens on its
 * Overview tab; the cards live on the All Engagements tab. */
export async function openFromLibrary(page: Page, name: string) {
  await page.getByRole('tab', { name: /All Engagements/ }).click();
  await page.waitForTimeout(700);
  await page.getByText(name).first().click();
  await page.waitForTimeout(1100);
  await expect(page.getByRole('heading', { name })).toBeVisible();
}
