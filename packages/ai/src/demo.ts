import type { Adapter, Intent } from './types';

const FUNCTION_WORDS = new Set(
  'i|you|we|he|she|they|it|me|my|your|want|need|like|have|get|can|is|am|are|do|please|to'.split('|'),
);

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const TEMPLATES: Record<Intent, ((p: string) => string)[]> = {
  statement: [(p) => `${cap(p)}.`, (p) => `I would like ${p}, please.`, (p) => `I want to tell you about ${p}.`],
  question: [(p) => `Can I have ${p}?`, (p) => `What about ${p}?`, (p) => `Could you help me with ${p}?`],
  yes: [(p) => `Yes, ${p}.`, (p) => `Yes please, ${p}.`, () => 'Yes, that sounds good.'],
  no: [(p) => `No, not ${p}.`, () => 'No, thank you.', () => 'Not right now, maybe later.'],
  casual: [(p) => `Hey! ${cap(p)}.`, (p) => `I've been thinking about ${p}.`, (p) => `How about ${p}?`],
};

// Replies to something that was said, when the user hasn't picked any words.
const REPLY_ONLY: Record<Intent, string[]> = {
  statement: ['Okay.', 'I understand.', 'Tell me more.'],
  question: ['Can you say that again?', 'What do you mean?', 'When?'],
  yes: ['Yes.', 'Yes, please.', 'Yes, that sounds good.'],
  no: ['No.', 'No, thank you.', 'Not right now.'],
  casual: ['Ha, really?', 'That’s nice.', 'Oh, okay.'],
};

/**
 * Canned, deterministic suggestions: lets people try the flow with no key and
 * no network, and gives tests a stable adapter. Clearly labelled as a demo.
 */
export const demoAdapter: Adapter = async (_cfg, _prompt, req, signal) => {
  await new Promise((r) => setTimeout(r, 250));
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  if (req.words.length === 0) return JSON.stringify(REPLY_ONLY[req.intent]);
  // Templates supply their own "I / can I have", so drop pronouns and helper
  // verbs: "I want water" → "water" → "Can I have water?".
  const content = req.words.filter((w) => !FUNCTION_WORDS.has(w.toLowerCase()));
  const phrase = (content.length ? content : req.words).join(' ').trim() || 'that';
  return JSON.stringify(TEMPLATES[req.intent].map((t) => t(phrase)));
};
