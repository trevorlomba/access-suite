import { useLayoutEffect, useRef, useState } from 'react';

// Spacing from board.css and access-ui's .scan-group; keep in sync.
/** Padding on each side of a scan group (room for the scan highlight). */
export const GROUP_PAD = 4;
/** Gap between tiles in a row (--gap). */
export const CELL_GAP = 10;
/** Gap between rows of tiles. */
export const ROW_GAP = 2;

export interface Box {
  width: number;
  height: number;
}

/** How many items of at least `min` px, separated by `gap`, fit in `space`. Never less than 1. */
export function fitCount(space: number, min: number, gap: number): number {
  return Math.max(1, Math.floor((space + gap) / (min + gap)));
}

export interface GridPlan {
  cols: number;
  rows: number;
  /** Items shown per page (one cell is kept for "More" when there are several pages). */
  perPage: number;
  pages: number;
}

export interface GridOptions {
  /** Smallest tile size in px. Tiles grow to fill the box but never shrink below this. */
  minWidth: number;
  minHeight: number;
  /** Fixed tiles shown first on every page (e.g. "◀ Letters"). */
  lead?: number;
  maxRows?: number;
  maxCols?: number;
  /** Size rows to the box's height (a board) rather than to the content (a strip). */
  fill?: boolean;
}

/**
 * Lay out `count` tiles in a box at the user's button size. When they don't all
 * fit, the last cell becomes "More" and the rest go on further pages: the
 * tiles never get smaller than the user's setting.
 *
 * Without a measured box (tests, first render), everything shows on one page.
 */
export function planGrid(count: number, box: Box | null, opts: GridOptions): GridPlan {
  const lead = opts.lead ?? 0;
  const total = count + lead;
  if (!box || box.width === 0) {
    const cols = Math.max(1, Math.min(total, Math.max(opts.maxCols ?? 6, Math.ceil(total / (opts.maxRows ?? Infinity)))));
    return { cols, rows: Math.max(1, Math.ceil(total / cols)), perPage: count, pages: 1 };
  }
  const cols = Math.min(opts.maxCols ?? Infinity, fitCount(box.width - 2 * GROUP_PAD, opts.minWidth, CELL_GAP));
  const fits = Math.min(
    opts.maxRows ?? Infinity,
    opts.fill ? fitCount(box.height, opts.minHeight + 2 * GROUP_PAD, ROW_GAP) : Infinity,
  );
  const needed = Math.max(1, Math.ceil(total / cols));
  if (needed <= fits) {
    // A board keeps every row it has room for, so tiles stay the same size
    // (and in the same place) from one category to the next.
    return { cols, rows: opts.fill ? fits : needed, perPage: count, pages: 1 };
  }
  // Paging needs a cell for an item and one for "More"; if the box can't
  // spare two, take another row and let the page scroll.
  const rows = fits * cols - lead >= 2 ? fits : Math.ceil((lead + 2) / cols);
  const perPage = Math.max(1, rows * cols - lead - 1);
  return { cols, rows, perPage, pages: Math.ceil(count / perPage) };
}

/** The content-box size of an element, kept current as it resizes. Null where ResizeObserver is missing. */
export function useBox<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [box, setBox] = useState<Box | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = (width: number, height: number) =>
      setBox((b) => (b && b.width === Math.round(width) && b.height === Math.round(height) ? b : { width: Math.round(width), height: Math.round(height) }));
    // Measure now, before the first paint, so the unmeasured layout never shows.
    // (The measured elements have no padding, so this is their content box.)
    update(el.clientWidth, el.clientHeight);
    const ro = new ResizeObserver(([entry]) => entry && update(entry.contentRect.width, entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, box] as const;
}
