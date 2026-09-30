import { describe, expect, it } from 'vitest';
import { CELL_GAP, GROUP_PAD, ROW_GAP, fitCount, planGrid } from './fit';

const tile = { minWidth: 115, minHeight: 72, fill: true };

/** The smallest a tile gets in a plan, given the box it fills. */
function tileSize(box: { width: number; height: number }, cols: number, rows: number) {
  return {
    width: (box.width - 2 * GROUP_PAD - (cols - 1) * CELL_GAP) / cols,
    height: (box.height - (rows - 1) * ROW_GAP) / rows - 2 * GROUP_PAD,
  };
}

describe('fitCount', () => {
  it('counts whole items with gaps between them, and at least one', () => {
    expect(fitCount(100, 45, 10)).toBe(2);
    expect(fitCount(99, 45, 10)).toBe(1);
    expect(fitCount(10, 45, 10)).toBe(1);
  });
});

describe('planGrid', () => {
  it('never makes tiles smaller than the button size, at any box or button size', () => {
    for (const target of [48, 72, 96, 140]) {
      for (const [width, height] of [[1100, 450], [380, 300], [800, 900], [2000, 1200]] as const) {
        const box = { width, height };
        const plan = planGrid(36, box, { minWidth: target * 1.6, minHeight: target, fill: true });
        const size = tileSize(box, plan.cols, plan.rows);
        expect(size.width, `${target}px in ${width}×${height}`).toBeGreaterThanOrEqual(target * 1.6);
        expect(size.height, `${target}px in ${width}×${height}`).toBeGreaterThanOrEqual(target);
      }
    }
  });

  it('shows everything on one page when it fits, keeping every row it has room for', () => {
    const plan = planGrid(20, { width: 1000, height: 500 }, tile);
    expect(plan.pages).toBe(1);
    expect(plan.cols).toBe(8);
    expect(plan.rows).toBe(6); // not 3: the tiles stay the same size across categories
  });

  it('pages instead of shrinking, keeping the last cell for More', () => {
    const plan = planGrid(36, { width: 380, height: 330 }, tile);
    expect(plan).toEqual({ cols: 3, rows: 4, perPage: 11, pages: 4 });
  });

  it('leaves room for fixed lead tiles on every page', () => {
    const plan = planGrid(30, { width: 380, height: 330 }, { ...tile, lead: 1 });
    expect(plan.perPage).toBe(10);
  });

  it('sizes a strip to its content, up to maxRows', () => {
    expect(planGrid(10, { width: 1000, height: 0 }, { minWidth: 72, minHeight: 72, maxRows: 1 })).toEqual({
      cols: 12,
      rows: 1,
      perPage: 10,
      pages: 1,
    });
    expect(planGrid(10, { width: 380, height: 0 }, { minWidth: 72, minHeight: 72, maxRows: 1 })).toEqual({
      cols: 4,
      rows: 1,
      perPage: 3,
      pages: 4,
    });
  });

  it('keeps a cell for an item and one for More, even in a box that holds one tile', () => {
    expect(planGrid(3, { width: 200, height: 100 }, tile)).toEqual({ cols: 1, rows: 2, perPage: 1, pages: 3 });
  });

  it('shows everything when nothing has been measured', () => {
    expect(planGrid(10, null, { minWidth: 72, minHeight: 72, maxRows: 1 })).toMatchObject({ cols: 10, rows: 1, pages: 1 });
  });
});

describe('tileMin', () => {
  it('is the button size, or bigger when the label needs it, never smaller', async () => {
    const { tileMin } = await import('./WordRows');
    expect(tileMin('word', 72)).toEqual({ width: 115.2, height: 72 });
    expect(tileMin('word', 48)).toEqual({ width: 112, height: 64 }); // room for two lines
    expect(tileMin('short', 48)).toEqual({ width: 72, height: 48 });
    expect(tileMin('phrase', 140).width).toBeCloseTo(308);
    expect(tileMin('phrase', 140).height).toBe(140);
  });
});
