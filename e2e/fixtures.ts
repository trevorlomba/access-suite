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

export const test = base;
export { expect };
