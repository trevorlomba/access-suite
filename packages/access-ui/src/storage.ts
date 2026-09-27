/**
 * localStorage can be missing or throw (private windows, blocked site data,
 * embedded frames). Every read/write goes through here so the app keeps
 * working, just without persistence.
 */
export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: state lives for this session only.
  }
}

export const STORAGE_PREFIX = 'access-suite:';
