import { useEffect, useRef, type ReactNode } from 'react';
import { useSettings } from './settings';
import { Scanner, labelOf } from './scanner';
import { speak } from './speech';

const TYPING_TARGETS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (TYPING_TARGETS.has(t.tagName) || t.isContentEditable);
}

/**
 * Turns on the configured alternative input method for everything inside it:
 *
 * - scan-auto (one switch): highlight advances on a timer; Space or Enter selects.
 * - scan-step (two switches): Space or → advances; Enter selects.
 * - dwell: resting a mouse / head pointer / eye-gaze cursor on a button clicks it.
 * - direct: normal touch, mouse and keyboard only.
 *
 * Escape always stops scanning and clears the highlight.
 */
export function AccessInput({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const { inputMode, scanIntervalMs, scanSpeak, dwellMs } = settings;
  const scannerRef = useRef<Scanner | null>(null);

  // --- Switch scanning ------------------------------------------------------
  useEffect(() => {
    if (inputMode !== 'scan-auto' && inputMode !== 'scan-step') return;
    const scanner = new Scanner(
      () => document,
      (el) => {
        if (scanSpeak) speak(labelOf(el), { rate: 1.3, volume: 0.6 });
      },
    );
    scannerRef.current = scanner;
    (document.activeElement as HTMLElement | null)?.blur?.();

    let timer: number | undefined;
    const startTimer = () => {
      if (inputMode !== 'scan-auto') return;
      window.clearInterval(timer);
      timer = window.setInterval(() => scanner.next(), scanIntervalMs);
    };

    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || e.repeat) return;
      if (e.key === 'Escape') {
        scanner.reset();
        return;
      }
      const isSelect = inputMode === 'scan-auto' ? e.key === ' ' || e.key === 'Enter' : e.key === 'Enter';
      const isNext = inputMode === 'scan-step' && (e.key === ' ' || e.key === 'ArrowRight');
      if (!isSelect && !isNext) return;
      // Stop the browser from also "clicking" a focused button.
      e.preventDefault();
      e.stopPropagation();
      if (isNext) scanner.next();
      else {
        scanner.select();
        startTimer();
      }
    };

    document.addEventListener('keydown', onKey, true);
    startTimer();
    return () => {
      document.removeEventListener('keydown', onKey, true);
      window.clearInterval(timer);
      scanner.reset();
      scannerRef.current = null;
    };
  }, [inputMode, scanIntervalMs, scanSpeak]);

  // --- Dwell ------------------------------------------------------------------
  useEffect(() => {
    if (inputMode !== 'dwell') return;
    let target: HTMLElement | null = null;
    let timer: number | undefined;
    let fired: HTMLElement | null = null;

    const clear = () => {
      window.clearTimeout(timer);
      target?.classList.remove('dwelling');
      target = null;
    };

    const onOver = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('button, [data-scan-item]');
      if (el === target) return;
      clear();
      if (!el || (el as HTMLButtonElement).disabled || el === fired) return;
      fired = null;
      target = el;
      el.style.setProperty('--dwell-ms', `${dwellMs}ms`);
      el.classList.add('dwelling');
      timer = window.setTimeout(() => {
        el.classList.remove('dwelling');
        fired = el; // require leaving before this button can fire again
        target = null;
        el.click();
      }, dwellMs);
    };

    const onOut = (e: PointerEvent) => {
      const to = e.relatedTarget as Node | null;
      if (target && (!to || !target.contains(to))) clear();
      if (fired && (!to || !fired.contains(to))) fired = null;
    };

    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerout', onOut);
    return () => {
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
      clear();
    };
  }, [inputMode, dwellMs]);

  return <>{children}</>;
}
