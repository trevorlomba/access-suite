import { useEffect, useState } from 'react';
import type { WordKind } from '@access-suite/access-ui';
import { VOCAB_STORAGE_KEY, parseVocabulary, type VocabCategory, type VocabularyFile } from '@access-suite/vocab/schema';
import type { Category } from './vocab';

const KIND: Record<VocabCategory, WordKind> = {
  people: 'pronoun',
  things: 'noun',
  actions: 'verb',
  describe: 'descriptor',
  other: 'misc',
};

export function loadMyVocabulary(): VocabularyFile | null {
  try {
    const raw = window.localStorage.getItem(VOCAB_STORAGE_KEY);
    return raw ? parseVocabulary(raw) : null;
  } catch {
    return null;
  }
}

/**
 * The personal vocabulary saved by the Vocabulary Builder on this device, kept
 * in sync if it changes in another tab.
 */
export function useMyVocabulary(): VocabularyFile | null {
  const [vocab, setVocab] = useState<VocabularyFile | null>(loadMyVocabulary);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === VOCAB_STORAGE_KEY || e.key === null) setVocab(loadMyVocabulary());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return vocab;
}

/** "My words" as a board category: people first, then by how often they're used. */
export function vocabCategory(vocab: VocabularyFile | null): Category | null {
  if (!vocab || vocab.words.length === 0) return null;
  const order: VocabCategory[] = ['people', 'things', 'actions', 'describe', 'other'];
  const words = vocab.words
    .slice()
    .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || b.count - a.count)
    .map((w) => ({ text: w.text, kind: KIND[w.category] }));
  return { id: 'mine', label: 'My words', kind: 'pronoun', words };
}
