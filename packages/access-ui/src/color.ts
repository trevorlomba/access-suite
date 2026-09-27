/**
 * Word-tile colors follow the Modified Fitzgerald Key, the convention most AAC
 * systems use so that a word's color hints at its part of speech.
 *
 * Text color is chosen per background by WCAG relative luminance (the
 * speech-assist `getTextColor` idea, made standards-based).
 */
export type WordKind =
  | 'pronoun'
  | 'verb'
  | 'descriptor'
  | 'noun'
  | 'social'
  | 'question'
  | 'misc';

export const KIND_COLORS: Record<WordKind, string> = {
  pronoun: '#FFE066', // yellow — people & pronouns
  verb: '#9FE2A0', // green — actions
  descriptor: '#9CCBF5', // blue — describing words
  noun: '#FFC48C', // orange — things
  social: '#F6A9C9', // pink — social words
  question: '#CDB5F2', // purple — questions
  misc: '#E6E6E6', // gray — little words
};

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Black or white, whichever reads better on `bg`. */
export function textColorFor(bg: string): '#000000' | '#FFFFFF' {
  return contrastRatio(bg, '#000000') >= contrastRatio(bg, '#FFFFFF') ? '#000000' : '#FFFFFF';
}
