import type { Page } from '@playwright/test';
import { expect, messageWords, prepare, spoken, test } from './fixtures';

const APP = 'listen-reply/';

/** Fake Web Speech recognizer: each start() "hears" the next scripted phrase. */
async function fakeRecognizer(page: Page, phrases: string[]) {
  await page.addInitScript((script) => {
    let n = 0;
    class FakeRecognition {
      continuous = false;
      interimResults = false;
      lang = 'en-US';
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        const text = script[n++ % script.length]!;
        setTimeout(() => {
          this.onresult?.({ resultIndex: 0, results: { length: 1, 0: { isFinal: false, 0: { transcript: text.split(' ')[0] } } } });
        }, 50);
        setTimeout(() => {
          this.onresult?.({ resultIndex: 0, results: { length: 1, 0: { isFinal: true, 0: { transcript: text } } } });
          this.onend?.();
        }, 150);
      }
      stop() {
        this.onend?.();
      }
    }
    (window as unknown as Record<string, unknown>).SpeechRecognition = FakeRecognition;
  }, phrases);
}

test.describe('Listen & Reply', () => {
  test('listen → yes/no question → quick reply is spoken', async ({ page }) => {
    await fakeRecognizer(page, ['do you want some water']);
    await prepare(page);
    await page.goto(APP);
    await page.getByRole('button', { name: '🎤 Listen' }).click();
    await expect(page.getByText('“do you want some water”')).toBeVisible();
    await expect(page.getByText('Yes/no question')).toBeVisible();
    await page.getByRole('group', { name: 'Quick replies' }).getByRole('button', { name: 'Yes' }).click();
    await expect.poll(() => spoken(page)).toEqual(['Yes']);
  });

  test('reply with their words using two-switch scanning', async ({ page }) => {
    await fakeRecognizer(page, ['are you comfortable']);
    await prepare(page, { inputMode: 'scan-step' });
    await page.goto(APP);
    // Scanning makes Enter a switch; start listening with the mouse (caregiver).
    await page.getByRole('button', { name: '🎤 Listen' }).click();
    await expect(page.getByText('“are you comfortable”')).toBeVisible();

    const theirWords = page.getByRole('group', { name: /^Their words, row 1/ });
    for (let i = 0; i < 12; i++) {
      if (await theirWords.evaluate((el) => el.classList.contains('scan-highlight'))) break;
      await page.keyboard.press('Space');
    }
    await expect(theirWords).toHaveClass(/scan-highlight/);
    await page.keyboard.press('Enter'); // enter row → "are"
    await page.keyboard.press('Space'); // "you"
    await page.keyboard.press('Space'); // "comfortable"
    await page.keyboard.press('Enter');
    await expect.poll(() => messageWords(page)).toEqual(['comfortable']);
  });

  test('typed fallback works when the browser cannot transcribe', async ({ page }) => {
    // Simulate a browser without speech recognition (e.g. Firefox).
    await page.addInitScript(() => {
      const w = window as unknown as Record<string, unknown>;
      delete w.SpeechRecognition;
      delete w.webkitSpeechRecognition;
    });
    await prepare(page);
    await page.goto(APP);
    await expect(page.getByRole('button', { name: '🎤 Listen' })).toHaveCount(0);
    await page.getByRole('button', { name: /type what they said/i }).click();
    await page.getByRole('textbox').fill('The doctor is coming this afternoon');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText('Statement')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Their words', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'the doctor', exact: true })).toBeVisible();
  });
});
