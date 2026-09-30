/**
 * The personal vocabulary file: what the Vocabulary Builder exports and what
 * the communication tools import. Kept dependency-free so tools can read it
 * without pulling in the NLP pipeline.
 */

export type VocabCategory = 'people' | 'things' | 'actions' | 'describe' | 'other';

export const CATEGORY_LABELS: Record<VocabCategory, string> = {
  people: 'People & names',
  things: 'Places & things',
  actions: 'Actions',
  describe: 'Describing words',
  other: 'Other',
};

export interface VocabWord {
  text: string;
  count: number;
  category: VocabCategory;
}

export interface VocabPhrase {
  text: string;
  count: number;
}

export interface VocabularyFile {
  format: 'access-suite/vocabulary';
  version: 1;
  createdAt: string;
  words: VocabWord[];
  phrases: VocabPhrase[];
}

/** localStorage key shared by the builder and the tools (same origin). */
export const VOCAB_STORAGE_KEY = 'access-suite:vocabulary';

export function makeVocabulary(words: VocabWord[], phrases: VocabPhrase[], now = new Date()): VocabularyFile {
  return { format: 'access-suite/vocabulary', version: 1, createdAt: now.toISOString(), words, phrases };
}

const CATEGORIES = new Set<string>(Object.keys(CATEGORY_LABELS));

/**
 * Validate untrusted input (an imported file or stored JSON). Returns a clean
 * copy or throws with a message a caregiver can act on.
 */
export function parseVocabulary(input: unknown): VocabularyFile {
  const data = typeof input === 'string' ? safeJson(input) : input;
  if (!data || typeof data !== 'object') throw new Error('This file is not a vocabulary file.');
  const d = data as Record<string, unknown>;
  if (d.format !== 'access-suite/vocabulary') throw new Error('This file is not an Access Suite vocabulary file.');
  if (d.version !== 1) throw new Error(`Unsupported vocabulary version: ${String(d.version)}.`);
  const words = Array.isArray(d.words) ? d.words : [];
  const phrases = Array.isArray(d.phrases) ? d.phrases : [];
  const cleanText = (t: unknown) => (typeof t === 'string' ? t.trim().slice(0, 80) : '');
  const cleanCount = (c: unknown) => (typeof c === 'number' && Number.isFinite(c) && c >= 0 ? Math.round(c) : 0);
  return {
    format: 'access-suite/vocabulary',
    version: 1,
    createdAt: typeof d.createdAt === 'string' ? d.createdAt : new Date(0).toISOString(),
    words: words
      .map((w) => {
        const o = (w ?? {}) as Record<string, unknown>;
        const category = typeof o.category === 'string' && CATEGORIES.has(o.category) ? (o.category as VocabCategory) : 'other';
        return { text: cleanText(o.text), count: cleanCount(o.count), category };
      })
      .filter((w) => w.text)
      .slice(0, 2000),
    phrases: phrases
      .map((p) => {
        const o = (p ?? {}) as Record<string, unknown>;
        return { text: cleanText(o.text), count: cleanCount(o.count) };
      })
      .filter((p) => p.text)
      .slice(0, 500),
  };
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    throw new Error('This file could not be read (it is not valid JSON).');
  }
}
