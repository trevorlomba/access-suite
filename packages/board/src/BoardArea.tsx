import { useState, type ReactNode } from 'react';
import { BigButton, ScanGroup, useSettings } from '@access-suite/access-ui';
import { CELL_GAP, GROUP_PAD, fitCount, useBox } from './fit';

export interface Tab {
  id: string;
  label: string;
  tone?: { bg: string; fg: string };
}

/** Tabs are at least this many button-sizes wide, and never narrower than labels like "Questions". */
const TAB_WIDTH = 1.6;
const TAB_MIN_PX = 108;
/** At most this many columns of tabs down the side before they page (more when the board is short). */
const railCols = (rows: number) => (rows <= 2 ? 3 : 2);

/**
 * The part of a tool below the message: optional strips on top (pronouns,
 * quick replies), then category tabs beside (landscape) or above (portrait)
 * the board itself, which fills whatever height is left.
 */
export function BoardArea({
  heading,
  top,
  tabs,
  active,
  onSelect,
  children,
}: {
  heading: string;
  top?: ReactNode;
  /** Null while something stands in for the whole board (the AI panel): no tabs. */
  tabs: Tab[] | null;
  active: string | null;
  onSelect: (id: string) => void;
  children: ReactNode;
}) {
  const [ref, box] = useBox<HTMLElement>();
  // Tabs go down the side when there's width to spare, which is where
  // landscape screens (laptops, mounted tablets) have room; else across the top.
  const side = !box || box.width >= Math.max(720, box.height * 1.15);
  return (
    <section ref={ref} className="board-area" aria-labelledby="board-heading">
      <h2 id="board-heading" className="visually-hidden">
        {heading}
      </h2>
      {top}
      <div className={`board-area__body ${side ? 'board-area__body--side' : 'board-area__body--top'}`}>
        {tabs && <TabRail tabs={tabs} active={active} onSelect={onSelect} side={side} />}
        <div className="board-area__main">{children}</div>
      </div>
    </section>
  );
}

function TabRail({ tabs, active, onSelect, side }: { tabs: Tab[]; active: string | null; onSelect: (id: string) => void; side: boolean }) {
  const { settings } = useSettings();
  const target = settings.targetSize;
  const tabWidth = Math.max(target * TAB_WIDTH, TAB_MIN_PX);
  const [ref, box] = useBox<HTMLDivElement>();
  const [page, setPage] = useState(0);

  let cols: number;
  let perPage = tabs.length;
  if (!box) {
    cols = side ? 1 : tabs.length;
  } else if (side) {
    const rows = fitCount(box.height - 2 * GROUP_PAD, target, CELL_GAP);
    cols = Math.min(railCols(rows), Math.ceil(tabs.length / rows));
    if (tabs.length > rows * cols) perPage = rows * cols - 1;
  } else {
    cols = fitCount(box.width - 2 * GROUP_PAD, tabWidth, CELL_GAP);
    if (tabs.length > cols) perPage = cols - 1;
  }
  const pages = Math.ceil(tabs.length / Math.max(1, perPage));
  const p = page % pages;
  const shown = tabs.slice(p * perPage, (p + 1) * perPage);

  return (
    <div ref={ref} className={`rail ${side ? 'rail--side' : 'rail--top'}`}>
      <ScanGroup
        label="Word categories"
        className="rail__tabs"
        style={
          side
            ? { gridTemplateColumns: `repeat(${cols}, ${tabWidth}px)`, gridTemplateRows: `repeat(${Math.ceil((shown.length + (pages > 1 ? 1 : 0)) / cols)}, auto)` }
            : { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }
        }
      >
        {shown.map((t) => {
          const on = t.id === active;
          return (
            <BigButton
              key={t.id}
              className="tab"
              tone={on ? undefined : t.tone}
              variant={on ? 'primary' : 'default'}
              aria-pressed={on}
              onClick={() => onSelect(t.id)}
            >
              {t.label}
            </BigButton>
          );
        })}
        {pages > 1 && (
          <BigButton className="tab tile-more" aria-label={`More categories, page ${p + 1} of ${pages}`} onClick={() => setPage(p + 1)}>
            More ▶<span className="tile-more__page">{`${p + 1}/${pages}`}</span>
          </BigButton>
        )}
      </ScanGroup>
    </div>
  );
}
