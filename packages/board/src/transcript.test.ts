import { describe, expect, it } from 'vitest';
import { analyzeUtterance, classify, extractPhrases, extractWords, quickReplies } from './transcript';

describe('classify', () => {
  it.each([
    ['do you want some water', 'yes-no-question'],
    ['Are you comfortable', 'yes-no-question'],
    ['okay, can I turn you over now', 'yes-no-question'],
    ['what would you like for dinner', 'question'],
    ['how are you feeling today', 'question'],
    ['you want the TV on?', 'yes-no-question'],
    ['the doctor is coming this afternoon', 'statement'],
  ])('%s → %s', (text, kind) => {
    expect(classify(text)).toBe(kind);
  });

  it('recognizes imperatives', () => {
    expect(classify('look at me')).toBe('command');
    expect(classify('please open your eyes')).toBe('command');
  });
});

describe('extractWords', () => {
  it('keeps spoken order, dedupes, drops fillers and punctuation', () => {
    expect(extractWords('Um, do you want water? Do you want tea?')).toEqual(['do', 'you', 'want', 'water', 'tea']);
  });

  it('capitalizes I', () => {
    expect(extractWords('can i help')).toContain('I');
  });
});

describe('extractPhrases', () => {
  it('finds multi-word noun phrases and skips single words', () => {
    const phrases = extractPhrases('The physical therapist is coming this afternoon with a new wheelchair.');
    expect(phrases.some((p) => p.includes('therapist'))).toBe(true);
    expect(phrases.some((p) => p.includes('wheelchair'))).toBe(true);
    expect(phrases.every((p) => p.split(' ').length >= 2)).toBe(true);
  });
});

describe('analyzeUtterance + quickReplies', () => {
  it('offers yes/no replies for yes/no questions', () => {
    const u = analyzeUtterance('Do you want the blinds open?');
    expect(u.kind).toBe('yes-no-question');
    expect(quickReplies(u.kind)).toEqual(expect.arrayContaining(['Yes', 'No']));
    expect(u.words).toContain('blinds');
  });
});
