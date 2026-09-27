export type Intent = 'statement' | 'question' | 'yes' | 'no' | 'casual';

export const INTENTS: { id: Intent; label: string }[] = [
  { id: 'statement', label: 'Say it' },
  { id: 'question', label: 'Ask it' },
  { id: 'yes', label: 'Yes…' },
  { id: 'no', label: 'No…' },
  { id: 'casual', label: 'Casual' },
];

export interface GenerateRequest {
  /** Selected words/phrases, in the order the user chose them. */
  words: string[];
  intent: Intent;
  /** How many alternatives to return (1–3). */
  n: number;
  /** Optional recent conversation, e.g. what a partner just said (Listen & Reply). */
  context?: string;
}

export type ProviderId = 'demo' | 'anthropic' | 'openai';

export interface ProviderConfig {
  provider: ProviderId;
  apiKey: string;
  model: string;
}

export type AiErrorCode = 'auth' | 'rate_limit' | 'network' | 'refused' | 'bad_response' | 'aborted' | 'api';

export class AiError extends Error {
  constructor(
    readonly code: AiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

export interface Prompt {
  system: string;
  user: string;
}

export type Adapter = (cfg: ProviderConfig, prompt: Prompt, req: GenerateRequest, signal?: AbortSignal) => Promise<string>;
