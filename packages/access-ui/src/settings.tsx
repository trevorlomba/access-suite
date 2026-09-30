import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { STORAGE_PREFIX, readJSON, writeJSON } from './storage';

export type InputMode = 'direct' | 'scan-auto' | 'scan-step' | 'dwell';
export type AiProviderId = 'none' | 'demo' | 'anthropic' | 'openai';

export interface Settings {
  inputMode: InputMode;
  /** Auto-scan: time each item stays highlighted. */
  scanIntervalMs: number;
  /** Speak each highlighted item quietly (auditory scanning). */
  scanSpeak: boolean;
  dwellMs: number;
  /** Minimum button height/width in CSS px. */
  targetSize: number;
  highContrast: boolean;
  voiceURI: string | null;
  rate: number;
  pitch: number;
  aiProvider: AiProviderId;
  /** Stored only in this browser; sent only to the chosen provider. */
  aiKey: string;
  aiModel: string;
}

export const DEFAULT_SETTINGS: Settings = {
  inputMode: 'direct',
  scanIntervalMs: 1200,
  scanSpeak: false,
  dwellMs: 1000,
  targetSize: 72,
  highContrast: false,
  voiceURI: null,
  rate: 1,
  pitch: 1,
  aiProvider: 'none',
  aiKey: '',
  aiModel: '',
};

export const SETTINGS_KEY = `${STORAGE_PREFIX}settings`;

interface SettingsContextValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function loadSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...readJSON<Partial<Settings>>(SETTINGS_KEY, {}) };
}

export function SettingsProvider({ children, initial }: { children: ReactNode; initial?: Partial<Settings> }) {
  const [settings, setSettings] = useState<Settings>(() => ({ ...loadSettings(), ...initial }));

  useEffect(() => {
    writeJSON(SETTINGS_KEY, settings);
    const root = document.documentElement;
    root.style.setProperty('--target', `${settings.targetSize}px`);
    root.dataset.contrast = settings.highContrast ? 'high' : 'normal';
    root.dataset.inputMode = settings.inputMode;
  }, [settings]);

  // Keep tabs (hub + tools) in sync when settings change elsewhere.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SETTINGS_KEY) setSettings(loadSettings());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const update = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);
  const reset = useCallback(() => setSettings(DEFAULT_SETTINGS), []);
  const value = useMemo(() => ({ settings, update, reset }), [settings, update, reset]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
