import { useState } from 'react';
import { BigButton } from '@access-suite/access-ui';
import { TileGrid } from './WordRows';

/** Saved phrases as a board page: tap one to speak it. */
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

  if (saved.length === 0) return <p className="muted">Build a message and press ★ Save to keep it here.</p>;

  return (
    <TileGrid
      items={saved}
      label="Saved phrases"
      name={(p) => p}
      size="phrase"
      lead={[
        <BigButton key="edit" variant="quiet" aria-pressed={editing} onClick={() => setEditing((e) => !e)}>
          {editing ? 'Done' : 'Edit'}
        </BigButton>,
      ]}
      render={(p) =>
        editing ? (
          <BigButton variant="danger" className="phrase-tile" onClick={() => onRemove(p)} aria-label={`Delete saved phrase: ${p}`}>
            ✕ {p}
          </BigButton>
        ) : (
          <BigButton className="phrase-tile" onClick={() => onSpeak(p)}>
            {p}
          </BigButton>
        )
      }
    />
  );
}
