import { describe, expect, it } from 'vitest';
import { createBackup, restoreBackup } from './backup';

const set = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
const get = (k: string) => JSON.parse(localStorage.getItem(k) ?? 'null');

describe('backup', () => {
  it('exports every access-suite key except the AI key, and ignores other apps’ keys', () => {
    set('access-suite:settings', { targetSize: 96, aiProvider: 'anthropic', aiKey: 'sk-secret' });
    set('access-suite:board:saved', ['Call Rosa']);
    set('access-suite:vocabulary', { format: 'access-suite/vocabulary', version: 1, words: [], phrases: [] });
    localStorage.setItem('someone-else', 'x');
    const b = createBackup(new Date(0));
    expect(Object.keys(b.data).sort()).toEqual(['access-suite:board:saved', 'access-suite:settings', 'access-suite:vocabulary']);
    expect(b.data['access-suite:settings']).toEqual({ targetSize: 96, aiProvider: 'anthropic' });
    expect(JSON.stringify(b)).not.toContain('sk-secret');
  });

  it('restores onto a fresh device, keeping the key already set there', () => {
    set('access-suite:board:saved', ['Call Rosa']);
    set('access-suite:settings', { targetSize: 96, aiKey: 'old-device-key' });
    const file = JSON.stringify(createBackup());
    localStorage.clear();
    set('access-suite:settings', { aiKey: 'new-device-key' });

    expect(restoreBackup(file)).toBe(2);
    expect(get('access-suite:board:saved')).toEqual(['Call Rosa']);
    expect(get('access-suite:settings')).toEqual({ targetSize: 96, aiKey: 'new-device-key' });
  });

  it('never writes keys outside the suite and never accepts a key from a file', () => {
    restoreBackup({
      format: 'access-suite/backup',
      version: 1,
      data: { 'evil-key': 1, 'access-suite:settings': { aiKey: 'attacker', rate: 1.5 } },
    });
    expect(localStorage.getItem('evil-key')).toBeNull();
    expect(get('access-suite:settings')).toEqual({ rate: 1.5, aiKey: '' });
  });

  it('rejects files that are not backups', () => {
    expect(() => restoreBackup('nope')).toThrow(/not valid JSON/);
    expect(() => restoreBackup({ format: 'other' })).toThrow(/not an Access Suite backup/);
    expect(() => restoreBackup({ format: 'access-suite/backup', version: 2, data: {} })).toThrow(/Unsupported/);
  });
});
