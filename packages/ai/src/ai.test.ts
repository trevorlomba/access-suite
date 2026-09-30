import { describe, expect, it, vi } from 'vitest';
import { AiError, buildPrompt, generate, isConfigured, parseSuggestions } from './index';
import { openaiAdapter } from './openai';

describe('buildPrompt', () => {
  it('includes words in order, intent and count', () => {
    const p = buildPrompt({ words: ['I', 'want', 'water'], intent: 'question', n: 3 });
    expect(p.user).toContain('"I", "want", "water"');
    expect(p.user).toContain('question');
    expect(p.user).toContain('Number of options: 3');
    expect(p.system).toMatch(/JSON array/);
  });

  it('adds conversation context first when given', () => {
    const p = buildPrompt({ words: ['yes'], intent: 'yes', n: 1, context: 'Do you want tea?' });
    expect(p.user.split('\n')[0]).toContain('Do you want tea?');
  });

  it('clamps n to 1–3', () => {
    expect(buildPrompt({ words: ['a'], intent: 'statement', n: 9 }).user).toContain('options: 3');
    expect(buildPrompt({ words: ['a'], intent: 'statement', n: 0 }).user).toContain('options: 1');
  });
});

describe('parseSuggestions', () => {
  it('parses a JSON array, even with surrounding prose', () => {
    expect(parseSuggestions('Sure:\n["A.", "B?"]', 3)).toEqual(['A.', 'B?']);
  });

  it('falls back to bullet / numbered lines', () => {
    expect(parseSuggestions('1. First\n2) Second\n- Third\n* Fourth', 3)).toEqual(['First', 'Second', 'Third']);
  });

  it('dedupes case-insensitively and drops non-strings', () => {
    expect(parseSuggestions('["Hi", "hi", 3, "Bye"]', 3)).toEqual(['Hi', 'Bye']);
  });
});

describe('generate', () => {
  it('requires a key for keyed providers', async () => {
    expect(isConfigured({ provider: 'anthropic', apiKey: '', model: '' })).toBe(false);
    expect(isConfigured({ provider: 'demo', apiKey: '', model: '' })).toBe(true);
    await expect(generate({ provider: 'openai', apiKey: ' ', model: '' }, { words: ['x'], intent: 'statement', n: 1 })).rejects.toBeInstanceOf(AiError);
  });

  it('uses the demo adapter end to end', async () => {
    const out = await generate({ provider: 'demo', apiKey: '', model: '' }, { words: ['cold', 'water'], intent: 'question', n: 3 });
    expect(out).toEqual(['Can I have cold water?', 'What about cold water?', 'Could you help me with cold water?']);
  });

  it('passes the default model and prompt to an injected adapter', async () => {
    const adapter = vi.fn().mockResolvedValue('["One.", "Two."]');
    const out = await generate(
      { provider: 'anthropic', apiKey: 'k', model: '' },
      { words: ['tea'], intent: 'statement', n: 2 },
      { adapters: { anthropic: adapter } },
    );
    expect(out).toEqual(['One.', 'Two.']);
    expect(adapter.mock.calls[0]![0].model).toBe('claude-opus-5');
    expect(adapter.mock.calls[0]![1].user).toContain('"tea"');
  });

  it('returns nothing for an empty selection without calling the provider', async () => {
    const adapter = vi.fn();
    expect(await generate({ provider: 'demo', apiKey: '', model: '' }, { words: [], intent: 'statement', n: 3 }, { adapters: { demo: adapter } })).toEqual([]);
    expect(adapter).not.toHaveBeenCalled();
  });
});

describe('openaiAdapter', () => {
  const prompt = { system: 's', user: 'u' };
  const req = { words: ['a'], intent: 'statement' as const, n: 1 };

  it('maps 401 to an auth error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    await expect(openaiAdapter({ provider: 'openai', apiKey: 'k', model: 'm' }, prompt, req)).rejects.toMatchObject({ code: 'auth' });
    vi.unstubAllGlobals();
  });

  it('returns message content and sends the bearer key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '["Hi."]' } }] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const text = await openaiAdapter({ provider: 'openai', apiKey: 'secret', model: 'm' }, prompt, req);
    expect(text).toBe('["Hi."]');
    expect(fetchMock.mock.calls[0]![1].headers.authorization).toBe('Bearer secret');
    vi.unstubAllGlobals();
  });
});
