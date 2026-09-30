import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HIGHLIGHT_CLASS, Scanner } from './scanner';

function setup() {
  document.body.innerHTML = `
    <div data-scan-group id="g1">
      <button id="a">A</button><button id="b">B</button><button id="c" disabled>C</button>
    </div>
    <div data-scan-group id="g2"><button id="solo">Solo</button></div>
    <div data-scan-group id="empty"></div>
    <div data-scan-group hidden id="hiddenGroup"><button>Hidden</button></div>
  `;
  const clicks: string[] = [];
  document.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => clicks.push(b.id)));
  return { scanner: new Scanner(() => document), clicks };
}

describe('Scanner', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('cycles only visible, non-empty groups', () => {
    const { scanner } = setup();
    expect(scanner.next()?.id).toBe('g1');
    expect(scanner.next()?.id).toBe('g2');
    expect(scanner.next()?.id).toBe('g1');
  });

  it('enters a group, skips disabled items, and clicks the chosen item', () => {
    const { scanner, clicks } = setup();
    scanner.next(); // g1
    scanner.select(); // enter → highlights A
    expect(scanner.highlighted?.id).toBe('a');
    scanner.next(); // B
    expect(scanner.highlighted?.id).toBe('b');
    expect(scanner.highlighted?.classList.contains(HIGHLIGHT_CLASS)).toBe(true);
    scanner.select();
    expect(clicks).toEqual(['b']);
    expect(scanner.level).toBe('group');
    expect(scanner.highlighted).toBeNull();
    // Next pass resumes at the same group.
    expect(scanner.next()?.id).toBe('g1');
  });

  it('activates single-item groups directly', () => {
    const { scanner, clicks } = setup();
    scanner.next();
    scanner.next(); // g2
    scanner.select();
    expect(clicks).toEqual(['solo']);
  });

  it('backs out to group level after two unanswered item loops', () => {
    const { scanner } = setup();
    scanner.next();
    scanner.select(); // A
    scanner.next(); // B
    scanner.next(); // A (loop 1)
    scanner.next(); // B
    const back = scanner.next(); // loop 2 → back to group
    expect(back?.id).toBe('g1');
    expect(scanner.level).toBe('group');
  });

  it('confines scanning to the topmost scan scope', () => {
    setup();
    const dialog = document.createElement('div');
    dialog.setAttribute('data-scan-scope', '');
    dialog.innerHTML = '<div data-scan-group id="d1"><button>OK</button><button>Cancel</button></div>';
    document.body.appendChild(dialog);
    const scanner = new Scanner(() => document);
    expect(scanner.next()?.id).toBe('d1');
    expect(scanner.next()?.id).toBe('d1');
  });

  it('select with nothing highlighted just starts scanning', () => {
    const { scanner, clicks } = setup();
    const onHighlight = vi.fn();
    const s = new Scanner(() => document, onHighlight);
    s.select();
    expect(onHighlight).toHaveBeenCalledOnce();
    expect(clicks).toEqual([]);
    expect(scanner.highlighted).toBeNull();
  });
});
