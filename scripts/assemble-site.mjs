// Combine each app's build into one static site, then make it installable and
// usable offline:
//   dist/                      ← apps/hub
//   dist/<tool>/               ← apps/<tool>
//   dist/icons/                ← scripts/assets
//   dist/**/manifest.webmanifest  one per app, so each tool installs on its own
//   dist/sw.js                 service worker precaching every file (scope: whole site)
// Add new tools to APPS as they ship.
import { createHash } from 'node:crypto';
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'dist');
const APPS = [
  { from: 'apps/hub/dist', to: '.', name: 'Access Suite', short: 'Access Suite' },
  { from: 'apps/phrase-board/dist', to: 'phrase-board', name: 'Phrase Board', short: 'Phrase Board' },
  { from: 'apps/listen-reply/dist', to: 'listen-reply', name: 'Listen & Reply', short: 'Listen' },
  { from: 'apps/vocabulary-builder/dist', to: 'vocabulary-builder', name: 'Vocabulary Builder', short: 'Vocabulary' },
];

// Content Security Policy for the built site (dev is left alone: Vite's hot
// reload needs inline scripts). The AI key lives in localStorage, so this is
// what enforces "no third-party code": scripts only from this site, and
// network requests only to this site and the two AI providers.
// It goes right after <meta charset>, since a meta CSP only covers what follows it.
const CHARSET = '<meta charset="UTF-8" />';
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://api.anthropic.com https://api.openai.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

rmSync(out, { recursive: true, force: true });
for (const app of APPS) {
  const src = resolve(root, app.from);
  if (!existsSync(src)) throw new Error(`Missing build output: ${app.from}. Run the app's build first.`);
  cpSync(src, resolve(out, app.to), { recursive: true });
  console.log(`assembled ${app.from} → dist/${app.to === '.' ? '' : app.to + '/'}`);
}

// Icons + one manifest per app.
cpSync(resolve(root, 'scripts/assets'), resolve(out, 'icons'), { recursive: true });
for (const app of APPS) {
  const toIcons = app.to === '.' ? 'icons' : '../icons';
  const manifest = {
    name: app.to === '.' ? app.name : `${app.name} · Access Suite`,
    short_name: app.short,
    description: 'Free, private communication tools. Works offline.',
    start_url: './',
    scope: './',
    display: 'standalone',
    background_color: '#f6f5f1',
    theme_color: '#1f4fd1',
    icons: [
      { src: `${toIcons}/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: `${toIcons}/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      { src: `${toIcons}/icon.svg`, sizes: 'any', type: 'image/svg+xml' },
    ],
  };
  writeFileSync(resolve(out, app.to, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));

  // Link the manifest and home-screen icon from the built page (done here so
  // Vite doesn't try to resolve files that only exist after assembly).
  const htmlPath = resolve(out, app.to, 'index.html');
  const tags = [
    '<link rel="manifest" href="./manifest.webmanifest" />',
    `<link rel="apple-touch-icon" href="${toIcons}/icon-192.png" />`,
    '<meta name="apple-mobile-web-app-capable" content="yes" />',
  ].join('\n    ');
  const html = readFileSync(htmlPath, 'utf8');
  if (!html.includes(CHARSET)) throw new Error(`${app.from}/index.html: expected ${CHARSET} to place the CSP after`);
  writeFileSync(
    htmlPath,
    html
      .replace(CHARSET, `${CHARSET}\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`)
      .replace('</head>', `    ${tags}\n  </head>`),
  );
}

// Service worker: precache everything, versioned by content hash.
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const files = walk(out).sort();
const template = readFileSync(resolve(root, 'scripts/sw-template.js'), 'utf8');
const hash = createHash('sha256').update(template);
for (const f of files) hash.update(relative(out, f)).update(readFileSync(f));
const version = hash.digest('hex').slice(0, 12);
const urls = files.map((f) => relative(out, f).split('\\').join('/'));
// Also cache each app's directory URL ("phrase-board/"), which is how pages are opened.
const dirs = APPS.map((a) => (a.to === '.' ? './' : `${a.to}/`));
writeFileSync(
  resolve(out, 'sw.js'),
  template.replace('__VERSION__', version).replace('__FILES__', JSON.stringify([...dirs, ...urls], null, 0)),
);
console.log(`service worker: ${urls.length} files, version ${version}`);
