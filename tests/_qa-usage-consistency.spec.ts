import { test, expect, usageTab } from './_helpers';

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
  //
  // Read the section deep-dive tiles, not the whole page. Scraping body text
  // made this order-dependent: "Workflow Library 17 / Engagements 41" in the
  // Workflow runs card also matches /(\d+) Engagements/, so whichever card the
  // layout happened to put first decided the answer. The tiles are where the
  // page states these numbers, so read them there.
  await nav('Platform Usage');
  await usageTab(page, 'Areas');
  const usage = (await page.locator('button[aria-label$="open details"]').allInnerTexts())
    .join(' ').replace(/\s+/g, ' ').trim();
  // The tile states each figure as "<label> <value>": the stat rows are a
  // definition list, label left and value right. Matching "<value> <label>"
  // (which the stacked number-above-label tile used to read as) silently picks
  // up the PREVIOUS row's value, so "Controls in scope 251 Open findings 33"
  // answered 251 for open findings. Anchor on the label, then read forward.
  const rows: [string, string, string][] = [
    ['Engagements', modEngagements, pick(usage, /Engagements ([\d,]+)/i)],
    ['Open findings', modOpenFindings, pick(usage, /Open findings ([\d,]+)/i)],
    ['Controls in library', modControls, pick(usage, /Controls in the library ([\d,]+)/i)],
    ['Risks without a control', modUnmapped, pick(usage, /Risks without a control ([\d,]+)/i)],
    ['Sources connected', modSources, pick(usage, /Sources connected ([\d,]+)/i)],
    ['Folders indexed', modFolders, pick(usage, /Folders indexed ([\d,]+)/i)],
    // The sections the page never used to cover at all.
    ['Engagements planned', modEngagements, pick(usage, /Engagements planned ([\d,]+)/i)],
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
