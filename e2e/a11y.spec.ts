import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, openTab, prepare, test } from './fixtures';

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
      await page.getByRole('button', { name: 'Make it a sentence' }).click();
      await page.getByRole('button', { name: 'Say it' }).click();
      await page.getByRole('group', { name: 'Suggested sentences', exact: true }).waitFor();
    },
  },
  {
    name: 'on-screen keyboard',
    path: 'phrase-board/',
    act: async (page) => page.getByRole('button', { name: /type/i }).click(),
  },
  { name: 'listen & reply', path: 'listen-reply/' },
  {
    name: 'listen & reply with an utterance and AI',
    path: 'listen-reply/',
    settings: { aiProvider: 'demo', aiModel: 'demo' },
    act: async (page) => {
      await page.getByRole('button', { name: /type what they said/i }).click();
      await page.getByRole('textbox').fill('Would you like the physical therapist to come back tomorrow?');
      await page.getByRole('button', { name: 'Add' }).click();
      await page.getByRole('button', { name: 'Make it a sentence' }).click();
      await page.getByRole('button', { name: 'Say it' }).click();
      await page.getByRole('group', { name: 'Suggested sentences', exact: true }).waitFor();
    },
  },
  { name: 'vocabulary builder', path: 'vocabulary-builder/' },
  {
    name: 'vocabulary builder review',
    path: 'vocabulary-builder/',
    act: async (page) => {
      await page.getByRole('button', { name: 'Use sample text' }).click();
      await page.getByRole('button', { name: 'Find words' }).click();
      await page.getByRole('heading', { name: '2. Review' }).waitFor();
    },
  },
  {
    name: 'letter search',
    path: 'phrase-board/',
    act: async (page) => {
      await openTab(page, 'A–Z');
      await page.getByRole('button', { name: 'Words starting with b' }).click();
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
  for (const path of ['./', 'phrase-board/', 'listen-reply/', 'vocabulary-builder/']) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
