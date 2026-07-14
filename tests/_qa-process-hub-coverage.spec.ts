import { test, expect } from './_helpers';

/**
 * The Process Hub and the Platform Usage Process Hub tile must report the same
 * process. They didn't, in four separate ways — every one of them the same bug:
 * the tile read a summary field carried on the process record instead of
 * counting the records the Hub itself renders.
 *
 *   field        claimed          the Hub actually shows
 *   coverage     P2P 72%, R2R 85%    67% and 50%
 *   risks        P2P 9,   R2R 11     6 and 2
 *   controls     P2P 24,  R2R 31     6 and 1
 *   RACMs        P2P 5,   R2R 2      4 and 1
 *
 * So this asserts all four, not just coverage: the card and the tile have to
 * agree on every number a reader could put side by side.
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
  // Cards read: "<name> 67 % COVERAGE 6 risks · 6 controls · 4 RACMs"
  const card: Record<string, { cov: string; risks: string; controls: string; racms: string }> = {};
  for (const name of ['Procure to Pay', 'Order to Cash', 'Record to Report']) {
    const m = hub.match(
      new RegExp(`${name} (\\d+) ?% COVERAGE (\\d+) risks? · (\\d+) controls? · (\\d+) RACMs?`, 'i'),
    );
    card[name] = m
      ? { cov: m[1], risks: m[2], controls: m[3], racms: m[4] }
      : { cov: '(not found)', risks: '', controls: '', racms: '' };
  }
  console.log('\n=== PROCESS HUB CARDS ===\n' + JSON.stringify(card, null, 2));

  await nav('Platform Usage');
  // The section tiles live on the Sections tab — the page opens on Overview.
  await page.getByRole('button', { name: 'Sections', exact: true }).first().click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /Process Hub — open details/i }).first().click();
  await page.waitForTimeout(1500);
  const modal = await text();
  console.log('\n=== USAGE PROCESS HUB TILE ===\n' + modal.slice(modal.indexOf('Business processes') - 40, modal.indexOf('Business processes') + 520));

  for (const [name, c] of Object.entries(card)) {
    expect(c.cov, `${name}: could not read the Hub's own card`).not.toBe('(not found)');
    // Coverage, on the process-map row and the bar note.
    expect(modal, `${name}: usage must show the Hub's ${c.cov}% coverage`).toContain(`${c.cov}% covered`);
    // The process-map row: "7 SOPs · 6 risks · 4 RACMs" and "6 controls".
    const risk = `${c.risks} risk${c.risks === '1' ? '' : 's'}`;
    const racm = `${c.racms} RACM${c.racms === '1' ? '' : 's'}`;
    const ctrl = `${c.controls} control${c.controls === '1' ? '' : 's'}`;
    expect(modal, `${name}: usage must show the Hub's ${risk}`).toContain(risk);
    expect(modal, `${name}: usage must show the Hub's ${racm}`).toContain(racm);
    expect(modal, `${name}: usage must show the Hub's ${ctrl}`).toContain(ctrl);
  }
});
