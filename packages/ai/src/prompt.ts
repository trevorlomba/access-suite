import type { GenerateRequest, Intent, Prompt } from './types';

// Merges the two earlier approaches: gpt-access (keywords → first-person
// sentence, pronoun-aware) and speech-assist (intent-shaped replies for talking
// with family, caregivers and clinicians).
export const SYSTEM_PROMPT = `You help a person who communicates with an AAC (augmentative and alternative communication) board because of a severe speech and motor impairment. Every selection costs them real effort, so they choose only a few key words. Your job is to offer complete sentences they might mean, so they can pick one and have it spoken aloud.

Write each option in the first person, as the user speaking. Use the selected words, respecting any pronouns they chose, and keep their order when it makes sense. Use plain, natural spoken English under 15 words, with no emoji. Do not add names, facts, or medical details the words don't imply. Make the options meaningfully different from one another.

Respond with only a JSON array of strings.`;

const INTENT_GUIDANCE: Record<Intent, string> = {
  statement: 'a plain statement or request',
  question: 'a question or a request phrased as a question',
  yes: 'an answer that means yes or agreement',
  no: 'an answer that politely means no or disagreement',
  casual: 'friendly, casual conversation',
};

export function buildPrompt(req: GenerateRequest): Prompt {
  const n = clampN(req.n);
  const words = req.words.map((w) => `"${w}"`).join(', ');
  const lines = [
    `Selected words, in order: ${words || '(none)'}`,
    `Intent: ${INTENT_GUIDANCE[req.intent]}`,
    `Number of options: ${n}`,
  ];
  if (req.context?.trim()) lines.unshift(`What was just said to them: "${req.context.trim()}"`);
  return { system: SYSTEM_PROMPT, user: lines.join('\n') };
}

export function clampN(n: number): number {
  return Math.min(3, Math.max(1, Math.round(n || 1)));
}

/**
 * Pull a list of sentences out of a model reply. Prefers a JSON array; falls
 * back to one-per-line (stripping bullets/numbering) so a slightly off-format
 * reply still helps the user instead of erroring.
 */
export function parseSuggestions(text: string, n: number): string[] {
  const max = clampN(n);
  const match = text.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const arr: unknown = JSON.parse(match[0]);
      if (Array.isArray(arr)) {
        return dedupe(arr.filter((x): x is string => typeof x === 'string')).slice(0, max);
      }
    } catch {
      // fall through to line parsing
    }
  }
  const lines = text
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/^"|"$/g, '').trim())
    .filter(Boolean);
  return dedupe(lines).slice(0, max);
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  return items
    .map((s) => s.trim())
    .filter((s) => {
      const k = s.toLowerCase();
      if (!s || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}
