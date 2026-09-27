import { demoAdapter } from './demo';
import { buildPrompt, clampN, parseSuggestions } from './prompt';
import { AiError, type Adapter, type GenerateRequest, type ProviderConfig, type ProviderId } from './types';

export * from './types';
export { buildPrompt, parseSuggestions, SYSTEM_PROMPT } from './prompt';

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  needsKey: boolean;
  keyHint?: string;
  keyUrl?: string;
  defaultModel: string;
  models: { id: string; label: string }[];
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  demo: {
    id: 'demo',
    label: 'Demo (canned examples, no AI, no key)',
    needsKey: false,
    defaultModel: 'demo',
    models: [{ id: 'demo', label: 'Demo' }],
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic Claude (your API key)',
    needsKey: true,
    keyHint: 'sk-ant-…',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    defaultModel: 'claude-opus-5',
    models: [
      { id: 'claude-opus-5', label: 'Claude Opus 5 (best quality)' },
      { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 (balanced)' },
      { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (fastest, lowest cost)' },
    ],
  },
  openai: {
    id: 'openai',
    label: 'OpenAI (your API key)',
    needsKey: true,
    keyHint: 'sk-…',
    keyUrl: 'https://platform.openai.com/api-keys',
    defaultModel: 'gpt-4.1-mini',
    models: [
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
    ],
  },
};

// Provider SDKs load on first use, so people who never turn AI on never
// download them.
const ADAPTERS: Record<ProviderId, Adapter> = {
  demo: demoAdapter,
  anthropic: (...args) => import('./anthropic').then((m) => m.anthropicAdapter(...args)),
  openai: (...args) => import('./openai').then((m) => m.openaiAdapter(...args)),
};

/** True when the config is complete enough to make a request. */
export function isConfigured(cfg: Partial<ProviderConfig> | null | undefined): cfg is ProviderConfig {
  if (!cfg?.provider || !(cfg.provider in PROVIDERS)) return false;
  return !PROVIDERS[cfg.provider].needsKey || !!cfg.apiKey?.trim();
}

/**
 * Turn a few selected words into up to `n` full sentences.
 * `adapters` is injectable for tests.
 */
export async function generate(
  cfg: ProviderConfig,
  req: GenerateRequest,
  opts: { signal?: AbortSignal; adapters?: Partial<Record<ProviderId, Adapter>> } = {},
): Promise<string[]> {
  if (!isConfigured(cfg)) throw new AiError('auth', 'Add an API key in Settings to use AI suggestions.');
  if (req.words.length === 0 && !req.context?.trim()) return [];
  const adapter = opts.adapters?.[cfg.provider] ?? ADAPTERS[cfg.provider];
  const model = cfg.model || PROVIDERS[cfg.provider].defaultModel;
  let text: string;
  try {
    text = await adapter({ ...cfg, model }, buildPrompt(req), req, opts.signal);
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw new AiError('aborted', 'Request cancelled.');
    throw err;
  }
  const out = parseSuggestions(text, clampN(req.n));
  if (out.length === 0) throw new AiError('bad_response', 'No suggestions came back. Try different words.');
  return out;
}
