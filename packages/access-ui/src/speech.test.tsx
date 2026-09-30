import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { AccessInput } from './AccessInput';
import { ScanGroup } from './components';
import { SettingsProvider } from './settings';
import { HIGHLIGHT_CLASS } from './scanner';
import { announce, isSpeakingMessage, speak } from './speech';

interface FakeUtterance {
  text: string;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

/** A speech engine that plays one utterance at a time until `finish()`. */
function installFakeSpeech() {
  const spoken: string[] = [];
  const cancelled: string[] = [];
  let current: FakeUtterance | null = null;
  const synth = {
    get speaking() {
      return current != null;
    },
    speak(u: FakeUtterance) {
      spoken.push(u.text);
      current = u;
    },
    cancel() {
      if (current) cancelled.push(current.text);
      current = null;
    },
    getVoices: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  class Utterance {
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public text: string) {}
  }
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: Utterance, configurable: true });
  const finish = () => {
    const u = current;
    current = null;
    u?.onend?.();
  };
  return { spoken, cancelled, finish };
}

describe('speech: messages vs. scan announcements', () => {
  let fake: ReturnType<typeof installFakeSpeech>;
  beforeEach(() => {
    fake = installFakeSpeech();
  });

  it('an announcement never cuts off the message being spoken', () => {
    speak('I would like some water please');
    expect(isSpeakingMessage()).toBe(true);
    expect(announce('Pronouns')).toBe(false);
    expect(fake.cancelled).toEqual([]);
    expect(fake.spoken).toEqual(['I would like some water please']);

    fake.finish();
    expect(isSpeakingMessage()).toBe(false);
    expect(announce('Pronouns')).toBe(true);
    expect(fake.spoken).toEqual(['I would like some water please', 'Pronouns']);
  });

  it('a new message still interrupts an announcement', () => {
    announce('Pronouns');
    speak('Yes');
    expect(fake.cancelled).toEqual(['Pronouns']);
    expect(isSpeakingMessage()).toBe(true);
  });
});

describe('auto-scan while a message is spoken', () => {
  let fake: ReturnType<typeof installFakeSpeech>;
  beforeEach(() => {
    fake = installFakeSpeech();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('holds the highlight until the message finishes, then carries on', () => {
    const { getByRole } = render(
      <SettingsProvider initial={{ inputMode: 'scan-auto', scanIntervalMs: 1000, scanSpeak: true }}>
        <AccessInput>
          <ScanGroup label="First">
            <button type="button">A</button>
            <button type="button">B</button>
          </ScanGroup>
          <ScanGroup label="Second">
            <button type="button">C</button>
            <button type="button">D</button>
          </ScanGroup>
        </AccessInput>
      </SettingsProvider>,
    );
    const first = getByRole('group', { name: 'First' });
    const second = getByRole('group', { name: 'Second' });

    act(() => void vi.advanceTimersByTime(1000));
    expect(first).toHaveClass(HIGHLIGHT_CLASS);

    act(() => void speak('Hello there'));
    act(() => void vi.advanceTimersByTime(3000));
    expect(first).toHaveClass(HIGHLIGHT_CLASS);
    expect(fake.cancelled).not.toContain('Hello there');

    act(() => fake.finish());
    act(() => void vi.advanceTimersByTime(1000));
    expect(second).toHaveClass(HIGHLIGHT_CLASS);
  });
});
