import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettings } from './settings';

export interface SpeakOptions {
  voiceURI?: string | null;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

// The user's own message, while it is being spoken. Scan announcements must
// never talk over it or cut it off.
let messageUtterance: SpeechSynthesisUtterance | null = null;

/** True while a message spoken with `speak()` is still playing. */
export function isSpeakingMessage(): boolean {
  return messageUtterance != null && speechSupported() && window.speechSynthesis.speaking === true;
}

function utter(text: string, opts: SpeakOptions): SpeechSynthesisUtterance {
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (opts.voiceURI) {
    const voice = synth.getVoices().find((v) => v.voiceURI === opts.voiceURI);
    if (voice) u.voice = voice;
  }
  u.rate = opts.rate ?? 1;
  u.pitch = opts.pitch ?? 1;
  u.volume = opts.volume ?? 1;
  return u;
}

/** Speak `text`, interrupting anything already speaking. Returns false if unsupported. */
export function speak(text: string, opts: SpeakOptions = {}): boolean {
  if (!speechSupported() || !text.trim()) return false;
  const u = utter(text, opts);
  messageUtterance = u;
  const done = () => {
    if (messageUtterance === u) messageUtterance = null;
  };
  u.onend = done;
  u.onerror = done;
  window.speechSynthesis.speak(u);
  return true;
}

/**
 * Speak a short cue, such as the label of a scan highlight. Unlike `speak()`,
 * it stays quiet while the user's message is playing instead of cutting it off.
 */
export function announce(text: string, opts: SpeakOptions = {}): boolean {
  if (!speechSupported() || !text.trim() || isSpeakingMessage()) return false;
  window.speechSynthesis.speak(utter(text, opts));
  return true;
}

export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() =>
    speechSupported() ? window.speechSynthesis.getVoices() : [],
  );
  useEffect(() => {
    if (!speechSupported()) return;
    const synth = window.speechSynthesis;
    const load = () => setVoices(synth.getVoices());
    synth.addEventListener?.('voiceschanged', load);
    return () => synth.removeEventListener?.('voiceschanged', load);
  }, []);
  return voices;
}

/** Speak with the user's configured voice, rate and pitch. */
export function useSpeak() {
  const { settings } = useSettings();
  const { voiceURI, rate, pitch } = settings;
  const say = useCallback((text: string) => speak(text, { voiceURI, rate, pitch }), [voiceURI, rate, pitch]);
  return { speak: say, supported: speechSupported() };
}

// ---------------------------------------------------------------------------
// Speech recognition (used by Listen & Reply). Feature-detected: Chromium and
// Safari expose it, Firefox does not.

interface RecognitionResultList {
  length: number;
  [index: number]: { isFinal: boolean; 0?: { transcript: string } };
}

interface RecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: RecognitionResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => RecognitionLike;

function getRecognition(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function listenSupported(): boolean {
  return getRecognition() != null;
}

const LISTEN_ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone access was blocked. Allow it in your browser settings, or type instead.',
  'service-not-allowed': 'Speech recognition is blocked in this browser. You can type instead.',
  'no-speech': 'No speech heard. Try again.',
  network: 'Speech recognition needs an internet connection in this browser.',
  'audio-capture': 'No microphone found.',
};

/**
 * Continuous speech recognition. `onUtterance` fires once per finished
 * phrase; `interim` shows words while they're still being recognized.
 */
export function useListen({ lang = 'en-US', onUtterance }: { lang?: string; onUtterance: (text: string) => void }) {
  const Ctor = getRecognition();
  const rec = useRef<RecognitionLike | null>(null);
  const onUtteranceRef = useRef(onUtterance);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onUtteranceRef.current = onUtterance;
  }, [onUtterance]);

  useEffect(() => () => rec.current?.stop(), []);

  const start = useCallback(() => {
    if (!Ctor) {
      setError('Speech recognition is not available in this browser. You can type instead.');
      return;
    }
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = lang;
    r.onresult = (e) => {
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        const t = (res[0]?.transcript ?? '').trim();
        if (!t) continue;
        if (res.isFinal) onUtteranceRef.current(t);
        else interimText += `${t} `;
      }
      setInterim(interimText.trim());
    };
    r.onerror = (e) => {
      if (e.error !== 'aborted') setError(LISTEN_ERRORS[e.error] ?? `Speech recognition error: ${e.error}`);
    };
    r.onend = () => {
      setListening(false);
      setInterim('');
    };
    rec.current = r;
    setError(null);
    r.start();
    setListening(true);
  }, [Ctor, lang]);

  const stop = useCallback(() => rec.current?.stop(), []);

  return { supported: !!Ctor, listening, interim, error, start, stop };
}
