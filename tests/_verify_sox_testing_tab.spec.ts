import { test, expect } from './_helpers';

const SHOT_DIR = '/private/tmp/claude-501/-Users-aasthajain-Desktop-Product-Irame-Product-handover/f35a67c3-b996-41ba-98cf-ba36cd071334/scratchpad/sox-testing-shots';

/**
 * SOX Testing tab — the scoping-first flow prototype on the Engagement Library.
 * Landing = programme list. Card click opens the classic SOX workspace (tabs +
 * control testing); "Scoping summary" opens the 800×800 modal; "+ New
 * Engagement" runs the 5-step wizard (classic Type & basics first; the Scoping
 * step holds the bulk RACM / trial-balance uploads, the mapped entities with
 * their extracted processes, the caption→process table and the beyond-TB
 * workstreams) in the same modal and registers a real runtime engagement.
 */
test('SOX Testing tab walks the scoping-first journey end to end', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Engagements', exact: true }).click();
  await page.waitForTimeout(800);

  // Engagement Library keeps its classic tabs — SOX Testing moved to the sidebar
  await expect(page.getByRole('tab', { name: /All Engagements/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Approval Flow' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'SOX Testing' })).toHaveCount(0);
  await page.getByRole('navigation').getByRole('button', { name: 'SOX Testing', exact: true }).click();
  await page.waitForTimeout(800);

  // Landing: its own page — header chrome + programme list only; the pipeline
  // explainer is parked, and the scoping-window note lives inside the modal
  await expect(page.getByRole('heading', { name: 'SOX Testing' })).toBeVisible();
  await expect(page.getByText('How a programme gets its scope')).toHaveCount(0);
  await expect(page.getByText(/Scoping window open since/)).toHaveCount(0);
  await expect(page.getByText('FY26 ICFR — Airline P2P & O2C')).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/01-landing.png`, fullPage: true });

  // Card actions are parked — no Roll forward / Scoping summary buttons on
  // cards; rolling forward lives on the workspace Configuration tab
  await expect(page.getByRole('button', { name: 'Scoping summary', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Roll forward', exact: true })).toHaveCount(0);

  // Card click opens the classic SOX workspace — tabs, control testing, the lot.
  // Opened from the SOX Testing section, the back line points back to it.
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);
  await expect(page.getByRole('button', { name: 'Back to SOX Testing' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'FY26 ICFR — Airline P2P & O2C' })).toBeVisible();
  // The RACM tab mirrors the scoping summary: the same 7 derived processes,
  // including the ones the classic catalogue doesn't have
  await page.getByText('RACM', { exact: true }).first().click();
  await page.waitForTimeout(800);
  await expect(page.getByText('Fixed Assets').first()).toBeVisible();
  await expect(page.getByText('Payroll (Hire to Retire)').first()).toBeVisible();
  await expect(page.getByText('Procure to Pay').first()).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/02b-fy26-workspace.png`, fullPage: true });
  await page.getByRole('button', { name: 'Back to SOX Testing' }).click();
  await page.waitForTimeout(800);
  await expect(page.getByRole('heading', { name: 'SOX Testing' })).toBeVisible();

  // "+ New Engagement" (tab CTA — the later of the two same-named buttons)
  await page.getByRole('button', { name: 'New Engagement' }).last().click();
  await page.waitForTimeout(400);
  await expect(page.getByRole('dialog')).toBeVisible();
  // the creation flow is a full-height 560px side sheet (the centred 1000x800
  // modal is now only used for the scoping summary)
  const wizBox = await page.getByRole('dialog').boundingBox();
  expect(Math.round(wizBox!.width)).toBe(560);

  // Step 1 — the classic "Type & basics" screen, as-is (SOX preselected)
  await expect(page.getByText('Type & basics').first()).toBeVisible();
  await expect(page.getByRole('dialog').getByText('SOX / ICFR', { exact: true })).toBeVisible();
  await expect(page.getByText('Process audit aligned to RACM + SOPs')).toBeVisible();
  await page.getByPlaceholder('e.g. P2P — SOX Q3 Testing').fill('FY27 ICFR — Airline Group');
  // No start/end dates and no "as of" field — just the audit period, which
  // is always on the financial-year basis (FY 2026-27). The year-type picker
  // is parked (YEAR_TYPE_PICKER), so neither basis button renders.
  await expect(page.getByRole('button', { name: /Financial year/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Calendar year/ })).toHaveCount(0);
  await expect(page.getByRole('dialog').getByText('Audit period')).toBeVisible();
  await expect(page.getByText(/testing runs Apr 2026 – Mar 2027/)).toBeVisible();
  await expect(page.getByText(/Opinion/)).toHaveCount(0);
  await expect(page.getByText('Select date')).toHaveCount(0);
  await page.screenshot({ path: `${SHOT_DIR}/03a-wizard-basics.png`, fullPage: true });
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 2 — Scoping: uploads → entities (with extracted processes) →
  // caption→process mapping, all on one step
  await expect(page.getByText(/Upload the RACM and trial balances/)).toBeVisible();
  await expect(page.getByText(/No entities yet/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  // RACM upload extracts entities + processes
  await page.getByRole('button', { name: 'Upload RACM' }).click();
  await page.waitForTimeout(1100);
  await expect(page.getByText(/\d+ processes extracted/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove SkyCargo Logistics Pvt Ltd' })).toBeVisible();
  // Each mapped entity row carries its extracted processes
  await expect(page.getByTitle(/Order to Cash/).first()).toBeVisible();
  // The absorbed mapping surfaces: caption→process table (the beyond-TB
  // workstream card is parked behind BEYOND_TB_CARD — its ids still store)
  await expect(page.getByText('Map accounts to processes')).toBeVisible();
  await expect(page.getByText('Beyond the trial balance')).toHaveCount(0);
  // Trial balances still gate the step — their own button stays until they're
  // in; only when BOTH docs are uploaded do the buttons become "Upload more"
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await expect(page.getByText(/Upload the trial balances to continue/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upload more' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Upload trial balances' }).click();
  await page.waitForTimeout(1100);
  await expect(page.getByRole('button', { name: 'Upload more' })).toBeVisible();
  await expect(page.getByText('airline-group-tb-fy27.xlsx')).toBeVisible();
  await expect(page.getByText(/mapped from the uploads/)).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/03-wizard-entities.png`, fullPage: true });
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 3 — materiality (basis → computed ladder); qualitative stays parked
  await expect(page.getByText(/thresholds cascade from it/)).toBeVisible();
  await expect(page.getByText('Computed thresholds')).toBeVisible();
  await expect(page.getByText('₹ 21 Cr').first()).toBeVisible();
  await expect(page.getByText('Qualitative')).toHaveCount(0);
  await page.screenshot({ path: `${SHOT_DIR}/04-wizard-materiality.png`, fullPage: true });
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 4 — review & create
  await expect(page.getByText(/Confirm the derivation/)).toBeVisible();
  await expect(page.getByText('RACMs to be generated — one per in-scope process')).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/08-wizard-review.png`, fullPage: true });
  await page.getByRole('button', { name: 'Create FY27 programme' }).click();
  await page.waitForTimeout(700);

  // Creation closes the modal — the new programme lands on the listing
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(/FY27 programme created — 7 RACMs derived/)).toBeVisible();
  await expect(page.getByText('as of 31 Mar 2027')).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/09-fy27-created.png`, fullPage: true });

  // Landing lists both; the new card opens its own classic SOX workspace
  await expect(page.getByText('FY26 ICFR — Airline P2P & O2C')).toBeVisible();
  await page.getByText('FY27 ICFR — Airline Group').first().click();
  await page.waitForTimeout(1000);
  await expect(page.getByRole('heading', { name: 'FY27 ICFR — Airline Group' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to SOX Testing' })).toBeVisible();
  // Fresh workspace seeds one RACM per scoping-derived process too
  await expect(page.getByText('Fixed Assets').first()).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/10-fy27-workspace.png`, fullPage: true });
  await page.getByRole('button', { name: 'Back to SOX Testing' }).click();
  await page.waitForTimeout(800);

  // The classic Engagement Library is untouched — its list still has the seed
  await page.getByRole('navigation').getByRole('button', { name: 'Engagements', exact: true }).click();
  await page.waitForTimeout(800);
  await expect(page.getByRole('tab', { name: /All Engagements/ })).toBeVisible();
  await expect(page.getByText('FY26 ICFR — Airline P2P & O2C').first()).toBeVisible();

  // ── Roll forward: parked on cards — lives on the workspace Configuration tab ──
  await page.getByRole('navigation').getByRole('button', { name: 'SOX Testing', exact: true }).click();
  await page.waitForTimeout(800);
  await expect(page.getByRole('button', { name: 'Roll forward', exact: true })).toHaveCount(0);
  await page.getByText('FY27 ICFR — Airline Group').first().click();
  await page.waitForTimeout(1000);
  await page.getByText('Configuration', { exact: true }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Roll forward' }).click();
  await page.waitForTimeout(500);

  // Step 1 — cycle is pure recurrence: FY28, as-of auto, everything prefilled
  await expect(page.getByText('Roll forward from FY27')).toBeVisible();
  await expect(page.getByText('opinion as of 31 Mar 2028')).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/11-roll-cycle.png`, fullPage: true });
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 2 — materiality re-set + fresh TBs → year-over-year movement
  await expect(page.getByText('Refresh the numbers')).toBeVisible();
  const rollUploads = page.getByRole('button', { name: /Upload FY28 trial balance/ });
  while (await rollUploads.count() > 0) {
    await rollUploads.first().click();
    await page.waitForTimeout(950);
  }
  await expect(page.getByText('Year-over-year movement')).toBeVisible();
  await expect(page.getByText('Newly in scope').first()).toBeVisible();
  await expect(page.getByText('Fell below — review')).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/12-roll-movement.png`, fullPage: true });
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 3 — only deltas need decisions; RACMs carry with design
  await expect(page.getByText('Review the changes — everything else carries')).toBeVisible();
  await expect(page.getByText('Provisions').first()).toBeVisible();
  await expect(page.getByText(/Marketing & promotion expense/).first()).toBeVisible();
  await expect(page.getByText('Qualitative judgements — carried (2)')).toBeVisible();
  await expect(page.getByText('ELC — carried')).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/13-roll-review.png`, fullPage: true });
  await page.getByRole('button', { name: 'Create FY28 programme' }).click();
  await page.waitForTimeout(700);

  // Creation closes the modal — back on Configuration with the toast
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(/programme rolled forward from FY27/)).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/14-fy28-rolled.png`, fullPage: true });

  // Landing: the FY28 card exists; cards still carry no actions
  await page.getByRole('button', { name: 'Back to SOX Testing' }).click();
  await page.waitForTimeout(800);
  await expect(page.getByText('FY28 ICFR — Airline Group')).toBeVisible();
  await expect(page.getByText('as of 31 Mar 2028')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Roll forward', exact: true })).toHaveCount(0);
});
