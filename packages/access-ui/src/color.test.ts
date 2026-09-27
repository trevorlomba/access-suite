import { describe, expect, it } from 'vitest';
import { KIND_COLORS, contrastRatio, textColorFor } from './color';

describe('color', () => {
  it('computes known contrast ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 1);
  });

  it('picks readable text colors', () => {
    expect(textColorFor('#FFFFFF')).toBe('#000000');
    expect(textColorFor('#1A1A1A')).toBe('#FFFFFF');
  });

  it('every word-tile color meets WCAG AAA (7:1) with its text color', () => {
    for (const [kind, bg] of Object.entries(KIND_COLORS)) {
      const ratio = contrastRatio(bg, textColorFor(bg));
      expect(ratio, kind).toBeGreaterThanOrEqual(7);
    }
  });
});
