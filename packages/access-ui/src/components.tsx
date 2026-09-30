import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

type Variant = 'default' | 'primary' | 'danger' | 'quiet';

export interface BigButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Tile background (e.g. a Fitzgerald Key color); text color is set by caller. */
  tone?: { bg: string; fg: string };
}

/** A large, high-contrast button that respects the user's target-size setting. */
export const BigButton = forwardRef<HTMLButtonElement, BigButtonProps>(function BigButton(
  { variant = 'default', tone, className = '', style, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`big-btn big-btn--${variant} ${tone ? 'big-btn--tone' : ''} ${className}`.trim()}
      style={tone ? { ...style, ['--tone-bg' as string]: tone.bg, ['--tone-fg' as string]: tone.fg } : style}
      {...rest}
    />
  );
});

export interface ScanGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** Accessible name for the group; also what auditory scanning announces. */
  label: string;
  layout?: 'row' | 'grid' | 'stack';
}

/** A labelled group of buttons that switch scanning treats as one row. */
export function ScanGroup({ label, layout = 'row', className = '', children, ...rest }: ScanGroupProps) {
  return (
    <div
      role="group"
      aria-label={label}
      data-scan-group=""
      className={`scan-group scan-group--${layout} ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Element id the rest of the app is mounted in; made inert while open. */
  appRootId?: string;
}

/**
 * Modal dialog: portals to <body>, makes the app inert behind it, confines
 * switch scanning to itself, closes on Escape, restores focus on close.
 */
export function Dialog({ open, title, onClose, children, appRootId = 'root' }: DialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // Callers usually pass a fresh function each render; keep it out of the
  // effect's deps so focus isn't reset on every keystroke inside the dialog.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const appRoot = document.getElementById(appRootId);
    appRoot?.setAttribute('inert', '');
    const panel = panelRef.current;
    const first =
      panel?.querySelector<HTMLElement>('.dialog__body [autofocus], .dialog__body input, .dialog__body textarea, .dialog__body select') ??
      panel?.querySelector<HTMLElement>('button, [tabindex]');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      appRoot?.removeAttribute('inert');
      previouslyFocused?.focus?.();
    };
  }, [open, appRootId]);

  if (!open) return null;
  return createPortal(
    <div className="dialog-backdrop" data-scan-scope="">
      <div ref={panelRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="dialog__header">
          <h2 id={titleId}>{title}</h2>
          <ScanGroup label="Close dialog">
            <BigButton variant="quiet" onClick={onClose} aria-label={`Close ${title}`}>
              ✕
            </BigButton>
          </ScanGroup>
        </div>
        <div className="dialog__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
