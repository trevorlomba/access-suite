import Anthropic from '@anthropic-ai/sdk';
import { AiError, type Adapter } from './types';

// Haiku 4.5 rejects `output_config.effort`; the server-side refusal fallback is
// only sent to the Opus 5 / Fable 5 families it is documented for.
const supportsEffort = (model: string) => !model.startsWith('claude-haiku');
const supportsFallback = (model: string) => /^claude-(opus-5|fable-5)/.test(model);

/**
 * Calls Claude directly from the user's browser with the user's own key.
 * There is no project server: the key never leaves the device except to go to
 * api.anthropic.com. `dangerouslyAllowBrowser` is the SDK's explicit opt-in for
 * exactly this bring-your-own-key pattern.
 */
export const anthropicAdapter: Adapter = async (cfg, prompt, _req, signal) => {
  const client = new Anthropic({ apiKey: cfg.apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });
  const model = cfg.model;
  try {
    const response = await client.beta.messages.create(
      {
        model,
        max_tokens: 4000,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }],
        // Short replies matter more than depth here: keep latency low.
        ...(supportsEffort(model) ? { output_config: { effort: 'low' as const } } : {}),
        ...(supportsFallback(model)
          ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
          : {}),
      },
      { signal },
    );
    if (response.stop_reason === 'refusal') {
      throw new AiError('refused', 'The model declined to suggest a reply for these words.');
    }
    return response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n');
  } catch (err) {
    if (err instanceof AiError) throw err;
    if (err instanceof Anthropic.APIUserAbortError) throw new AiError('aborted', 'Request cancelled.');
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      throw new AiError('auth', 'Anthropic rejected the API key. Check it in Settings.');
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new AiError('rate_limit', 'Anthropic rate limit reached. Try again in a moment.');
    }
    if (err instanceof Anthropic.APIConnectionError) {
      throw new AiError('network', 'Could not reach Anthropic. Check your connection.');
    }
    if (err instanceof Anthropic.APIError) {
      throw new AiError('api', `Anthropic error ${err.status ?? ''}: ${err.message}`.trim());
    }
    throw err;
  }
};
