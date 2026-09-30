import { useEffect, useRef, useState } from 'react';
import { BigButton } from '@access-suite/access-ui';
import { TileGrid } from './WordRows';
import { AiError, INTENTS, generate, type Intent, type ProviderConfig } from '@access-suite/ai';

type Status = { kind: 'idle' } | { kind: 'loading'; intent: Intent } | { kind: 'error'; message: string };

/**
 * Pick an intent → get up to 3 full sentences → select one to speak it.
 * Only rendered when an AI provider is configured.
 */
export function Suggestions({
  config,
  words,
  context,
  onChoose,
  onBack,
}: {
  config: ProviderConfig;
  words: string[];
  /** What was just said to the user; lets suggestions answer it, even before any word is picked. */
  context?: string;
  onChoose: (sentence: string) => void;
  /** Return to the word board (the panel takes the board's place while open). */
  onBack?: () => void;
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
      const out = await generate(config, { words, intent, n: 3, context }, { signal: ac.signal });
      if (ac.signal.aborted) return;
      setResults(out);
      setStatus({ kind: 'idle' });
    } catch (err) {
      if (err instanceof AiError && err.code === 'aborted') return;
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : 'Something went wrong.' });
    }
  };

  const disabled = words.length === 0 && !context;

  return (
    <section className="suggest" aria-labelledby="suggest-heading">
      <h2 id="suggest-heading" className="visually-hidden">
        Make it a sentence
      </h2>
      <TileGrid
        items={INTENTS}
        label="Make it a sentence: choose a type"
        name={(i) => i.label}
        fill={false}
        maxRows={2}
        lead={
          onBack
            ? [
                <BigButton key="back" variant="quiet" onClick={onBack}>
                  ◀ Words
                </BigButton>,
              ]
            : []
        }
        render={(i) => (
          <BigButton onClick={() => run(i.id)} disabled={disabled} aria-pressed={status.kind === 'loading' && status.intent === i.id}>
            {i.label}
          </BigButton>
        )}
      />
      <div aria-live="polite" className="suggest__status">
        {config.provider === 'demo' && <span className="badge">demo</span>}{' '}
        {disabled && <span className="muted">Pick a word or two first.</span>}
        {!disabled && words.length === 0 && status.kind === 'idle' && results.length === 0 && (
          <span className="muted">Choose a type to get replies, or pick words first to steer them.</span>
        )}
        {!disabled && words.length > 0 && status.kind === 'idle' && results.length === 0 && (
          <span className="muted">Choose a type of sentence.</span>
        )}
        {status.kind === 'loading' && <span>Thinking…</span>}
        {status.kind === 'error' && <span className="error">{status.message}</span>}
        {results.length > 0 && <span className="visually-hidden">{results.length} suggestions ready.</span>}
      </div>
      {results.length > 0 && (
        <TileGrid
          items={results}
          label="Suggested sentences"
          name={(r) => r}
          size="phrase"
          render={(r) => (
            <BigButton className="suggestion" onClick={() => onChoose(r)}>
              {r}
            </BigButton>
          )}
        />
      )}
    </section>
  );
}
