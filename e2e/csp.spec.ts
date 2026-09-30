import { expect, prepare, test } from './fixtures';

// The AI key lives in localStorage, so the Content Security Policy is what
// keeps other sites' code and requests out. (The fixture already fails any
// test that trips the policy during normal use.)

const PAGES = ['./', 'phrase-board/', 'listen-reply/', 'vocabulary-builder/'];

test.describe('Content Security Policy', () => {
  test('every page carries it, ahead of its scripts', async ({ page }) => {
    await prepare(page);
    for (const path of PAGES) {
      await page.goto(path);
      const order = await page.evaluate(() =>
        Array.from(document.head.children).map((el) =>
          el.matches('meta[http-equiv="Content-Security-Policy"]') ? 'csp' : el.tagName === 'SCRIPT' ? 'script' : null,
        ).filter(Boolean),
      );
      expect(order[0], path).toBe('csp');
      expect(order, path).toContain('script');
    }
  });

  test('requests may go to the AI providers but nowhere else', async ({ page, cspViolations }) => {
    await prepare(page);
    const reached: string[] = [];
    await page.route(/^https:\/\/(api\.anthropic\.com|api\.openai\.com|example\.com)\//, (route) => {
      reached.push(new URL(route.request().url()).host);
      return route.fulfill({ status: 200, body: '{}', headers: { 'access-control-allow-origin': '*' } });
    });
    await page.goto('phrase-board/');

    const attempt = (url: string) =>
      page.evaluate((u) => fetch(u, { method: 'POST' }).then(() => 'ok', () => 'blocked'), url);
    expect(await attempt('https://api.anthropic.com/v1/messages')).toBe('ok');
    expect(await attempt('https://api.openai.com/v1/chat/completions')).toBe('ok');
    expect(await attempt('https://example.com/steal')).toBe('blocked');
    expect(reached).toEqual(['api.anthropic.com', 'api.openai.com']);

    await expect.poll(() => cspViolations.length).toBeGreaterThan(0);
    expect(cspViolations.join('\n')).toContain('example.com');
    cspViolations.length = 0; // expected: that was the point
  });
});
