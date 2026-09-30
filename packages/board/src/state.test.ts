import { describe, expect, it } from 'vitest';
import { freqScale, messageReducer, messageText, recordUse, type Token } from './state';
import { CATEGORIES, PRONOUNS, allWords, wordsStartingWith } from './vocab';
import { fitScale } from './WordRows';

describe('fitScale', () => {
  it('shrinks only long words, never below 75%', () => {
    expect(fitScale('water', 3)).toBe(1);
    expect(fitScale('wonderful', 3)).toBeCloseTo(8 / 9);
    expect(fitScale('comfortable', 3)).toBe(0.75); // 8/11 is below the floor
    expect(fitScale('comfortable', 6)).toBeCloseTo(10 / 11);
    expect(fitScale('the physical therapist', 6)).toBe(0.8);
    expect(fitScale('pain relief', 6)).toBe(1);
  });
});

const tokens = (...words: string[]): Token[] => words.map((text, i) => ({ id: i + 100, text }));

describe('messageReducer', () => {
  it('adds, removes, backspaces and clears', () => {
    let s = messageReducer([], { type: 'add', text: 'I' });
    s = messageReducer(s, { type: 'add', text: 'want' });
    s = messageReducer(s, { type: 'add', text: 'water' });
    expect(s.map((t) => t.text)).toEqual(['I', 'want', 'water']);
    expect(messageReducer(s, { type: 'remove', index: 1 }).map((t) => t.text)).toEqual(['I', 'water']);
    expect(messageReducer(s, { type: 'backspace' })).toHaveLength(2);
    expect(messageReducer(s, { type: 'clear' })).toEqual([]);
  });

  it('moves words and ignores moves past either end', () => {
    const s = tokens('water', 'I', 'want');
    const moved = messageReducer(s, { type: 'move', index: 0, by: 1 });
    expect(moved.map((t) => t.text)).toEqual(['I', 'water', 'want']);
    expect(messageReducer(s, { type: 'move', index: 0, by: -1 })).toBe(s);
    expect(messageReducer(s, { type: 'move', index: 2, by: 1 })).toBe(s);
  });
});

describe('messageText', () => {
  it('capitalizes and attaches punctuation', () => {
    expect(messageText(tokens('where', 'is', 'my', 'phone', '?'))).toBe('Where is my phone?');
  });
});

describe('frequency sizing', () => {
  it('grows used words, bounded, case-insensitive', () => {
    const f = recordUse(recordUse({}, ['Water', 'water']), ['tea']);
    expect(f).toEqual({ water: 2, tea: 1 });
    expect(freqScale(f, 'WATER')).toBeCloseTo(1.45);
    expect(freqScale(f, 'tea')).toBeGreaterThan(1);
    expect(freqScale(f, 'tea')).toBeLessThan(1.45);
    expect(freqScale(f, 'unused')).toBe(1);
    expect(freqScale({}, 'x')).toBe(1);
  });
});

describe('vocabulary', () => {
  it('has no duplicate words within a category', () => {
    for (const c of [...CATEGORIES, { id: 'pronouns', words: PRONOUNS }]) {
      const texts = c.words.map((x) => x.text.toLowerCase());
      expect(new Set(texts).size, c.id).toBe(texts.length);
    }
  });

  it('filters across the whole board by first letter', () => {
    const ws = wordsStartingWith('w').map((x) => x.text);
    expect(ws).toContain('water');
    expect(ws).toContain('we');
    expect(ws.every((x) => x.toLowerCase().startsWith('w'))).toBe(true);
    const all = allWords().map((x) => x.text.toLowerCase());
    expect(new Set(all).size).toBe(all.length);
  });
});
