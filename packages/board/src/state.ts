import { useCallback, useEffect, useState } from 'react';
import { STORAGE_PREFIX, readJSON, writeJSON } from '@access-suite/access-ui';

// ---- Message being composed -------------------------------------------------

export interface Token {
  id: number;
  text: string;
}

export type MessageAction =
  | { type: 'add'; text: string }
  | { type: 'remove'; index: number }
  | { type: 'move'; index: number; by: -1 | 1 }
  | { type: 'backspace' }
  | { type: 'clear' };

let nextId = 1;

export function messageReducer(state: Token[], action: MessageAction): Token[] {
  switch (action.type) {
    case 'add':
      return [...state, { id: nextId++, text: action.text }];
    case 'remove':
      return state.filter((_, i) => i !== action.index);
    case 'move': {
      const to = action.index + action.by;
      if (to < 0 || to >= state.length) return state;
      const copy = state.slice();
      [copy[action.index], copy[to]] = [copy[to]!, copy[action.index]!];
      return copy;
    }
    case 'backspace':
      return state.slice(0, -1);
    case 'clear':
      return [];
  }
}

export function messageText(tokens: Token[]): string {
  const text = tokens.map((t) => t.text).join(' ').replace(/\s+([?!.,])/g, '$1');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---- Word frequency (learned locally) ---------------------------------------

const FREQ_KEY = `${STORAGE_PREFIX}board:freq`;
export type Frequencies = Record<string, number>;

export function recordUse(freq: Frequencies, words: string[]): Frequencies {
  const next = { ...freq };
  for (const w of words) {
    const k = w.toLowerCase();
    next[k] = (next[k] ?? 0) + 1;
  }
  return next;
}

/**
 * Font scale for a word: frequently used words grow (up to 1.45×) so they are
 * easier to find — the gpt-access word-cloud idea. Log-scaled so one heavy
 * word doesn't flatten everything else. Never shrinks below 1×.
 */
export function freqScale(freq: Frequencies, word: string): number {
  const max = Math.max(0, ...Object.values(freq));
  const n = freq[word.toLowerCase()] ?? 0;
  if (max === 0 || n === 0) return 1;
  return 1 + 0.45 * (Math.log1p(n) / Math.log1p(max));
}

export function useFrequencies() {
  const [freq, setFreq] = useState<Frequencies>(() => readJSON(FREQ_KEY, {}));
  useEffect(() => writeJSON(FREQ_KEY, freq), [freq]);
  const record = useCallback((words: string[]) => setFreq((f) => recordUse(f, words)), []);
  return { freq, record };
}

// ---- Saved phrases ------------------------------------------------------------

const SAVED_KEY = `${STORAGE_PREFIX}board:saved`;
const DEFAULT_SAVED = ['Yes', 'No', 'I need help', 'Please wait, I am typing', 'Thank you'];

export function useSavedPhrases() {
  const [saved, setSaved] = useState<string[]>(() => readJSON(SAVED_KEY, DEFAULT_SAVED));
  useEffect(() => writeJSON(SAVED_KEY, saved), [saved]);
  const add = useCallback(
    (p: string) => setSaved((s) => (s.some((x) => x.toLowerCase() === p.toLowerCase()) ? s : [...s, p])),
    [],
  );
  const remove = useCallback((p: string) => setSaved((s) => s.filter((x) => x !== p)), []);
  return { saved, add, remove };
}
