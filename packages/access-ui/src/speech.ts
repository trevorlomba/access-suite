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

/** Speak `text`, interrupting anything already speaking. Returns false if unsupported. */
export function speak(text: string, opts: SpeakOptions = {}): boolean {
  if (!speechSupported() || !text.trim()) return false;
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
  synth.speak(u);
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

interface RecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => RecognitionLike;

function getRecognition(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useListen(lang = 'en-US') {
  const Ctor = getRecognition();
  const rec = useRef<RecognitionLike | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

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
      let finalText = '';
      let interimText = '';
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i]!;
        const t = res[0]?.transcript ?? '';
        if (res.isFinal) finalText += t;
        else interimText += t;
      }
      setTranscript(finalText.trim());
      setInterim(interimText.trim());
    };
    r.onerror = (e) => setError(e.error);
    r.onend = () => setListening(false);
    rec.current = r;
    setError(null);
    r.start();
    setListening(true);
  }, [Ctor, lang]);

  const stop = useCallback(() => rec.current?.stop(), []);

  return { supported: !!Ctor, listening, transcript, interim, error, start, stop };
}
