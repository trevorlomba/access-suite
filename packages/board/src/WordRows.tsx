import { Fragment, useState, type ReactNode } from 'react';
import { BigButton, KIND_COLORS, ScanGroup, textColorFor, useSettings } from '@access-suite/access-ui';
import type { Word } from './vocab';
import { freqScale, type Frequencies } from './state';
import { planGrid, useBox } from './fit';

/**
 * Shrink long words a little on narrow grids so they don't break mid-word
 * ("comfortabl-e"), and phrases of three or more words so they fit a word
 * tile in three lines ("the physical therapist"). Never below 75%.
 */
export function fitScale(text: string, cols: number): number {
  const words = text.trim().split(/\s+/);
  const longest = Math.max(...words.map((w) => w.length));
  const fits = cols <= 3 ? 8 : 10; // characters that fit a tile comfortably
  const scale = longest <= fits ? 1 : Math.max(0.75, fits / longest);
  return words.length >= 3 ? Math.min(scale, 0.8) : scale;
}

export function tone(word: Word) {
  const bg = KIND_COLORS[word.kind];
  return { bg, fg: textColorFor(bg) };
}

/**
 * Smallest tile per kind of label. A tile is never smaller than the user's
 * button size (`width` is a multiple of it), nor smaller than its label needs
 * to be read whole at small button sizes (`minWidth`, `minHeight` in px):
 * both only ever make a tile bigger.
 */
export const TILE = {
  short: { width: 1, minWidth: 72, minHeight: 0 }, // pronouns, letters
  reply: { width: 1.3, minWidth: 100, minHeight: 0 }, // quick replies, up to two lines
  word: { width: 1.6, minWidth: 112, minHeight: 64 }, // up to two lines ("pain relief")
  phrase: { width: 2.2, minWidth: 160, minHeight: 96 }, // up to three lines
} as const;
export type TileSize = keyof typeof TILE;

export function tileMin(size: TileSize, target: number) {
  const t = TILE[size];
  return { width: Math.max(target * t.width, t.minWidth), height: Math.max(target, t.minHeight) };
}

export interface TileGridProps<T> {
  items: T[];
  label: string;
  /** An item's name, for the row labels that auditory scanning reads out. */
  name: (item: T) => string;
  render: (item: T, cols: number) => ReactNode;
  /** Fixed tiles at the start of every page. */
  lead?: ReactNode[];
  /** The kind of label, which sets the smallest tile (see TILE). */
  size?: TileSize;
  /** Fill the available height (a board) instead of sizing to the content (a strip). */
  fill?: boolean;
  maxRows?: number;
  empty?: ReactNode;
}

/**
 * Tiles in rows sized to the space available, each row its own scan group so
 * switch users scan row → tile. Tiles never shrink below the user's button
 * size: what doesn't fit goes on further pages behind a "More" tile, which
 * always sits in the last cell.
 */
export function TileGrid<T>({
  items,
  label,
  name,
  render,
  lead = [],
  size = 'word',
  fill = true,
  maxRows,
  empty,
}: TileGridProps<T>) {
  const { settings } = useSettings();
  const [ref, box] = useBox<HTMLDivElement>();
  const min = tileMin(size, settings.targetSize);
  const plan = planGrid(items.length, box, {
    minWidth: min.width,
    minHeight: min.height,
    lead: lead.length,
    maxRows,
    fill,
  });
  // The page resets when the grid shows something else.
  const [paging, setPaging] = useState({ label, page: 0 });
  const page = paging.label === label ? paging.page % plan.pages : 0;

  const cells: { node: ReactNode; name: string }[] = [
    ...lead.map((node) => ({ node, name: '' })),
    ...items.slice(page * plan.perPage, (page + 1) * plan.perPage).map((item) => ({ node: render(item, plan.cols), name: name(item) })),
  ];
  const slots = plan.rows * plan.cols;
  const blank = { node: null, name: '' };
  if (plan.pages > 1) {
    while (cells.length < slots - 1) cells.push(blank);
    cells.push({
      name: 'more',
      node: (
        <BigButton
          className="tile-more"
          aria-label={`More ${label}, page ${page + 1} of ${plan.pages}`}
          onClick={() => setPaging({ label, page: (page + 1) % plan.pages })}
        >
          More ▶<span className="tile-more__page">{`${page + 1}/${plan.pages}`}</span>
        </BigButton>
      ),
    });
  } else if (fill) {
    while (cells.length < slots) cells.push(blank);
  }

  const rows: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += plan.cols) rows.push(cells.slice(i, i + plan.cols));
  const single = rows.length === 1;

  const renderRow = (row: typeof cells, r: number) => {
    const style = { gridTemplateColumns: `repeat(${plan.cols}, minmax(0, 1fr))` };
    const content = row.map((c, i) => <Fragment key={`${i}-${c.name}`}>{c.node ?? <div className="tile-empty" />}</Fragment>);
    if (row.every((c) => c.node === null)) {
      return <div key={r} className="tile-row" style={style} />;
    }
    const names = row.map((c) => c.name).filter((n) => n && n !== 'more');
    return (
      <ScanGroup key={r} label={single ? label : `${label}, row ${r + 1}: ${names.join(', ')}`} className="tile-row" style={style}>
        {content}
      </ScanGroup>
    );
  };

  return (
    <div
      ref={ref}
      className={`tiles ${fill ? 'tiles--fill' : 'tiles--strip'}`}
      role={single || items.length + lead.length === 0 ? undefined : 'group'}
      aria-label={single ? undefined : label}
      style={fill ? { gridTemplateRows: `repeat(${rows.length}, minmax(${min.height + 8}px, 1fr))` } : undefined}
    >
      {items.length + lead.length === 0 ? empty : rows.map(renderRow)}
    </div>
  );
}

/** A grid of word tiles, color-coded by kind; words used more often get bigger text. */
export function WordRows({
  words,
  label,
  freq,
  onPick,
  lead,
  fill,
  maxRows,
  size,
}: {
  words: Word[];
  label: string;
  freq: Frequencies;
  onPick: (w: Word) => void;
} & Pick<TileGridProps<Word>, 'lead' | 'fill' | 'maxRows' | 'size'>) {
  return (
    <TileGrid
      items={words}
      label={label}
      name={(w) => w.text}
      lead={lead}
      fill={fill}
      maxRows={maxRows}
      size={size}
      empty={<p className="muted">No words here yet.</p>}
      render={(word, cols) => (
        <BigButton
          className="word-tile"
          tone={tone(word)}
          style={{ fontSize: `calc(1.1rem * ${(freqScale(freq, word.text) * fitScale(word.text, cols)).toFixed(3)})` }}
          onClick={() => onPick(word)}
        >
          {word.text}
        </BigButton>
      )}
    />
  );
}
