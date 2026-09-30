import nlp from 'compromise';

/**
 * Turn what a conversation partner said into reply material:
 * - what kind of utterance it was (so we can offer instant replies),
 * - its words, in spoken order (the fastest reply reuses them),
 * - its multi-word noun phrases ("the doctor", "this afternoon") as one-tap buttons.
 *
 * Ported and simplified from speech-assist-app's phraseRecognition.js.
 * Browser speech recognition rarely adds punctuation, so question detection
 * leans on the first word rather than a trailing "?".
 */

export type UtteranceKind = 'yes-no-question' | 'question' | 'command' | 'statement';

export interface Utterance {
  text: string;
  kind: UtteranceKind;
  words: string[];
  phrases: string[];
}

const AUX_FIRST =
  /^(do|does|did|is|are|was|were|am|can|could|will|would|should|shall|may|might|have|has|had|want|need)\b/i;
const WH_FIRST = /^(what|where|when|who|whom|whose|why|how|which)\b/i;
const FILLERS = new Set(['um', 'uh', 'erm', 'hmm', 'mm', 'uhh', 'umm']);

export function classify(text: string): UtteranceKind {
  const t = text.trim().replace(/^(so|okay|ok|well|hey|and|but)[, ]+/i, '');
  if (WH_FIRST.test(t)) return 'question';
  if (AUX_FIRST.test(t)) return 'yes-no-question';
  if (t.endsWith('?')) return 'yes-no-question'; // "you want the TV on?"
  const doc = nlp(t);
  if (doc.questions().found) return 'question';
  // A sentence that opens with a bare verb ("look at me", "please open your eyes").
  if (doc.match('^(please|let)? #Infinitive').found) return 'command';
  return 'statement';
}

/** Distinct words in spoken order. Proper nouns and "I" keep their case. */
export function extractWords(text: string): string[] {
  const doc = nlp(text);
  const seen = new Set<string>();
  const out: string[] = [];
  doc.terms().forEach((term) => {
    const raw = term.text('normal').replace(/[^\p{L}\p{N}'-]/gu, '');
    if (!raw || FILLERS.has(raw)) return;
    const proper = term.has('#ProperNoun') || raw === 'i';
    const word = raw === 'i' ? 'I' : proper ? term.text('machine').replace(/[^\p{L}\p{N}'-]/gu, '') || raw : raw;
    const key = word.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(word);
  });
  return out;
}

/** Multi-word noun phrases, e.g. "the doctor", "this afternoon". */
export function extractPhrases(text: string, max = 6): string[] {
  const doc = nlp(text);
  const seen = new Set<string>();
  const out: string[] = [];
  const candidates = [...doc.nouns().out('array'), ...doc.match('#Date+').out('array')] as string[];
  for (const c of candidates) {
    const p = c.replace(/[.,!?;:]+$/g, '').trim();
    const k = p.toLowerCase();
    if (p.split(/\s+/).length < 2 || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
    if (out.length >= max) break;
  }
  return out;
}

export function analyzeUtterance(text: string): Utterance {
  const clean = text.trim();
  return { text: clean, kind: classify(clean), words: extractWords(clean), phrases: extractPhrases(clean) };
}

/** Instant replies that fit the kind of thing that was said. */
export function quickReplies(kind: UtteranceKind): string[] {
  switch (kind) {
    case 'yes-no-question':
      return ['Yes', 'No', 'Maybe', "I don't know"];
    case 'question':
      return ["I don't know", 'Let me think', 'Give me a moment'];
    case 'command':
      return ['Okay', 'Not now', 'Wait, please'];
    case 'statement':
      return ['Okay', 'I understand', 'Thank you'];
  }
}
