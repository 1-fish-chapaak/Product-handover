import { test, expect } from './_helpers';

// NOTE: a parallel session is renaming this tab ("SOX audit" → "SOX testing").
// Matched loosely until that lands so the suite is not red on someone else's
// half-finished rename; tighten to the winning label once it settles.
import { openFromLibrary } from './_sox_helpers';

const SHOT_DIR = '/private/tmp/claude-501/-Users-aasthajain-Desktop-Product-Irame-Product-handover/e4611527-b2d2-4848-8aa2-dda858a9a11e/scratchpad/sox-testing-shots';

/**
 * The SOX creation journey since the SOX Testing sidebar entry was parked:
 * Engagements is the one door. Create Engagement → picking SOX / ICFR hands
 * off to the scoping side sheet (Type dropped, Back returns to the type
 * picker).
 *
 * The scoping sheet is THREE steps now, not four: `SCOPING_STEP = false` in
 * ScopingWizard.tsx parked the documents step, so Basics hands straight to
 * Review. What the parked step used to collect moved or went away —
 *   · the group & entity table moved UP onto Basics (and gates it),
 *   · the RACM / TB / GL "Recommended files" card is gone; the trial balance
 *     and general ledger are attached later, on the audit that tests them,
 *   · "Skip for now" went with the step it lived on.
 * So every engagement this journey creates arrives without an attached RACM,
 * and Review says so out loud before you press Create.
 */
test('SOX creation walks Engagements → handoff → basics → review → workspace', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');

  // The sidebar has no SOX Testing entry any more — Engagements is the door
  await expect(page.getByRole('navigation').getByRole('button', { name: 'SOX Testing', exact: true })).toHaveCount(0);
  await page.getByRole('navigation').getByRole('button', { name: 'Engagements', exact: true }).click();
  await page.waitForTimeout(800);

  // Create Engagement opens on the Type-only step (5-step classic wizard)
  await page.getByRole('button', { name: 'New Engagement' }).first().click();
  await page.waitForTimeout(500);
  const typeSheet = page.getByRole('dialog', { name: 'Create Engagement' });
  await expect(typeSheet.getByText('Step 1 of 5 — Type')).toBeVisible();
  await expect(typeSheet.getByPlaceholder('e.g. P2P — SOX Q3 Testing')).toHaveCount(0);
  await page.screenshot({ path: `${SHOT_DIR}/01-type-step.png` });

  // Picking SOX + Next hands off to the scoping sheet at Basics — step 2 of 3,
  // because the documents step between Basics and Review is parked.
  await typeSheet.getByText('SOX / ICFR', { exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.waitForTimeout(600);
  const sheet = page.getByRole('dialog', { name: 'New engagement' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('Step 2 of 3 — Basics')).toBeVisible();
  // identity only — the audit period is parked, no helper sentences
  await expect(sheet.getByText('Audit period')).toHaveCount(0);
  await expect(sheet.getByText(/annual cycle/)).toHaveCount(0);

  // The name arrives PRE-FILLED — suggested from the seeded group and the
  // cycle, and it says so until the user types over it.
  const nameField = sheet.getByPlaceholder('e.g. P2P — SOX Q3 Testing');
  await expect(nameField).toBeVisible();
  await expect(nameField).not.toHaveValue('');
  await expect(sheet.getByText(/Suggested from the group/)).toBeVisible();

  // The pinned header must not paint over the first field. It used to: -mt-6
  // cancelled the modal's p-6, but sticky clamps the MARGIN box, so `top-0`
  // pushed the header 24px below the space layout reserved for it and swallowed
  // the "Engagement name" label whole. In the DOM, invisible on screen. The fix
  // was `-top-6` — cancel the margin in the clamp too.
  //
  // Found by what it IS (the sticky element carrying the sheet's title) rather
  // than by its offset classes, so the hit test keeps testing the overlap
  // instead of silently passing on a null when the offset is retuned again.
  const overlap = await page.evaluate(() => {
    const header = Array.from(document.querySelectorAll('div')).find(d =>
      getComputedStyle(d).position === 'sticky'
      && d.querySelector('h2')?.textContent?.trim() === 'Create Engagement') as HTMLElement | undefined;
    const label = Array.from(document.querySelectorAll('label'))
      .find(l => /Engagement name/i.test(l.textContent || '')) as HTMLElement | undefined;
    if (!header || !label) return { found: false } as const;
    const hb = header.getBoundingClientRect();
    const lb = label.getBoundingClientRect();
    // topmost painted element at the label's centre must be the label itself
    const hit = document.elementsFromPoint(lb.left + 40, lb.top + lb.height / 2)[0];
    return { found: true, headerBottom: hb.bottom, labelTop: lb.top, topTag: hit?.tagName } as const;
  });
  expect(overlap.found).toBe(true);
  expect(overlap.topTag).toBe('LABEL');
  expect(overlap.headerBottom!).toBeLessThanOrEqual(overlap.labelTop!);

  await page.screenshot({ path: `${SHOT_DIR}/02-basics.png` });

  // Back goes one step back — the classic type picker, SOX still selected
  await page.getByRole('button', { name: 'Back' }).click();
  await page.waitForTimeout(500);
  await expect(typeSheet.getByText('Step 1 of 5 — Type')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.waitForTimeout(600);

  // Basics gates on identity AND on the entities question. Name and code are
  // pre-filled, so the only thing still missing is who is in scope: an empty
  // entity table is not an answer, and Continue stays dead until one is given.
  await expect(sheet.getByText(/No entities yet/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await sheet.getByPlaceholder('e.g. P2P — SOX Q3 Testing').fill('FY27 ICFR — Airline Group');
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await page.getByRole('checkbox', { name: /no separate entities/i }).click();
  await page.waitForTimeout(200);
  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();
  await page.screenshot({ path: `${SHOT_DIR}/03-basics-answered.png`, fullPage: true });
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForTimeout(400);

  // Review — reached straight from Basics; no documents step in between
  await expect(sheet.getByText('Step 3 of 3 — Review')).toBeVisible();
  await expect(sheet.getByText(/Confirm who is in scope, and what came in with them/)).toBeVisible();
  // No RACM came in with it, and Review says so rather than letting it surprise
  // the user in the workspace
  await expect(sheet.getByText(/The engagement is created without a RACM/)).toBeVisible();
  await expect(sheet.getByText('Company in scope', { exact: true })).toBeVisible();
  await expect(sheet.getByText('RACMs — added from the RACM tab once the engagement exists')).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/04-review.png`, fullPage: true });
  // FY is derived from today's date at creation, so don't hard-code the year
  await page.getByRole('button', { name: /^Create FY\d+ programme$/ }).click();
  await page.waitForTimeout(900);

  // Creation closes the sheet; the engagement lands in the library. The toast
  // points at the RACM tab — the trial balances it used to name are attached on
  // the audit now, not here.
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(/FY\d+ programme created — add the RACM from the RACM tab/)).toBeVisible();
  await openFromLibrary(page, 'FY27 ICFR — Airline Group');
  await expect(page.getByRole('button', { name: 'Back to Engagements' })).toBeVisible();

  // Workspace: the four engagement tabs, and Configuration is not one of them —
  // period, scope, TB / GL and materiality are set per audit cycle now.
  const main = page.getByRole('main');
  for (const label of ['Overview', 'RACM', 'Control Library']) {
    await expect(main.getByRole('button', { name: label, exact: true }).first()).toBeVisible();
  }
  await expect(main.getByRole('button', { name: 'Configuration', exact: true })).toHaveCount(0);

  // NO RACM (user ask). Creation never asks for a matrix, so it must not invent
  // two off the trial-balance captions — the tab opens empty and Create RACM is
  // the way in.
  await main.getByRole('button', { name: 'RACM', exact: true }).first().click();
  await page.waitForTimeout(800);
  await expect(page.getByText('Order to Cash — RACM')).toHaveCount(0);
  await expect(page.getByText('Procure to Pay — RACM')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Create RACM/ }).first()).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/05-workspace-racm.png`, fullPage: true });
});

/**
 * The Basics gate, close up — the trap every caller of this journey hits.
 *
 * This test used to walk the "Skip for now" escape hatch on the documents step.
 * That button lived on the step `SCOPING_STEP = false` parked, so it is gone,
 * and with it the "empty workspace" it used to produce: the programme still
 * derives its RACMs from the trial-balance captions, so the workspace is never
 * empty. What survived of the original intent is the honesty — the journey says
 * plainly that no RACM came in with the engagement — and that is what this now
 * pins, together with the gate that made the old test time out on a disabled
 * Continue.
 */
test('Basics will not continue until the entities question is answered', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Engagements', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'New Engagement' }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('dialog', { name: 'Create Engagement' }).getByText('SOX / ICFR', { exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.waitForTimeout(600);

  const sheet = page.getByRole('dialog', { name: 'New engagement' });
  const cont = page.getByRole('button', { name: 'Continue' });

  // Identity is already satisfied — the name and code arrive pre-filled — so a
  // disabled Continue here is the entity table talking, nothing else.
  await sheet.getByPlaceholder('e.g. P2P — SOX Q3 Testing').fill('FY27 skip check');
  await expect(cont).toBeDisabled();

  // A row with no name is not an answer either: adding one keeps Continue dead
  // until the company on it is named.
  await sheet.getByRole('button', { name: 'Add entity', exact: true }).click();
  await page.waitForTimeout(200);
  await expect(cont).toBeDisabled();
  await sheet.getByLabel('Entity 1 name').fill('SkyCargo Logistics Pvt Ltd');
  await page.waitForTimeout(200);
  await expect(cont).toBeEnabled();

  // …and so is the single-company answer. Ticking it replaces the typed rows
  // with the company itself, which is why the table collapses to one row.
  await page.getByRole('checkbox', { name: /no separate entities/i }).click();
  await page.waitForTimeout(200);
  await expect(sheet.getByText('Entity in scope', { exact: true })).toBeVisible();
  await expect(cont).toBeEnabled();
  await page.screenshot({ path: `${SHOT_DIR}/06-basics-gate.png`, fullPage: true });
  await cont.click();
  await page.waitForTimeout(400);

  // Review is the next step — "Skip for now" is parked with the step it lived on
  await expect(sheet.getByText('Step 3 of 3 — Review')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skip for now' })).toHaveCount(0);
  await expect(sheet.getByText(/The engagement is created without a RACM/)).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/07-review-no-racm.png` });
  await page.getByRole('button', { name: /^Create FY\d+ programme$/ }).click();
  await page.waitForTimeout(900);
  await expect(page.getByText(/FY\d+ programme created — add the RACM from the RACM tab/)).toBeVisible();
});
