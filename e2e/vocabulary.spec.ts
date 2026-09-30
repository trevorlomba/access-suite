import { expect, messageWords, prepare, test } from './fixtures';

test.describe('Vocabulary Builder', () => {
  test('builds a word list on-device and it shows up in the Phrase Board', async ({ page, baseURL }) => {
    // Privacy: fail on any request that leaves this site.
    const offsite: string[] = [];
    page.on('request', (r) => {
      if (!r.url().startsWith(baseURL!) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) offsite.push(r.url());
    });

    await prepare(page);
    await page.goto('vocabulary-builder/');
    await page.getByRole('button', { name: 'Use sample text' }).click();
    await page.getByRole('button', { name: 'Find words' }).click(); // runs in a Web Worker
    await expect(page.getByRole('heading', { name: '2. Review' })).toBeFocused();
    await expect(page.getByRole('textbox', { name: 'Spelling of Red Sox' })).toBeVisible();
    await page.getByRole('button', { name: 'Save to this device' }).click();
    await expect(page.getByText(/Saved \d+ words/)).toBeVisible();

    await page.getByRole('link', { name: 'Phrase Board' }).click();
    const tab = page.getByRole('button', { name: 'My words', exact: true });
    await expect(tab).toHaveAttribute('aria-pressed', 'true'); // shown first
    await page.getByRole('button', { name: 'photo album', exact: true }).click();
    await page.getByRole('button', { name: 'Rosa', exact: true }).click();
    await expect.poll(() => messageWords(page)).toEqual(['photo album', 'Rosa']);

    expect(offsite).toEqual([]);
  });

  test('my words appear in Listen & Reply', async ({ page }) => {
    await prepare(page);
    await page.goto('vocabulary-builder/');
    await page.getByRole('button', { name: 'Use sample text' }).click();
    await page.getByRole('button', { name: 'Find words' }).click();
    await page.getByRole('button', { name: 'Save to this device' }).click();
    await page.goto('listen-reply/');
    // Shown first until the other person says something.
    await expect(page.getByRole('button', { name: 'My words', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Biscuit', exact: true })).toBeVisible();
  });
});
