import { describe, expect, it } from 'vitest';
import {
  SAMPLE_TEXT,
  aggregate,
  extractPhrases,
  makeVocabulary,
  parseCsv,
  parseSource,
  parseVocabulary,
  pickTextColumn,
  runPipeline,
  tagDocument,
  tokens,
} from './index';

describe('stg: parse', () => {
  it('splits text into non-empty lines', () => {
    expect(parseSource({ name: 'a.txt', content: 'one\n\n two \r\nthree' })).toEqual(['one', 'two', 'three']);
  });

  it('parses quoted CSV and finds the text column by name or wordiness', () => {
    const csv = 'id,date,message\n1,2024-01-01,"Hello, Rosa"\n2,2024-01-02,"She said ""hi"""\n';
    expect(parseCsv(csv)[1]).toEqual(['1', '2024-01-01', 'Hello, Rosa']);
    expect(parseSource({ name: 'm.csv', content: csv })).toEqual(['Hello, Rosa', 'She said "hi"']);
    const unnamed = parseCsv('a,b\n1,the quick brown fox\n2,jumps over it');
    expect(pickTextColumn(unnamed[0]!, unnamed.slice(1))).toBe(1);
  });

  it('extracts text fields from nested JSON, or a plain array of strings', () => {
    const json = JSON.stringify({ items: [{ id: 1, text: 'call Rosa' }, { id: 2, transcript: 'feed Biscuit' }] });
    expect(parseSource({ name: 'bank.json', content: json })).toEqual(['call Rosa', 'feed Biscuit']);
    expect(parseSource({ name: 'list.json', content: '["a b", "c d"]' })).toEqual(['a b', 'c d']);
    expect(() => parseSource({ name: 'bad.json', content: '{' })).toThrow(/not valid JSON/);
  });
});

describe('int: tag + aggregate', () => {
  it('treats mid-sentence capitals as names but not sentence-initial ones', () => {
    const obs = [tagDocument('Please call Rosa tonight'), tagDocument('Rosa is here'), tagDocument('Call me')];
    const byKey = Object.fromEntries(aggregate(obs).map((c) => [c.key, c]));
    expect(byKey.rosa).toMatchObject({ text: 'Rosa', count: 2, category: 'people' });
    expect(byKey.call).toMatchObject({ text: 'call', category: 'actions' });
  });
});

describe('int: phrases', () => {
  it('keeps repeated phrases, skips stopword edges and board-only phrases', () => {
    const docs = ['I want the photo album', 'the photo album please', 'I want tea'].map(tokens);
    const phrases = extractPhrases(docs, 2, 10, new Set(['want']));
    expect(phrases.map((p) => p.text)).toEqual(['photo album']);
  });
});

describe('runPipeline (sample)', () => {
  const result = runPipeline([{ name: 'sample.txt', content: SAMPLE_TEXT }], { knownWords: ['want', 'go', 'please', 'call', 'tell'] });

  it('surfaces the people and things that matter', () => {
    const texts = result.words.map((w) => w.text);
    expect(texts.slice(0, 3)).toContain('Rosa');
    expect(texts).toEqual(expect.arrayContaining(['Theo', 'Biscuit', 'Red Sox', 'Dr Patel', 'porch', 'shoulder']));
    expect(result.words.find((w) => w.text === 'Red Sox')?.category).toBe('people');
  });

  it('merges multi-word names instead of listing their parts', () => {
    const texts = result.words.map((w) => w.text);
    expect(texts).not.toContain('Red');
    expect(texts).not.toContain('Patel');
  });

  it('hides words already on the board and all stopwords', () => {
    const texts = result.words.map((w) => w.text.toLowerCase());
    for (const w of ['want', 'please', 'the', 'to', 'my']) expect(texts).not.toContain(w);
  });

  it('finds personal phrases with proper capitalization', () => {
    const phrases = result.phrases.map((p) => p.text);
    expect(phrases).toEqual(expect.arrayContaining(['photo album', 'my shoulder hurts', 'Red Sox game']));
    expect(phrases).not.toContain('I want');
  });

  it('reports stats', () => {
    expect(result.stats.documents).toBe(20);
    expect(result.stats.keptWords).toBe(result.words.length);
  });

  it('is deterministic', () => {
    const again = runPipeline([{ name: 'sample.txt', content: SAMPLE_TEXT }], { knownWords: ['want', 'go', 'please', 'call', 'tell'] });
    expect(again.words).toEqual(result.words);
    expect(again.phrases).toEqual(result.phrases);
  });
});

describe('schema', () => {
  it('round-trips a vocabulary file', () => {
    const file = makeVocabulary([{ text: 'Rosa', count: 4, category: 'people' }], [{ text: 'photo album', count: 2 }], new Date(0));
    expect(parseVocabulary(JSON.stringify(file))).toEqual(file);
  });

  it('rejects the wrong file and cleans untrusted fields', () => {
    expect(() => parseVocabulary('{"hello":1}')).toThrow(/not an Access Suite vocabulary/);
    expect(() => parseVocabulary('nope')).toThrow(/not valid JSON/);
    const dirty = parseVocabulary({
      format: 'access-suite/vocabulary',
      version: 1,
      words: [{ text: '  Theo ', count: -3, category: 'hacker' }, { text: '' }, null],
      phrases: [{ text: 'x'.repeat(200), count: 'many' }],
    });
    expect(dirty.words).toEqual([{ text: 'Theo', count: 0, category: 'other' }]);
    expect(dirty.phrases[0]!.text).toHaveLength(80);
    expect(dirty.phrases[0]!.count).toBe(0);
  });
});
