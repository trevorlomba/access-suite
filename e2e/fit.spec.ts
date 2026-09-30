import type { Page } from '@playwright/test';
import { expect, openTab, prepare, settle, test } from './fixtures';

/**
 * The communication boards fit one screen: the page never scrolls, and no
 * button is ever made smaller than the user's button size to get there (the
 * board pages instead). Checked across screens, button sizes and the states
 * that add the most on screen.
 */

const SCREENS = {
  'laptop 1280×720': { width: 1280, height: 720 },
  'laptop 1366×768': { width: 1366, height: 768 },
  'tablet landscape 1180×820': { width: 1180, height: 820 },
  'tablet portrait 820×1180': { width: 820, height: 1180 },
  'small tablet 1024×600': { width: 1024, height: 600 },
  'phone 390×844': { width: 390, height: 844 },
};

/** Button sizes that must fit without scrolling on each screen. Larger ones may scroll, but still never shrink. */
const MUST_FIT: Record<keyof typeof SCREENS, number[]> = {
  'laptop 1280×720': [48, 72, 96],
  'laptop 1366×768': [48, 72, 96],
  'tablet landscape 1180×820': [48, 72, 96],
  'tablet portrait 820×1180': [48, 72, 96, 120],
  'small tablet 1024×600': [48, 72],
  'phone 390×844': [48, 72],
};
const SIZES = [48, 72, 96, 120];

/** Click a button that may be on a later page of its grid. */
async function clickPaged(page: Page, name: string, more: RegExp) {
  const button = page.getByRole('button', { name, exact: true });
  for (let i = 0; i < 8 && !(await button.isVisible()); i++) {
    await page.getByRole('button', { name: more }).click();
    await settle(page);
  }
  await button.click();
}

const partnerSays = async (page: Page, text: string) => {
  await page.getByRole('button', { name: /type what they said/i }).click();
  await page.getByRole('textbox').fill(text);
  await page.getByRole('button', { name: 'Add' }).click();
};

const STATES: { name: string; path: string; ai?: boolean; act?: (page: Page) => Promise<void> }[] = [
  { name: 'phrase board', path: 'phrase-board/', ai: true },
  {
    name: 'phrase board, long message, editing a word',
    path: 'phrase-board/',
    ai: true,
    act: async (page) => {
      // Words from the start of each grid, so they're on the first page at any button size.
      await page.getByRole('button', { name: 'I', exact: true }).click();
      for (let i = 0; i < 7; i++) await page.getByRole('button', { name: 'want', exact: true }).click();
      await page.getByRole('button', { name: /^want, word 2/ }).click();
    },
  },
  {
    name: 'phrase board, AI sentences',
    path: 'phrase-board/',
    ai: true,
    act: async (page) => {
      await page.getByRole('button', { name: 'want', exact: true }).click();
      await page.getByRole('button', { name: 'Make it a sentence' }).click();
      await clickPaged(page, 'Say it', /^More Make it a sentence/);
      await page.getByRole('group', { name: 'Suggested sentences', exact: true }).waitFor();
    },
  },
  {
    name: 'phrase board, words by letter',
    path: 'phrase-board/',
    act: async (page) => {
      await openTab(page, 'A–Z');
      await page.getByRole('button', { name: 'Words starting with b' }).click();
    },
  },
  {
    name: 'listen & reply, after they speak',
    path: 'listen-reply/',
    ai: true,
    act: (page) => partnerSays(page, 'Would you like the physical therapist to come back tomorrow afternoon?'),
  },
  {
    name: 'listen & reply, AI replies',
    path: 'listen-reply/',
    ai: true,
    act: async (page) => {
      await partnerSays(page, 'Are you warm enough?');
      await page.getByRole('button', { name: 'Make it a sentence' }).click();
      await clickPaged(page, 'Yes…', /^More Make it a sentence/);
      await page.getByRole('group', { name: 'Suggested sentences', exact: true }).waitFor();
    },
  },
];

async function measure(page: Page, target: number) {
  return page.evaluate((t) => {
    const small = [...document.querySelectorAll<HTMLElement>('.big-btn, .chip')]
      .filter((el) => el.offsetParent !== null && !el.closest('.visually-hidden'))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width < t - 0.5 || r.height < t - 0.5)
      .map(({ el, r }) => `${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim()} ${Math.round(r.width)}×${Math.round(r.height)}`);
    // Labels cut off by their button (overflow is hidden on buttons).
    const clipped = [...document.querySelectorAll<HTMLElement>('.big-btn, .chip')]
      .filter((el) => el.offsetParent !== null && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1))
      .map((el) => (el.getAttribute('aria-label') ?? el.textContent ?? '').trim());
    const root = document.documentElement;
    const board = document.querySelector<HTMLElement>('.board-area__main > .tiles--fill');
    const rows = board ? getComputedStyle(board).gridTemplateRows.split(' ').length : null;
    return { overflowY: root.scrollHeight - innerHeight, overflowX: root.scrollWidth - innerWidth, small, clipped, rows };
  }, target);
}

for (const [screen, viewport] of Object.entries(SCREENS) as [keyof typeof SCREENS, { width: number; height: number }][]) {
  for (const state of STATES) {
    test(`${state.name} on ${screen}`, async ({ browser }, info) => {
      test.skip(info.project.name !== 'desktop', 'sets its own screen sizes');
      test.setTimeout(90_000); // four button sizes per test
      for (const target of SIZES) {
        const mustFit = MUST_FIT[screen].includes(target);
        // Past the sizes that must fit, the board pages a lot; the plain states still check button sizes there.
        if (state.act && !mustFit) continue;
        const context = await browser.newContext({ viewport, baseURL: info.project.use.baseURL });
        const page = await context.newPage();
        try {
          await prepare(page, { targetSize: target, ...(state.ai ? { aiProvider: 'demo', aiModel: 'demo' } : {}) });
          await page.goto(state.path);
          await settle(page);
          await state.act?.(page);
          await settle(page);
          const m = await measure(page, target);
          expect.soft(m.small, `buttons smaller than ${target}px`).toEqual([]);
          expect.soft(m.clipped, `labels cut off at ${target}px`).toEqual([]);
          expect.soft(m.overflowX, `sideways scroll at ${target}px`).toBeLessThanOrEqual(0);
          if (mustFit) {
            expect.soft(m.overflowY, `page scrolls at ${target}px`).toBeLessThanOrEqual(0);
            // Fitting by leaving the board a single row doesn't count.
            if (m.rows !== null) expect.soft(m.rows, `board rows at ${target}px`).toBeGreaterThanOrEqual(2);
          }
        } finally {
          await context.close();
        }
      }
    });
  }
}
