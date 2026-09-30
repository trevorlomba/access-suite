import { STORAGE_PREFIX } from './storage';
import { SETTINGS_KEY } from './settings';

/**
 * Everything the suite keeps on this device (settings, saved phrases, word
 * frequencies, personal vocabulary) in one file, so a browser reset or a new
 * tablet doesn't wipe someone's voice.
 *
 * The AI API key is deliberately left out: backups get emailed and copied
 * around, and a key is a secret. Restoring keeps whatever key is already set.
 */

export const BACKUP_FORMAT = 'access-suite/backup';

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: 1;
  createdAt: string;
  data: Record<string, unknown>;
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function createBackup(now = new Date()): Backup {
  const data: Record<string, unknown> = {};
  const ls = storage();
  if (ls) {
    for (let i = 0; i < ls.length; i++) {
      const key = ls.key(i);
      if (!key?.startsWith(STORAGE_PREFIX)) continue;
      try {
        data[key] = JSON.parse(ls.getItem(key) ?? 'null');
      } catch {
        continue; // skip anything unreadable
      }
    }
  }
  const settings = data[SETTINGS_KEY];
  if (settings && typeof settings === 'object') {
    const rest = { ...(settings as Record<string, unknown>) };
    delete rest.aiKey;
    data[SETTINGS_KEY] = rest;
  }
  return { format: BACKUP_FORMAT, version: 1, createdAt: now.toISOString(), data };
}

/** Validate and write a backup. Returns how many items were restored. */
export function restoreBackup(input: unknown): number {
  let parsed: unknown = input;
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input);
    } catch {
      throw new Error('This file could not be read (it is not valid JSON).');
    }
  }
  const b = parsed as Partial<Backup> | null;
  if (!b || typeof b !== 'object' || b.format !== BACKUP_FORMAT) throw new Error('This is not an Access Suite backup file.');
  if (b.version !== 1) throw new Error(`Unsupported backup version: ${String(b.version)}.`);
  if (!b.data || typeof b.data !== 'object') throw new Error('This backup is empty.');
  const ls = storage();
  if (!ls) throw new Error('This browser is blocking storage, so the backup can’t be restored here.');

  let restored = 0;
  for (const [key, value] of Object.entries(b.data)) {
    if (!key.startsWith(STORAGE_PREFIX)) continue; // only ever write our own keys
    let v = value;
    if (key === SETTINGS_KEY && v && typeof v === 'object') {
      // Keep the key already on this device; never take one from a file.
      let current: Record<string, unknown> = {};
      try {
        current = JSON.parse(ls.getItem(SETTINGS_KEY) ?? '{}') as Record<string, unknown>;
      } catch {
        current = {};
      }
      const incoming = { ...(v as Record<string, unknown>) };
      delete incoming.aiKey;
      v = { ...incoming, aiKey: typeof current.aiKey === 'string' ? current.aiKey : '' };
    }
    ls.setItem(key, JSON.stringify(v));
    restored++;
  }
  return restored;
}
