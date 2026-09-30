import { readFileSync } from 'node:fs';
import { expect, messageWords, prepare, spoken, test } from './fixtures';

test.describe('offline & install', () => {
  test('after one visit, every tool works with no connection', async ({ page, context }) => {
    await prepare(page);
    await page.goto('phrase-board/');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload(); // first reload puts the page under the service worker's control
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

    await context.setOffline(true);
    await page.reload();
    await page.getByRole('button', { name: 'want', exact: true }).click();
    await page.getByRole('button', { name: 'Needs' }).click();
    await page.getByRole('button', { name: 'water' }).click();
    await page.getByRole('button', { name: /speak/i }).click();
    await expect.poll(() => messageWords(page)).toEqual(['want', 'water']);
    await expect.poll(() => spoken(page)).toEqual(['Want water']);

    // Tools never opened before are precached too.
    const others: [string, string][] = [
      ['listen-reply/', 'Listen & Reply'],
      ['vocabulary-builder/', 'Vocabulary Builder'],
      ['./', 'Access Suite'],
    ];
    for (const [path, heading] of others) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    }
    await context.setOffline(false);
  });

  test('each tool has an installable manifest with working icons', async ({ request }) => {
    for (const path of ['', 'phrase-board/', 'listen-reply/', 'vocabulary-builder/']) {
      const res = await request.get(`${path}manifest.webmanifest`);
      expect(res.ok(), path).toBe(true);
      const m = await res.json();
      expect(m).toMatchObject({ start_url: './', scope: './', display: 'standalone' });
      for (const icon of m.icons as { src: string }[]) {
        const url = new URL(icon.src, new URL(`${path}manifest.webmanifest`, 'http://localhost:4173/')).pathname;
        expect((await request.get(url)).ok(), `${path} → ${icon.src}`).toBe(true);
      }
    }
  });
});

test.describe('backup & restore', () => {
  test('a backup brings back saved phrases and words on a wiped browser', async ({ page, isMobile }) => {
    test.skip(isMobile, 'same flow; downloads are desktop-only in Playwright');
    await prepare(page);
    await page.goto('phrase-board/');
    await page.getByRole('button', { name: 'Social' }).click();
    await page.getByRole('button', { name: 'good night' }).click();
    await page.getByRole('button', { name: /save/i }).click();

    await page.getByRole('button', { name: /settings/i }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download a backup' }).click(),
    ]);
    const file = await download.path();
    const backup = JSON.parse(readFileSync(file, 'utf8'));
    expect(backup.format).toBe('access-suite/backup');

    // Wipe everything, as a browser reset would.
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.getByRole('group', { name: 'Saved phrases' }).getByRole('button', { name: 'Good night' })).toHaveCount(0);

    await page.getByRole('button', { name: /settings/i }).click();
    await page.getByLabel('Restore from a backup').setInputFiles(file);
    await page.waitForLoadState('load'); // restore reloads the page
    await expect(page.getByRole('group', { name: 'Saved phrases' }).getByRole('button', { name: 'Good night' })).toBeVisible();
  });
});
