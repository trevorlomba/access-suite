import { test as base, expect, type Page } from '@playwright/test';

type SettingsPatch = Record<string, unknown>;

/**
 * Stubs speech synthesis (so tests can assert what was spoken) and optionally
 * seeds settings in localStorage before the app boots.
 */
export async function prepare(page: Page, settings: SettingsPatch = {}) {
  await page.addInitScript((seed) => {
    const w = window as unknown as { __spoken: string[] };
    w.__spoken = [];
    if (!('SpeechSynthesisUtterance' in window)) {
      (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance = class {
        constructor(public text: string) {}
      };
    }
    const fake = {
      speak: (u: { text: string }) => w.__spoken.push(u.text),
      cancel: () => {},
      getVoices: () => [],
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
    if (Object.keys(seed).length) {
      localStorage.setItem('access-suite:settings', JSON.stringify(seed));
    }
  }, settings);
}

export const spoken = (page: Page) => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);

export const messageWords = (page: Page) =>
  page.getByRole('group', { name: /message words/i }).getByRole('button').allTextContents();

/** Wait for fonts to load and the boards to measure themselves and re-render. */
export async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame);
  });
}

/** Open a word category, paging through "More categories" where the tabs don't all fit (phones). */
export async function openTab(page: Page, name: string) {
  await settle(page);
  const tab = page.getByRole('group', { name: 'Word categories' }).getByRole('button', { name, exact: true });
  for (let i = 0; i < 12 && !(await tab.isVisible()); i++) {
    await page.getByRole('button', { name: /^More categories/ }).click();
    await settle(page);
  }
  await tab.click();
}

/** Press Tab (or Shift+Tab) until the focused element has the given accessible text. */
export async function tabTo(page: Page, text: string, reverse = false, max = 80) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press(reverse ? 'Shift+Tab' : 'Tab');
    const current = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return (el?.getAttribute('aria-label') ?? el?.textContent ?? '').trim();
    });
    if (current === text) return;
  }
  throw new Error(`Could not Tab to "${text}"`);
}

/**
 * Every test fails if the browser refuses anything under the site's Content
 * Security Policy (Chromium reports refusals as console errors, which also
 * catches ones on pages the test has since left). A test that triggers one on
 * purpose asserts on `cspViolations` and then empties it.
 */
export const test = base.extend<{ cspViolations: string[] }>({
  cspViolations: [
    async ({ page }, use) => {
      const seen: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error' && msg.text().includes('Content Security Policy')) seen.push(msg.text());
      });
      await use(seen);
      expect(seen, 'Content Security Policy violations').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };
