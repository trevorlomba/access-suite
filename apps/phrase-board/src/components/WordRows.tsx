import { useEffect, useState } from 'react';
import { BigButton, KIND_COLORS, ScanGroup, textColorFor, useSettings } from '@access-suite/access-ui';
import type { Word } from '../vocab';
import { freqScale, type Frequencies } from '../state';

/** Columns that fit the viewport at the user's button size (2–8). */
function useColumns(): number {
  const { settings } = useSettings();
  const calc = () => {
    // Board width: page minus gutters, minus the saved-phrases sidebar on wide screens (see app.css).
    const page = Math.min(window.innerWidth, 1400);
    const width = page - 32 - (window.innerWidth >= 1000 ? 320 : 0);
    return Math.max(2, Math.min(8, Math.floor(width / (settings.targetSize * 1.75))));
  };
  const [cols, setCols] = useState(calc);
  useEffect(() => {
    const onResize = () => setCols(calc());
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.targetSize]);
  return cols;
}

export function tone(word: Word) {
  const bg = KIND_COLORS[word.kind];
  return { bg, fg: textColorFor(bg) };
}

/**
 * A word grid rendered as rows, each its own scan group, so switch users scan
 * row → word instead of stepping through every word on the page.
 */
export function WordRows({
  words,
  label,
  freq,
  onPick,
}: {
  words: Word[];
  label: string;
  freq: Frequencies;
  onPick: (w: Word) => void;
}) {
  const cols = useColumns();
  const rows: Word[][] = [];
  for (let i = 0; i < words.length; i += cols) rows.push(words.slice(i, i + cols));

  if (words.length === 0) return <p className="muted">No words here yet.</p>;

  return (
    <div className="word-rows" role="group" aria-label={label}>
      {rows.map((row, r) => (
        <ScanGroup
          key={r}
          label={`${label}, row ${r + 1}: ${row.map((w) => w.text).join(', ')}`}
          className="word-row"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {row.map((word) => (
            <BigButton
              key={word.text}
              className="word-tile"
              tone={tone(word)}
              style={{ fontSize: `calc(1.1rem * ${freqScale(freq, word.text).toFixed(3)})` }}
              onClick={() => onPick(word)}
            >
              {word.text}
            </BigButton>
          ))}
        </ScanGroup>
      ))}
    </div>
  );
}
