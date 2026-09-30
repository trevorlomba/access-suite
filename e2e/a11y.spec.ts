import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, prepare, test } from './fixtures';

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 5) }));
}

const STATES: { name: string; path: string; settings?: Record<string, unknown>; act?: (page: Page) => Promise<void> }[] = [
  { name: 'hub', path: './' },
  {
    name: 'hub settings dialog',
    path: './',
    act: async (page) => page.getByRole('button', { name: /settings/i }).click(),
  },
  { name: 'phrase board', path: 'phrase-board/' },
  { name: 'phrase board, high contrast', path: 'phrase-board/', settings: { highContrast: true } },
  {
    name: 'phrase board with message and AI suggestions',
    path: 'phrase-board/',
    settings: { aiProvider: 'demo', aiModel: 'demo' },
    act: async (page) => {
      await page.getByRole('button', { name: 'want', exact: true }).click();
      await page.getByRole('button', { name: 'Say it' }).click();
      await page.getByRole('group', { name: 'Suggested sentences' }).waitFor();
    },
  },
  {
    name: 'on-screen keyboard',
    path: 'phrase-board/',
    act: async (page) => page.getByRole('button', { name: /type/i }).click(),
  },
  {
    name: 'letter search',
    path: 'phrase-board/',
    act: async (page) => {
      await page.getByRole('button', { name: 'A–Z' }).click();
      await page.getByRole('button', { name: 'Words starting with s' }).click();
    },
  },
];

for (const state of STATES) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`axe: ${state.name} (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await prepare(page, state.settings);
      await page.goto(state.path);
      await state.act?.(page);
      expect(await seriousViolations(page)).toEqual([]);
    });
  }
}

test('no horizontal scrolling at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await prepare(page);
  for (const path of ['./', 'phrase-board/']) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
