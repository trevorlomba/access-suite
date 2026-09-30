import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Runs the real service worker template against an in-memory Cache Storage.

const ORIGIN = 'https://example.test';
type Req = { url: string; method?: string; mode?: string };
type Handler = (event: unknown) => void;

function fakeCaches(initial: Record<string, Record<string, string>>) {
  const store = new Map<string, Map<string, string>>();
  for (const [name, entries] of Object.entries(initial)) store.set(name, new Map(Object.entries(entries)));
  const key = (r: Req | string) => (typeof r === 'string' ? r : r.url);
  const cacheFor = (entries: Map<string, string>) => ({
    match: async (r: Req | string) => entries.get(key(r)),
    put: async (r: Req | string, body: string) => void entries.set(key(r), body),
    addAll: async () => {},
  });
  return {
    store,
    keys: async () => [...store.keys()],
    delete: async (name: string) => store.delete(name),
    open: async (name: string) => {
      if (!store.has(name)) store.set(name, new Map());
      return cacheFor(store.get(name)!);
    },
    // Like the real thing: searches caches oldest first.
    match: async (r: Req | string) => {
      for (const entries of store.values()) {
        const hit = entries.get(key(r));
        if (hit) return hit;
      }
      return undefined;
    },
  };
}

function loadWorker(caches: ReturnType<typeof fakeCaches>, fetchImpl: (r: Req) => Promise<unknown>) {
  const listeners: Record<string, Handler> = {};
  const self = {
    registration: { scope: `${ORIGIN}/` },
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: Handler) => void (listeners[type] = fn),
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  };
  const source = readFileSync(resolve(import.meta.dirname, 'sw-template.js'), 'utf8')
    .replace('__VERSION__', 'current')
    .replace('__FILES__', '[]');
  new Function('self', 'caches', 'fetch', source)(self, caches, fetchImpl);

  const dispatch = (type: string, request?: Req) => {
    let result: Promise<unknown> | undefined;
    listeners[type]!({
      request,
      waitUntil: (p: Promise<unknown>) => void (result = p),
      respondWith: (p: Promise<unknown>) => void (result = p),
    });
    return result;
  };
  return { dispatch };
}

const offline = () => Promise.reject(new TypeError('offline'));

describe('service worker', () => {
  it('keeps the two previous versions on activate and drops older ones', async () => {
    const caches = fakeCaches({
      'access-suite-v1': {},
      'access-suite-v2': {},
      'someone-else': {},
      'access-suite-v3': {},
      'access-suite-current': {},
    });
    await loadWorker(caches, offline).dispatch('activate');
    expect([...caches.store.keys()]).toEqual(['access-suite-v2', 'someone-else', 'access-suite-v3', 'access-suite-current']);
  });

  it('serves a file only an older version has, for a page still open from that version', async () => {
    const old = `${ORIGIN}/phrase-board/assets/anthropic-OLD.js`;
    const caches = fakeCaches({ 'access-suite-v3': { [old]: 'old ai code' }, 'access-suite-current': {} });
    const hit = await loadWorker(caches, offline).dispatch('fetch', { url: old, method: 'GET', mode: 'cors' });
    expect(hit).toBe('old ai code');
  });

  it('offline, opens pages from the newest version, not an older cache', async () => {
    const page = `${ORIGIN}/phrase-board/index.html`;
    const caches = fakeCaches({
      'access-suite-v3': { [page]: 'old page' },
      'access-suite-current': { [page]: 'new page' },
    });
    const res = await loadWorker(caches, offline).dispatch('fetch', { url: `${ORIGIN}/phrase-board/`, method: 'GET', mode: 'navigate' });
    expect(res).toBe('new page');
  });
});
