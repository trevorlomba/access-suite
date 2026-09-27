import { useState } from 'react';
import { BigButton, Dialog, ScanGroup } from './components';

// Alphabetical rows scan faster than QWERTY for switch users who don't touch-type.
const ROWS = ['abcdef', 'ghijkl', 'mnopqr', 'stuvwx', "yz'-?!"];

export interface OnScreenKeyboardProps {
  open: boolean;
  title?: string;
  submitLabel?: string;
  onSubmit: (text: string) => void;
  onClose: () => void;
}

/** A scannable, dwell-friendly letter board for typing words that aren't on the board. */
export function OnScreenKeyboard({
  open,
  title = 'Type a word',
  submitLabel = 'Add',
  onSubmit,
  onClose,
}: OnScreenKeyboardProps) {
  const [text, setText] = useState('');

  const close = () => {
    setText('');
    onClose();
  };
  const submit = () => {
    const t = text.trim();
    if (t) onSubmit(t);
    close();
  };

  return (
    <Dialog open={open} title={title} onClose={close}>
      <output className="kbd-display" aria-live="polite" aria-label="Typed text">
        {text || <span className="muted">Start typing…</span>}
      </output>
      {ROWS.map((row) => (
        <ScanGroup key={row} label={`Letters ${row.split('').join(' ')}`} className="kbd-row">
          {row.split('').map((ch) => (
            <BigButton key={ch} className="kbd-key" onClick={() => setText((t) => t + ch)} aria-label={ch}>
              {ch.toUpperCase()}
            </BigButton>
          ))}
        </ScanGroup>
      ))}
      <ScanGroup label="Keyboard actions" className="kbd-row">
        <BigButton onClick={() => setText((t) => t + ' ')}>Space</BigButton>
        <BigButton onClick={() => setText((t) => t.slice(0, -1))} disabled={!text}>
          Delete
        </BigButton>
        <BigButton onClick={() => setText('')} disabled={!text}>
          Clear
        </BigButton>
        <BigButton variant="primary" onClick={submit} disabled={!text.trim()}>
          {submitLabel}
        </BigButton>
      </ScanGroup>
    </Dialog>
  );
}
