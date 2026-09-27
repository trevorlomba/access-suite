# Access Suite

Free, private communication and access tools for people with severe speech and
motor impairments — ALS/MND, locked-in syndrome, brainstem stroke, cerebral
palsy — and the people who care for them.

- **Free, forever.** A static website. No account, no server, no ads.
- **Private by default.** Words, saved phrases and settings stay in your browser.
- **Every way of selecting.** Touch, mouse, keyboard, one-switch auto-scan,
  two-switch step-scan, and dwell for head pointers and eye gaze.
- **AI is optional.** Bring your own Anthropic or OpenAI key for sentence
  suggestions. It's stored only on your device and sent only to that provider.

## Tools

| Tool | Status |
|---|---|
| **Phrase Board**: tap, scan or dwell on words to build a message and hear it spoken; optionally let AI expand a few words into full sentences | ✅ MVP |
| **Listen & Reply**: caption what someone says and reply using their words | ✅ MVP |
| **Vocabulary Builder**: a personal word list from your own texts, processed on-device; your words appear in the other tools | ✅ MVP |
| **Dwell Panels**: design custom big-button panels | Planned |
| **Mac Toolkit**: Keyboard Maestro + Accessibility Keyboard panels | Planned |

See [docs/STRATEGY.md](docs/STRATEGY.md) for the roadmap and
[docs/CASE_STUDY.md](docs/CASE_STUDY.md) for the story behind it.

## Develop

Requires Node 20+.

```sh
npm install
npm run dev          # Phrase Board at http://localhost:5173
npm run dev:hub      # hub landing page
npm run dev:listen   # Listen & Reply
npm run dev:vocab    # Vocabulary Builder
npm run check        # lint → typecheck → unit tests → build → E2E + axe
```

First E2E run: `npx playwright install chromium`.

### Layout

```
apps/
  hub/             landing page + shared settings
  phrase-board/    the Phrase Board tool
  listen-reply/    the Listen & Reply tool
  vocabulary-builder/  build a personal word list on-device (Web Worker)
packages/
  vocab/           in-browser vocabulary pipeline + vocabulary file schema
  board/           message composer shared by the tools: sentence bar,
                   word rows, suggestions, saved phrases, vocabulary,
                   transcript analysis (board/transcript)
  access-ui/       input & output primitives: scanning, dwell, speech,
                   settings, big buttons, dialog, on-screen keyboard
  ai/              provider-agnostic generate(): Claude, OpenAI, demo
docs/              strategy, legacy audit, tool specs, case study
e2e/               Playwright tests incl. axe scans (light, dark, high contrast)
```

### Making any component switch- and dwell-accessible

Wrap related buttons in a `ScanGroup`; that's all. `AccessInput` (mounted
once at the app root) scans every visible `ScanGroup` in DOM order and dwell
works on every `<button>`. Dialogs built with `Dialog` confine scanning to
themselves while open.

```tsx
<ScanGroup label="Yes or no">
  <BigButton onClick={yes}>Yes</BigButton>
  <BigButton onClick={no}>No</BigButton>
</ScanGroup>
```

### The bring-your-own-key model

There is no backend. With AI turned on, the browser calls the provider
directly using the user's key (for Claude, via the official SDK's
`dangerouslyAllowBrowser` opt-in, which exists for exactly this pattern). The
tradeoffs:

- ✅ No server to run, pay for, secure, or have abused; the project costs $0.
- ✅ The key is never sent to anyone but the provider the user chose.
- ⚠️ The key lives in `localStorage`, so anything that can run script on this
  origin could read it. Mitigations: no third-party scripts, fonts or analytics
  are loaded; there is a one-click "Forget my key"; the docs recommend a key
  with a spending limit.

## Deploy

`.github/workflows/pages.yml` builds the assembled site (`dist/`). Deployment
is switched off until the repo is public; see the comment at the top of that
file.

## License

MIT
