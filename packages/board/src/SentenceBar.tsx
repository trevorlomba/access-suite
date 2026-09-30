import { useEffect, useRef, type ReactNode } from 'react';
import { BigButton, ScanGroup } from '@access-suite/access-ui';
import type { MessageAction, Token } from './state';

export function SentenceBar({
  tokens,
  selected,
  onSelect,
  dispatch,
  onSpeak,
  onSave,
  onSuggest,
  whenEmpty,
  canSpeak,
}: {
  tokens: Token[];
  selected: number | null;
  onSelect: (i: number | null) => void;
  dispatch: (a: MessageAction) => void;
  onSpeak: () => void;
  onSave: () => void;
  /** Opens "Make it a sentence"; the button only shows when AI is set up. */
  onSuggest?: { open: () => void; disabled: boolean };
  /** Shown in the message's place while it's empty (e.g. quick replies), in place of the hint and the buttons that need a message. */
  whenEmpty?: ReactNode;
  canSpeak: boolean;
}) {
  const empty = tokens.length === 0;
  const sel = selected != null && selected < tokens.length ? selected : null;
  // The message is one line that scrolls sideways inside itself, so the page
  // never grows; keep the newest word in view.
  const display = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = display.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [tokens.length]);

  return (
    <section className="sentence" aria-labelledby="sentence-heading">
      <h2 id="sentence-heading" className="visually-hidden">
        Your message
      </h2>
      <div ref={display} className="sentence__display">
        {empty ? (
          (whenEmpty ?? <p className="sentence__placeholder">Choose words below to build a message.</p>)
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

      {/* On its own so it sits beside the message on narrow screens, and so
          switch users reach it in one step. */}
      {!(empty && whenEmpty) && (
        <ScanGroup label="Speak" className="sentence__speak">
          <BigButton variant="primary" className="speak-btn" onClick={onSpeak} disabled={empty || !canSpeak}>
            🔊 Speak
          </BigButton>
        </ScanGroup>
      )}

      {sel != null ? (
        <ScanGroup label={`Edit word “${tokens[sel]!.text}”`} className="sentence__actions sentence__edit">
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
      ) : (
        (onSuggest || !(empty && whenEmpty)) && (
          <ScanGroup label="Message actions" className="sentence__actions">
            {onSuggest && (
              <BigButton onClick={onSuggest.open} disabled={onSuggest.disabled} aria-label="Make it a sentence">
                ✨<span className="wide-only"> Sentence</span>
              </BigButton>
            )}
            {/* With something in the message's place (quick replies), these give it the room until there's a message to act on. */}
            {!(empty && whenEmpty) && (
              <>
                <BigButton onClick={() => dispatch({ type: 'backspace' })} disabled={empty} aria-label="Delete last word">
                  ⌫<span className="wide-only"> Delete</span>
                </BigButton>
                <BigButton onClick={() => dispatch({ type: 'clear' })} disabled={empty}>
                  Clear
                </BigButton>
                <BigButton onClick={onSave} disabled={empty} aria-label="Save">
                  ★<span className="wide-only"> Save</span>
                </BigButton>
              </>
            )}
          </ScanGroup>
        )
      )}
    </section>
  );
}
