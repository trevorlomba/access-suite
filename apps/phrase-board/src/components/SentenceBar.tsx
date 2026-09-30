import { BigButton, ScanGroup } from '@access-suite/access-ui';
import type { MessageAction, Token } from '../state';

export function SentenceBar({
  tokens,
  selected,
  onSelect,
  dispatch,
  onSpeak,
  onSave,
  canSpeak,
}: {
  tokens: Token[];
  selected: number | null;
  onSelect: (i: number | null) => void;
  dispatch: (a: MessageAction) => void;
  onSpeak: () => void;
  onSave: () => void;
  canSpeak: boolean;
}) {
  const empty = tokens.length === 0;
  const sel = selected != null && selected < tokens.length ? selected : null;

  return (
    <section className="sentence" aria-labelledby="sentence-heading">
      <h2 id="sentence-heading" className="visually-hidden">
        Your message
      </h2>
      <div className="sentence__display">
        {empty ? (
          <p className="sentence__placeholder">Choose words below to build a message.</p>
        ) : (
          <ScanGroup label="Message words (select one to move or remove it)" className="sentence__words">
            {tokens.map((t, i) => (
              <button
                key={t.id}
                type="button"
                className="chip"
                aria-pressed={sel === i}
                aria-label={`${t.text}, word ${i + 1} of ${tokens.length}`}
                onClick={() => onSelect(sel === i ? null : i)}
              >
                {t.text}
              </button>
            ))}
          </ScanGroup>
        )}
      </div>

      {sel != null && (
        <ScanGroup label={`Edit word “${tokens[sel]!.text}”`} className="sentence__edit">
          <BigButton
            onClick={() => {
              dispatch({ type: 'move', index: sel, by: -1 });
              onSelect(sel - 1);
            }}
            disabled={sel === 0}
          >
            ◀ Move left
          </BigButton>
          <BigButton
            onClick={() => {
              dispatch({ type: 'move', index: sel, by: 1 });
              onSelect(sel + 1);
            }}
            disabled={sel === tokens.length - 1}
          >
            Move right ▶
          </BigButton>
          <BigButton
            variant="danger"
            onClick={() => {
              dispatch({ type: 'remove', index: sel });
              onSelect(null);
            }}
          >
            Remove
          </BigButton>
          <BigButton variant="quiet" onClick={() => onSelect(null)}>
            Done
          </BigButton>
        </ScanGroup>
      )}

      <ScanGroup label="Message actions" className="sentence__actions">
        <BigButton variant="primary" className="speak-btn" onClick={onSpeak} disabled={empty || !canSpeak}>
          🔊 Speak
        </BigButton>
        <BigButton onClick={() => dispatch({ type: 'backspace' })} disabled={empty} aria-label="Delete last word">
          ⌫ Delete
        </BigButton>
        <BigButton onClick={() => dispatch({ type: 'clear' })} disabled={empty}>
          Clear
        </BigButton>
        <BigButton onClick={onSave} disabled={empty}>
          ★ Save
        </BigButton>
      </ScanGroup>
    </section>
  );
}
