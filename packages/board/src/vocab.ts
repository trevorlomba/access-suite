import type { WordKind } from '@access-suite/access-ui';

export interface Word {
  text: string;
  kind: WordKind;
}

export interface Category {
  id: string;
  label: string;
  kind: WordKind;
  words: Word[];
}

const w = (kind: WordKind, list: string) =>
  list.split('|').map((text) => ({ text: text.trim(), kind }));

/** Always visible above the board: pronouns start most sentences. */
export const PRONOUNS: Word[] = w('pronoun', 'I|you|we|he|she|they|it|me|my|your');

/**
 * Generic starter vocabulary: high-frequency AAC core words plus common
 * needs for someone with limited mobility. No personal data. Personal words
 * come later from the Vocabulary Builder.
 */
export const CATEGORIES: Category[] = [
  {
    id: 'core',
    label: 'Core',
    kind: 'verb',
    words: [
      ...w('verb', 'want|need|like|go|stop|help|have|get|feel|look|come|make|do|can|is|am|are|finish'),
      ...w('misc', 'not|more|again|that|this|here|there|and|to|with|for|in|on|all|now'),
      ...w('social', 'yes|no|please'),
    ],
  },
  {
    id: 'people',
    label: 'People',
    kind: 'pronoun',
    words: w('pronoun', 'mom|dad|family|friend|nurse|doctor|caregiver|therapist|husband|wife|partner|son|daughter|brother|sister|everyone|someone|visitor'),
  },
  {
    id: 'needs',
    label: 'Needs',
    kind: 'noun',
    words: w('noun', 'water|food|drink|bathroom|medicine|bed|blanket|pillow|glasses|phone|TV|music|light|window|door|chair|wheelchair|shower|toothbrush|tissue|air|pain relief|position'),
  },
  {
    id: 'feelings',
    label: 'Feelings',
    kind: 'descriptor',
    words: w('descriptor', 'happy|sad|tired|hurt|in pain|sick|hot|cold|scared|worried|angry|bored|frustrated|comfortable|uncomfortable|okay|better|worse|hungry|thirsty|lonely|excited'),
  },
  {
    id: 'actions',
    label: 'Actions',
    kind: 'verb',
    words: w('verb', 'eat|drink|sleep|rest|sit up|lie down|turn|move|open|close|turn on|turn off|call|read|watch|listen|talk|wait|change|wash|brush|clean|scratch|adjust'),
  },
  {
    id: 'describe',
    label: 'Describe',
    kind: 'descriptor',
    words: w('descriptor', 'big|little|fast|slow|loud|quiet|less|too much|not enough|left|right|up|down|soon|later|today|tonight|tomorrow|yesterday|very|a little'),
  },
  {
    id: 'questions',
    label: 'Questions',
    kind: 'question',
    words: w('question', 'what|where|when|who|why|how|which|how long|can you|will you|is it|what time|what happened'),
  },
  {
    id: 'social',
    label: 'Social',
    kind: 'social',
    words: w('social', "hello|goodbye|thank you|sorry|I love you|good morning|good night|how are you|excuse me|just a moment|I don't know|I agree|I disagree|that's funny|maybe|of course"),
  },
];

/** Every word once (first occurrence wins), for letter filtering across the board. */
export function allWords(extra: Word[] = []): Word[] {
  const seen = new Set<string>();
  const out: Word[] = [];
  for (const word of [...extra, ...PRONOUNS, ...CATEGORIES.flatMap((c) => c.words)]) {
    const k = word.text.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(word);
    }
  }
  return out;
}

/** `extra` (e.g. the user's own words) is searched too, and wins on duplicates. */
export function wordsStartingWith(letter: string, extra: Word[] = []): Word[] {
  const l = letter.toLowerCase();
  return allWords(extra)
    .filter((x) => x.text.toLowerCase().startsWith(l))
    .sort((a, b) => a.text.localeCompare(b.text));
}

export const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
