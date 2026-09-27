import { AiError, type Adapter } from './types';

/** OpenAI Chat Completions via fetch, with the user's own key. */
export const openaiAdapter: Adapter = async (cfg, prompt, _req, signal) => {
  let res: Response;
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
      }),
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new AiError('aborted', 'Request cancelled.');
    throw new AiError('network', 'Could not reach OpenAI. Check your connection.');
  }
  if (res.status === 401 || res.status === 403) throw new AiError('auth', 'OpenAI rejected the API key. Check it in Settings.');
  if (res.status === 429) throw new AiError('rate_limit', 'OpenAI rate limit reached. Try again in a moment.');
  if (!res.ok) throw new AiError('api', `OpenAI error ${res.status}.`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== 'string') throw new AiError('bad_response', 'OpenAI returned an unexpected response.');
  return text;
};
