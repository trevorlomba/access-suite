/**
 * Row–column switch scanning over the live DOM.
 *
 * Markup contract (no registration needed, so any component can opt in):
 *   - `data-scan-group` on a container marks a row/group.
 *   - Enabled `<button>`s (or `[data-scan-item]`) inside it are its items.
 *   - `data-scan-scope` on a dialog confines scanning to it while open.
 *
 * The scanner highlights a group; selecting enters the group and highlights
 * its items; selecting an item clicks it and returns to group level. Groups
 * with a single item are activated directly. If the user lets item-level
 * scanning loop twice without choosing, it backs out to group level.
 */

export const HIGHLIGHT_CLASS = 'scan-highlight';
const ITEM_LOOPS_BEFORE_EXIT = 2;

export type ScanLevel = 'group' | 'item';

function isHidden(el: Element): boolean {
  return !!el.closest('[hidden], [inert], [aria-hidden="true"]');
}

export function labelOf(el: HTMLElement): string {
  return (el.getAttribute('aria-label') ?? el.textContent ?? '').trim();
}

export class Scanner {
  level: ScanLevel = 'group';
  private groupIndex = -1;
  private itemIndex = -1;
  private itemLoops = 0;
  private current: HTMLElement | null = null;

  constructor(
    private readonly root: () => ParentNode,
    private readonly onHighlight?: (el: HTMLElement, level: ScanLevel) => void,
  ) {}

  private scope(): ParentNode {
    const scopes = Array.from(this.root().querySelectorAll<HTMLElement>('[data-scan-scope]')).filter(
      (s) => !isHidden(s),
    );
    return scopes[scopes.length - 1] ?? this.root();
  }

  groups(): HTMLElement[] {
    return Array.from(this.scope().querySelectorAll<HTMLElement>('[data-scan-group]')).filter(
      (g) => !isHidden(g) && this.items(g).length > 0,
    );
  }

  items(group: HTMLElement): HTMLElement[] {
    return Array.from(group.querySelectorAll<HTMLElement>('button, [data-scan-item]')).filter(
      (el) =>
        !(el as HTMLButtonElement).disabled &&
        el.getAttribute('aria-disabled') !== 'true' &&
        !isHidden(el) &&
        el.closest('[data-scan-group]') === group,
    );
  }

  get highlighted(): HTMLElement | null {
    return this.current;
  }

  private highlight(el: HTMLElement | null) {
    this.current?.classList.remove(HIGHLIGHT_CLASS);
    this.current = el;
    if (!el) return;
    el.classList.add(HIGHLIGHT_CLASS);
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    this.onHighlight?.(el, this.level);
  }

  /** Advance the highlight one step. */
  next(): HTMLElement | null {
    const groups = this.groups();
    if (groups.length === 0) {
      this.reset();
      return null;
    }
    if (this.level === 'item') {
      const group = groups[this.groupIndex];
      const items = group ? this.items(group) : [];
      if (items.length === 0) {
        this.level = 'group';
      } else {
        this.itemIndex += 1;
        if (this.itemIndex >= items.length) {
          this.itemIndex = 0;
          this.itemLoops += 1;
          if (this.itemLoops >= ITEM_LOOPS_BEFORE_EXIT) {
            this.level = 'group';
            this.highlight(group!);
            return group!;
          }
        }
        this.highlight(items[this.itemIndex]!);
        return this.current;
      }
    }
    this.groupIndex = (this.groupIndex + 1) % groups.length;
    this.highlight(groups[this.groupIndex]!);
    return this.current;
  }

  /** Act on the highlight: enter a group, or click an item. */
  select(): void {
    const groups = this.groups();
    if (!this.current || groups.length === 0) {
      this.next();
      return;
    }
    if (this.level === 'group') {
      const group = groups[this.groupIndex];
      if (!group) return void this.next();
      const items = this.items(group);
      if (items.length === 1) {
        this.activate(items[0]!);
        return;
      }
      this.level = 'item';
      this.itemIndex = -1;
      this.itemLoops = 0;
      this.next();
      return;
    }
    const item = this.current;
    this.activate(item);
  }

  private activate(item: HTMLElement) {
    this.level = 'group';
    this.itemIndex = -1;
    this.highlight(null);
    // Start the next pass from the same group (users often pick several words
    // from one grid). Clamp in case the click changes the DOM.
    this.groupIndex = Math.max(-1, this.groupIndex - 1);
    item.click();
  }

  reset(): void {
    this.highlight(null);
    this.level = 'group';
    this.groupIndex = -1;
    this.itemIndex = -1;
    this.itemLoops = 0;
  }
}
