import { useState } from 'react';
import { BigButton, ScanGroup } from '@access-suite/access-ui';

export function SavedPhrases({
  saved,
  onSpeak,
  onRemove,
}: {
  saved: string[];
  onSpeak: (p: string) => void;
  onRemove: (p: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <section className="saved" aria-labelledby="saved-heading">
      <div className="section-head">
        <h2 id="saved-heading" className="section-title">
          Saved phrases
        </h2>
        {saved.length > 0 && (
          <ScanGroup label="Edit saved phrases">
            <BigButton variant="quiet" aria-pressed={editing} onClick={() => setEditing((e) => !e)}>
              {editing ? 'Done' : 'Edit'}
            </BigButton>
          </ScanGroup>
        )}
      </div>
      {saved.length === 0 ? (
        <p className="muted">Build a message and press ★ Save to keep it here.</p>
      ) : (
        <ScanGroup label="Saved phrases" layout="stack">
          {saved.map((p) =>
            editing ? (
              <BigButton key={p} variant="danger" onClick={() => onRemove(p)} aria-label={`Delete saved phrase: ${p}`}>
                ✕ {p}
              </BigButton>
            ) : (
              <BigButton key={p} className="saved__phrase" onClick={() => onSpeak(p)}>
                {p}
              </BigButton>
            ),
          )}
        </ScanGroup>
      )}
    </section>
  );
}
