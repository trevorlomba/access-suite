import { useEffect, useRef, useState } from 'react';
import { BigButton, ScanGroup } from '@access-suite/access-ui';
import { AiError, INTENTS, generate, type Intent, type ProviderConfig } from '@access-suite/ai';

type Status = { kind: 'idle' } | { kind: 'loading'; intent: Intent } | { kind: 'error'; message: string };

/**
 * Pick an intent → get up to 3 full sentences → select one to speak it.
 * Only rendered when an AI provider is configured.
 */
export function Suggestions({
  config,
  words,
  onChoose,
}: {
  config: ProviderConfig;
  words: string[];
  onChoose: (sentence: string) => void;
}) {
  const [results, setResults] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  // The parent remounts this component (via `key`) whenever the selection
  // changes, which clears stale suggestions; cancel any request in flight.
  useEffect(() => () => abortRef.current?.abort(), []);

  const run = async (intent: Intent) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setStatus({ kind: 'loading', intent });
    setResults([]);
    try {
      const out = await generate(config, { words, intent, n: 3 }, { signal: ac.signal });
      if (ac.signal.aborted) return;
      setResults(out);
      setStatus({ kind: 'idle' });
    } catch (err) {
      if (err instanceof AiError && err.code === 'aborted') return;
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : 'Something went wrong.' });
    }
  };

  const disabled = words.length === 0;

  return (
    <section className="suggest" aria-labelledby="suggest-heading">
      <h2 id="suggest-heading" className="section-title">
        Make it a sentence {config.provider === 'demo' && <span className="badge">demo</span>}
      </h2>
      <ScanGroup label="Make it a sentence: choose a type" className="suggest__intents">
        {INTENTS.map((i) => (
          <BigButton
            key={i.id}
            onClick={() => run(i.id)}
            disabled={disabled}
            aria-pressed={status.kind === 'loading' && status.intent === i.id}
          >
            {i.label}
          </BigButton>
        ))}
      </ScanGroup>
      <div aria-live="polite" className="suggest__status">
        {disabled && <span className="muted">Pick a word or two first.</span>}
        {status.kind === 'loading' && <span>Thinking…</span>}
        {status.kind === 'error' && <span className="error">{status.message}</span>}
        {results.length > 0 && <span className="visually-hidden">{results.length} suggestions ready.</span>}
      </div>
      {results.length > 0 && (
        <ScanGroup label="Suggested sentences" layout="stack" className="suggest__results">
          {results.map((s) => (
            <BigButton key={s} className="suggestion" onClick={() => onChoose(s)}>
              {s}
            </BigButton>
          ))}
        </ScanGroup>
      )}
    </section>
  );
}
