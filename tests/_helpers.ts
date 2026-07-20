import { test as base, expect, type Page } from '@playwright/test';

/**
 * The app now boots to a workspace chooser (LoginView) — `App` wraps everything
 * in `<CurrentUserProvider startSignedOut>`, so a fresh browser (cleared storage)
 * lands on the login gate before any module is reachable. Specs that clear
 * storage and `goto('/')` must click through it first.
 *
 * No-op if the gate isn't shown (e.g. a persisted session already signed in, or
 * navigation that didn't reset to the login screen).
 */
export async function enterWorkspace(page: Page) {
  const enter = page.getByRole('button', { name: /Enter workspace/i });
  try {
    await enter.waitFor({ state: 'visible', timeout: 4000 });
  } catch {
    return; // not on the login gate
  }
  await enter.click();
  await page.waitForTimeout(400);
}

/**
 * Drop-in `test` for legacy / debug specs: it wraps `page.goto` so every
 * navigation auto-clicks through the login gate. The signed-in session doesn't
 * change the URL, so deep-link gotos (`/?view=dashboards`) still land on their
 * target view after entering. Switch a spec by importing `test`/`expect` from
 * this file instead of `@playwright/test` — no per-`goto` edits needed.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    const realGoto = page.goto.bind(page);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (page as any).goto = async (url: string, opts?: Parameters<Page['goto']>[1]) => {
      const resp = await realGoto(url, opts);
      await enterWorkspace(page);
      return resp;
    };
    await use(page);
  },
});

/**
 * Switch Platform Usage to one of its tabs.
 *
 * The page used to be one 5,900px scroll; it is now five tabs (Overview,
 * Adoption, Output, Sections, People) sharing one period filter. Nothing was
 * removed — a spec that used to find a card by scrolling now has to open the
 * tab it lives on first.
 */
export async function usageTab(
  page: Page,
  name: 'Overview' | 'Seats' | 'People' | 'Areas' | 'Output',
) {
  await page.getByRole('button', { name: new RegExp(`^${name}\\b`) }).first().click();
  await page.waitForTimeout(1000);
}

/**
 * Answer the query/workflow clarification card end-to-end.
 *
 * The card was redesigned from an auto-advancing role="option" listbox into a
 * stepped radiogroup: each question is a set of role="radio" (single) or
 * role="checkbox" (multi) options and you advance with an explicit Next / Done
 * button (number keys only *toggle*, they no longer advance). This helper picks
 * the first option on each step and advances until Done, driving the run.
 */
export async function answerClarification(page: Page) {
  await expect(page.getByText(/Question 1 of/)).toBeVisible({ timeout: 8000 });
  for (let guard = 0; guard < 10; guard++) {
    await page.locator('[role=radio], [role=checkbox]').first().click();
    const done = page.getByRole('button', { name: 'Done' });
    if (await done.count() > 0) { // Done renders only on the last question
      await done.click();
      break;
    }
    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(150);
  }
}

export { expect, type Page };
