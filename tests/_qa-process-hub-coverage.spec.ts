import { test, expect } from './_helpers';

/**
 * The Process Hub cards and the Platform Usage Process Hub tile must report the
 * same coverage. They didn't: the tile read the stale `coverage` field on the
 * process record (P2P 72%, R2R 85%) while the Hub computes it (67%, 50%).
 */
test('Process Hub coverage matches Platform Usage', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/');
  await page.waitForTimeout(700);

  const nav = async (label: string) => {
    await page.getByRole('button', { name: new RegExp(`^${label}`, 'i') }).first().click();
    await page.waitForTimeout(3000);
  };
  const text = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ');

  await nav('Process Hub');
  const hub = await text();
  // Cards read: "<name> 67 % COVERAGE 9 risks · 24 controls · 5 RACMs"
  const hubCoverage: Record<string, string> = {};
  for (const name of ['Procure to Pay', 'Order to Cash', 'Record to Report']) {
    const m = hub.match(new RegExp(`${name} (\\d+) ?% COVERAGE`, 'i'));
    hubCoverage[name] = m ? m[1] : '(not found)';
  }
  console.log('\n=== PROCESS HUB CARDS ===\n' + JSON.stringify(hubCoverage, null, 2));

  await nav('Platform Usage');
  await page.getByRole('button', { name: /Process Hub — open details/i }).first().click();
  await page.waitForTimeout(1500);
  const modal = await text();
  console.log('\n=== USAGE PROCESS HUB TILE ===\n' + modal.slice(modal.indexOf('Business processes') - 40, modal.indexOf('Business processes') + 520));

  for (const [name, cov] of Object.entries(hubCoverage)) {
    expect(cov, `${name}: could not read the Hub's own coverage`).not.toBe('(not found)');
    expect(modal, `${name}: usage must show the Hub's ${cov}% coverage`).toContain(`${cov}% covered`);
  }
});
