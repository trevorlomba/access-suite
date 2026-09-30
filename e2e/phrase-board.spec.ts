import { expect, messageWords, prepare, spoken, tabTo, test } from './fixtures';

const BOARD = 'phrase-board/';

test.describe('Phrase Board', () => {
  test('keyboard only: compose and speak', async ({ page }) => {
    await prepare(page);
    await page.goto(BOARD);
    await tabTo(page, 'I');
    await page.keyboard.press('Enter');
    await tabTo(page, 'want');
    await page.keyboard.press('Enter');
    await expect.poll(() => messageWords(page)).toEqual(['I', 'want']);

    await tabTo(page, '🔊 Speak', true);
    await page.keyboard.press('Enter');
    await expect.poll(() => spoken(page)).toEqual(['I want']);
  });

  test('two-switch step scanning: Space moves, Enter selects', async ({ page }) => {
    await prepare(page, { inputMode: 'scan-step' });
    await page.goto(BOARD);
    const pronouns = page.getByRole('group', { name: 'Pronouns' });

    // Groups in order: Tools, (message actions are all disabled, so skipped), Pronouns.
    await page.keyboard.press('Space');
    await page.keyboard.press('Space');
    await expect(pronouns).toHaveClass(/scan-highlight/);

    await page.keyboard.press('Enter'); // enter Pronouns → "I" highlighted
    await expect(pronouns.getByRole('button', { name: 'I', exact: true })).toHaveClass(/scan-highlight/);
    await page.keyboard.press('ArrowRight'); // → "you"
    await page.keyboard.press('Enter');
    await expect.poll(() => messageWords(page)).toEqual(['you']);
  });

  test('one-switch auto scanning selects with a single key', async ({ page }) => {
    await prepare(page, { inputMode: 'scan-auto', scanIntervalMs: 900 });
    await page.goto(BOARD);
    const pronouns = page.getByRole('group', { name: 'Pronouns' });
    await expect(pronouns).toHaveClass(/scan-highlight/, { timeout: 10_000 });
    await page.keyboard.press('Space');
    const first = pronouns.getByRole('button', { name: 'I', exact: true });
    await expect(first).toHaveClass(/scan-highlight/);
    await page.keyboard.press('Space');
    await expect.poll(() => messageWords(page)).toEqual(['I']);
  });

  test('dwell selects on hover and cancels when the pointer leaves', async ({ page, isMobile }) => {
    test.skip(isMobile, 'dwell is for pointer devices');
    await prepare(page, { inputMode: 'dwell', dwellMs: 600 });
    await page.goto(BOARD);
    const want = page.getByRole('button', { name: 'want', exact: true });
    const need = page.getByRole('button', { name: 'need', exact: true });

    await want.hover();
    await page.waitForTimeout(200);
    await page.mouse.move(0, 0); // leave early → no selection
    await page.waitForTimeout(700);
    await expect(page.getByRole('group', { name: /message words/i })).toHaveCount(0);

    await need.hover();
    await expect.poll(() => messageWords(page), { timeout: 3000 }).toEqual(['need']);
    // Staying on the same button does not repeat the selection.
    await page.waitForTimeout(900);
    expect(await messageWords(page)).toEqual(['need']);
  });

  test('demo AI suggestions speak when chosen', async ({ page }) => {
    await prepare(page, { aiProvider: 'demo', aiModel: 'demo' });
    await page.goto(BOARD);
    await page.getByRole('button', { name: 'Needs' }).click();
    await page.getByRole('button', { name: 'blanket' }).click();
    await page.getByRole('button', { name: 'Ask it' }).click();
    await page.getByRole('button', { name: 'Can I have blanket?' }).click();
    await expect.poll(() => spoken(page)).toEqual(['Can I have blanket?']);
  });

  test('hub links to the Phrase Board and back', async ({ page }) => {
    await prepare(page);
    await page.goto('./');
    await page.getByRole('link', { name: 'Open Phrase Board' }).click();
    await expect(page).toHaveTitle(/Phrase Board/);
    await page.getByRole('link', { name: /all tools/i }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Access Suite');
  });
});
