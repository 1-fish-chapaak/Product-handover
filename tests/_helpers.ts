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

export { expect, type Page };
