// Combine each app's build into one static site:
//   dist/                 ← apps/hub
//   dist/phrase-board/    ← apps/phrase-board
// Add new tools to APPS as they ship.
import { cpSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'dist');
const APPS = [
  { from: 'apps/hub/dist', to: '.' },
  { from: 'apps/phrase-board/dist', to: 'phrase-board' },
  { from: 'apps/listen-reply/dist', to: 'listen-reply' },
  { from: 'apps/vocabulary-builder/dist', to: 'vocabulary-builder' },
];

rmSync(out, { recursive: true, force: true });
for (const app of APPS) {
  const src = resolve(root, app.from);
  if (!existsSync(src)) throw new Error(`Missing build output: ${app.from}. Run the app's build first.`);
  cpSync(src, resolve(out, app.to), { recursive: true });
  console.log(`assembled ${app.from} → dist/${app.to === '.' ? '' : app.to + '/'}`);
}
