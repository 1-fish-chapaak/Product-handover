import { test, expect } from './_helpers';

/**
 * Platform Usage reports on the other modules, so its headline numbers have to
 * be the numbers those modules show. This reads both in the same session and
 * fails on any disagreement — the drift this page had before (25 controls vs a
 * library of 14, 29 sources vs a hub of 20) is exactly what it catches.
 */

const pick = (s: string, re: RegExp) => {
  const m = s.match(re);
  return m ? m[1].replace(/,/g, '') : '(not found)';
};

test('usage tiles agree with the modules they report on', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(700);

  // KPI tiles count up (KpiCountUp: 1400ms, index-staggered), so a read taken
  // too early catches a number mid-animation — that's how "32" and "31" showed
  // up for a tile whose settled value is 33. Wait for the counters to land.
  const nav = async (label: string) => {
    await page.getByRole('button', { name: new RegExp(`^${label}`, 'i') }).first().click();
    await page.waitForTimeout(3200);
  };
  /** Rendered text, whitespace-collapsed so labels and values sit side by side. */
  const text = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();

  // ── What each module says about itself
  await nav('Engagements');
  const engT = await text();
  const modEngagements = pick(engT, /TOTAL ENGAGEMENTS (\d+)/i);
  const modOpenFindings = pick(engT, /OPEN FINDINGS (\d+)/i);

  await nav('Control Library');
  const modControls = pick(await text(), /(\d+) controls /i);

  await nav('Risk Register');
  const modUnmapped = pick(await text(), /(\d+) risks? (?:are|is) not yet mapped/i);

  await nav('Knowledge Hub');
  const khT = await text();
  const modSources = pick(khT, /All (\d+)/i);
  const modFolders = pick(khT, /Folders (\d+)/i);

  // ── What Platform Usage claims about them
  await nav('Platform Usage');
  await page.waitForTimeout(1200);
  const usage = await text();
  const rows: [string, string, string][] = [
    ['Engagements', modEngagements, pick(usage, /(\d+) Engagements /i)],
    ['Open findings', modOpenFindings, pick(usage, /(\d+) Open findings/i)],
    ['Controls in library', modControls, pick(usage, /(\d+) Controls in the library/i)],
    ['Risks without a control', modUnmapped, pick(usage, /(\d+) Risks without a control/i)],
    ['Sources connected', modSources, pick(usage, /(\d+) Sources connected/i)],
    ['Folders indexed', modFolders, pick(usage, /(\d+) Folders indexed/i)],
    // The sections the page never used to cover at all.
    ['Engagements planned', modEngagements, pick(usage, /(\d+) Engagements planned/i)],
  ];

  console.log('\n=== MODULE vs PLATFORM USAGE ===');
  for (const [label, mod, use] of rows) {
    console.log(`${mod === use ? 'OK  ' : 'DIFF'}  ${label.padEnd(24)} module=${mod.padEnd(6)} usage=${use}`);
  }

  for (const [label, mod, use] of rows) {
    expect(mod, `${label}: could not read the module's own number`).not.toBe('(not found)');
    expect(use, `${label}: Platform Usage disagrees with the module`).toBe(mod);
  }
});
