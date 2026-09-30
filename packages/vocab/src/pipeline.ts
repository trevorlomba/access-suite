import nlp from 'compromise';
import type { VocabCategory, VocabPhrase, VocabWord } from './schema';
import { STOPWORDS } from './stopwords';

/**
 * Personal-vocabulary pipeline, run entirely in the browser.
 *
 * Staged like a small dbt project so each step is a pure, testable function:
 *
 *   sources ─► parse (stg)      raw files → documents (one message/line each)
 *           ─► tag (int)        documents → tagged term observations
 *           ─► aggregate (int)  observations → one candidate per word
 *           ─► phrases (int)    token n-grams → repeated 2–3 word phrases
 *           ─► rank (mart)      filter + sort → reviewable vocabulary
 *
 * Reimagines the 2023 accessible-language-generation Python/SQLite scripts,
 * without the data ever leaving the device.
 */

export type InputFormat = 'text' | 'csv' | 'json';

export interface Source {
  name: string;
  content: string;
  format?: InputFormat;
  /** CSV only: which column holds the text. Auto-detected if omitted. */
  column?: string;
}

export interface PipelineOptions {
  /** Keep words used at least this many times. */
  minCount: number;
  includePhrases: boolean;
  /** Skip words the starter board already has. */
  hideKnown: boolean;
  knownWords: string[];
  maxWords: number;
  maxPhrases: number;
}

export const DEFAULT_OPTIONS: PipelineOptions = {
  minCount: 2,
  includePhrases: true,
  hideKnown: true,
  knownWords: [],
  maxWords: 300,
  maxPhrases: 60,
};

export interface PipelineStats {
  documents: number;
  tokens: number;
  uniqueWords: number;
  keptWords: number;
  keptPhrases: number;
}

export interface PipelineResult {
  words: VocabWord[];
  phrases: VocabPhrase[];
  stats: PipelineStats;
}

// ---- stg: parse ---------------------------------------------------------------

const TEXT_KEYS = ['text', 'message', 'transcript', 'transcription', 'content', 'body', 'phrase', 'utterance'];

export function detectFormat(name: string): InputFormat {
  const ext = name.toLowerCase().split('.').pop();
  if (ext === 'csv' || ext === 'tsv') return 'csv';
  if (ext === 'json') return 'json';
  return 'text';
}

/** Minimal RFC 4180 CSV parser (quotes, escaped quotes, CRLF). */
export function parseCsv(input: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i]!;
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim()));
}

/** Pick the CSV column that holds the text: a known name, else the wordiest column. */
export function pickTextColumn(header: string[], rows: string[][]): number {
  const named = header.findIndex((h) => TEXT_KEYS.includes(h.trim().toLowerCase()));
  if (named >= 0) return named;
  let best = 0;
  let bestLen = -1;
  header.forEach((_, i) => {
    const avg = rows.reduce((sum, r) => sum + (r[i]?.split(/\s+/).length ?? 0), 0) / Math.max(1, rows.length);
    if (avg > bestLen) {
      bestLen = avg;
      best = i;
    }
  });
  return best;
}

function collectJsonText(value: unknown, out: string[], underTextKey = false): void {
  if (typeof value === 'string') {
    if (underTextKey) out.push(value);
  } else if (Array.isArray(value)) {
    const allStrings = value.length > 0 && value.every((v) => typeof v === 'string');
    for (const v of value) collectJsonText(v, out, underTextKey || allStrings);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) collectJsonText(v, out, TEXT_KEYS.includes(k.toLowerCase()));
  }
}

export function parseSource(src: Source): string[] {
  const format = src.format ?? detectFormat(src.name);
  let docs: string[] = [];
  if (format === 'csv') {
    const delimiter = src.name.toLowerCase().endsWith('.tsv') ? '\t' : ',';
    const [header = [], ...rows] = parseCsv(src.content, delimiter);
    const col = src.column ? header.indexOf(src.column) : pickTextColumn(header, rows);
    docs = rows.map((r) => r[col] ?? '');
  } else if (format === 'json') {
    try {
      collectJsonText(JSON.parse(src.content), docs, true);
    } catch {
      throw new Error(`${src.name} is not valid JSON.`);
    }
  } else {
    docs = src.content.split(/\r?\n/);
  }
  return docs.map((d) => d.trim()).filter(Boolean);
}

// ---- int: tag -----------------------------------------------------------------

export interface TermObservation {
  key: string;
  surface: string;
  category: VocabCategory | null;
  proper: boolean;
}

function categorize(tags: string[]): VocabCategory | null {
  const has = (t: string) => tags.includes(t);
  if (has('Pronoun') || has('Determiner') || has('Preposition') || has('Conjunction') || has('Auxiliary') || has('Copula'))
    return null;
  if (has('Person') || has('FirstName') || has('LastName') || has('ProperNoun')) return 'people';
  if (has('Noun')) return 'things';
  if (has('Verb')) return 'actions';
  if (has('Adjective') || has('Adverb')) return 'describe';
  return 'other';
}

interface CompromiseTerm {
  text: string;
  normal?: string;
  tags?: string[];
}

export function tagDocument(doc: string): TermObservation[] {
  const out: TermObservation[] = [];
  const sentences = nlp(doc).json() as { terms: CompromiseTerm[] }[];
  for (const s of sentences) {
    s.terms.forEach((t, i) => {
      const surface = (t.text ?? '').replace(/[^\p{L}\p{N}'’-]/gu, '').replace(/’/g, "'");
      const key = (t.normal ?? surface).toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, '');
      if (!key) return;
      const tags = t.tags ?? [];
      // Sentence-initial capitals aren't evidence of a name.
      const capitalized = /^\p{Lu}/u.test(surface) && i > 0;
      out.push({ key, surface, category: categorize(tags), proper: capitalized || tags.includes('Person') });
    });
  }
  return out;
}

// ---- int: aggregate -------------------------------------------------------------

export interface Candidate {
  key: string;
  text: string;
  count: number;
  category: VocabCategory;
}

export function aggregate(observations: TermObservation[][]): Candidate[] {
  const map = new Map<
    string,
    { count: number; proper: number; surfaces: Map<string, number>; cats: Map<VocabCategory, number>; skip: number }
  >();
  for (const doc of observations) {
    for (const o of doc) {
      let e = map.get(o.key);
      if (!e) {
        e = { count: 0, proper: 0, surfaces: new Map(), cats: new Map(), skip: 0 };
        map.set(o.key, e);
      }
      e.count++;
      if (o.proper) e.proper++;
      e.surfaces.set(o.surface, (e.surfaces.get(o.surface) ?? 0) + 1);
      if (o.category) e.cats.set(o.category, (e.cats.get(o.category) ?? 0) + 1);
      else e.skip++;
    }
  }
  const out: Candidate[] = [];
  for (const [key, e] of map) {
    if (e.skip > e.count / 2) continue; // mostly a function word
    const isName = e.proper / e.count >= 0.5;
    const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const category = isName ? 'people' : ((top(e.cats as Map<string, number>) as VocabCategory | undefined) ?? 'other');
    const surface = isName ? (top(e.surfaces) ?? key) : key;
    out.push({ key, text: surface, count: e.count, category });
  }
  return out;
}

// ---- int: phrases ---------------------------------------------------------------

export function tokens(doc: string): string[] {
  return doc
    .toLowerCase()
    .replace(/’/g, "'")
    .split(/[^\p{L}\p{N}'-]+/u)
    .filter(Boolean);
}

export function extractPhrases(
  docs: string[][],
  minCount: number,
  max: number,
  known: Set<string> = new Set(),
): VocabPhrase[] {
  const counts = new Map<string, number>();
  for (const toks of docs) {
    const seen = new Set<string>(); // count each phrase once per document
    for (const n of [2, 3]) {
      for (let i = 0; i + n <= toks.length; i++) {
        const gram = toks.slice(i, i + n);
        if (STOPWORDS.has(gram[0]!) && gram[0] !== 'i' && gram[0] !== 'my') continue;
        if (STOPWORDS.has(gram[n - 1]!)) continue;
        // Nothing personal about a phrase made only of board / function words ("i want").
        if (gram.every((t) => STOPWORDS.has(t) || known.has(t))) continue;
        const p = gram.join(' ');
        if (seen.has(p)) continue;
        seen.add(p);
        counts.set(p, (counts.get(p) ?? 0) + 1);
      }
    }
  }
  const kept = [...counts.entries()].filter(([, c]) => c >= Math.max(2, minCount));
  // Drop a 2-gram when a 3-gram containing it is (nearly) as frequent.
  const result = kept.filter(
    ([p, c]) => !kept.some(([q, d]) => q !== p && q.split(' ').length > p.split(' ').length && q.includes(p) && d >= c * 0.8),
  );
  return result
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([text, count]) => ({ text, count }));
}

// ---- mart: rank -----------------------------------------------------------------

export function rank(candidates: Candidate[], opts: PipelineOptions): VocabWord[] {
  const known = new Set(opts.hideKnown ? opts.knownWords.map((w) => w.toLowerCase()) : []);
  return candidates
    .filter(
      (c) =>
        c.count >= opts.minCount &&
        !STOPWORDS.has(c.key) &&
        !known.has(c.key) &&
        !/^\d+$/.test(c.key) &&
        (c.key.length > 1 || c.category === 'people'),
    )
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
    .slice(0, opts.maxWords)
    .map(({ text, count, category }) => ({ text, count, category }));
}

/**
 * Multi-word names ("Red Sox", "Dr Patel") arrive as separate capitalized
 * words plus a repeated phrase. Fold them into one People entry, dropping the
 * parts that (almost) never appear on their own.
 */
export function mergeNames(words: VocabWord[], phrases: VocabPhrase[]): { words: VocabWord[]; phrases: VocabPhrase[] } {
  let ws = words.slice();
  const keptPhrases: VocabPhrase[] = [];
  for (const p of phrases) {
    const parts = p.text.split(' ');
    const people = parts.map((t) => ws.find((w) => w.text.toLowerCase() === t && w.category === 'people'));
    // Find runs of 2+ consecutive name words inside the phrase ("red sox" in "red sox game").
    let coveredAll = false;
    for (let i = 0; i < parts.length; ) {
      if (!people[i]) {
        i++;
        continue;
      }
      let j = i;
      while (j < parts.length && people[j]) j++;
      if (j - i >= 2) {
        const run = people.slice(i, j) as VocabWord[];
        const name = run.map((m) => m.text).join(' ');
        if (!ws.some((w) => w.text === name)) {
          ws = ws.filter((w) => !run.includes(w) || w.count > p.count * 1.25);
          ws.push({ text: name, count: p.count, category: 'people' });
        }
        if (i === 0 && j === parts.length) coveredAll = true;
      }
      i = j;
    }
    if (!coveredAll) {
      // Show names with their capitals, and "I" upper-case: "Red Sox game".
      const text = parts.map((t, k) => people[k]?.text ?? (t === 'i' ? 'I' : t)).join(' ');
      keptPhrases.push({ ...p, text });
    }
  }
  ws.sort((a, b) => b.count - a.count || a.text.localeCompare(b.text));
  return { words: ws, phrases: keptPhrases };
}

export function runPipeline(sources: Source[], options: Partial<PipelineOptions> = {}): PipelineResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const docs = sources.flatMap(parseSource);
  const observations = docs.map(tagDocument);
  const candidates = aggregate(observations);
  const known = new Set(opts.hideKnown ? opts.knownWords.map((w) => w.toLowerCase()) : []);
  // Names are merged before the includePhrases switch so "Red Sox" survives either way.
  const allPhrases = extractPhrases(docs.map(tokens), opts.minCount, opts.maxPhrases, known);
  const merged = mergeNames(rank(candidates, opts), allPhrases);
  const words = merged.words.slice(0, opts.maxWords);
  const phrases = opts.includePhrases ? merged.phrases : [];
  return {
    words,
    phrases,
    stats: {
      documents: docs.length,
      tokens: observations.reduce((n, d) => n + d.length, 0),
      uniqueWords: candidates.length,
      keptWords: words.length,
      keptPhrases: phrases.length,
    },
  };
}
