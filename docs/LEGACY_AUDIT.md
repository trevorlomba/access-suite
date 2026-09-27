# Legacy audit

An inventory of the earlier projects this suite is built from, what is reused,
and what was left behind. Surveyed 2026-09-27.

## Lineage

```
2023  gpt-access           accessible-language-generation (Flask + GPT, data pipeline)
                           └─ gpt-access-client (React/TS word-cloud board)
2023  notion-access        macOS Keyboard Maestro + Accessibility Keyboard dwell panels
2024  speech-assist        speech-assist (client-only prototype)
                           └─ speech-assist-app (React client) + speech-assist-server (Express proxy)
2026  access-suite         this repo
```

## Repo by repo

### accessible-language-generation (2023, MIT)
- **Did:** Flask endpoint that turned keywords (e.g. "coffee", "we late") into
  first-person sentences with `text-davinci-003`. Included a pipeline that
  turned a voice-banking export into a word-frequency vocabulary (`words.db` →
  `words.json`) and fine-tuning pairs.
- **Status:** Dead. Heroku host returns 404; `text-davinci-003` is retired;
  `openai` 0.19 SDK. README is still the OpenAI quickstart.
- **Reused:** The prompt idea (keywords → first-person sentence, pronoun-set
  handling) → `packages/ai/src/prompt.ts`. The frequency-vocabulary idea →
  planned [Vocabulary Builder](tools/vocabulary-builder.md), rewritten to run on
  the user's own data in-browser.
- **Left behind:** Flask server, fine-tuning, all committed data files.

### gpt-access-client (2023)
- **Did:** Word-cloud communication board. Words sized by frequency, letter
  prefix filter, words/names toggle, pronoun-set row, grammar tags, insert-at /
  swap reordering, auto-generate 0–3 replies, keyboard shortcuts.
- **Status:** UI loads on GitHub Pages; generation dead (backend gone).
- **Reused (concepts, re-implemented):** frequency-sized words, letter filter,
  pronoun row, sentence reordering, full-width speak-on-tap replies →
  `apps/phrase-board`.

### speech-assist (2024)
- **Did:** First "listen and respond" prototype: transcribe the room, show 40
  words per color-coded page, pick words + intent, get 3 GPT replies.
- **Status:** Superseded. Called OpenAI directly from the browser (key exposure
  by design).
- **Reused:** Color-coded pages and automatic black/white text contrast
  (`getPageColor` / `getTextColor`) → `packages/access-ui/src/color.ts`
  (reimplemented with WCAG relative luminance). Intent categories.

### speech-assist-app (2024)
- **Did:** The mature listen-and-respond client: auto-advancing word pages,
  phrase extraction with `compromise`, intent buttons, speech synthesis, on-screen
  keyboard modal. ~1,229-line single component.
- **Status:** UI loads; backend (Render) times out. Deploy workflow commented out
  after a long fight with API-key handling. `deepgram-attempt-dec0324` branch
  abandoned.
- **Reused:** Intent model, "create phrase", speak-on-select, on-screen keyboard
  concept → `apps/phrase-board`. `utils/phraseRecognition.js` is earmarked for
  [Listen & Reply](tools/listen-and-reply.md). The key-handling saga is the
  direct motivation for the BYO-key design.

### speech-assist-server (2024)
- **Did:** 40-line Express proxy hiding the OpenAI key.
- **Status:** Render free tier asleep/timing out. Open CORS, no rate limit, no
  auth — anyone could spend the key.
- **Reused:** Nothing. Replaced by the BYO-key model (no server at all).

### notion-access (2023)
- **Did:** Let a composer who can't use keyboard/mouse write in Notion (music
  notation software) via Keyboard Maestro macros (chord builder, note/octave
  pickers, calibration) and five macOS Accessibility Keyboard dwell panels
  (~564 buttons).
- **Status:** Works as a personal config; Mac-only; tied to screen coordinates.
- **Reused:** Design reference for [Dwell Panels](tools/dwell-panels.md) and
  basis for the [Mac Toolkit](tools/mac-toolkit.md) release.

### tictacto-client, metronome-client
Bootcamp-era; no accessibility functionality. Not reused.

## Cross-cutting problems the rebuild fixes

| Problem in legacy | Fix in access-suite |
|---|---|
| Paid API key shipped in / proxied for a free static app | BYO key, browser-direct, stored only on the user's device; AI optional |
| Backends on free tiers that sleep or vanish | No backend |
| Retired models / ancient SDKs | Thin `fetch` adapters, model id is a setting |
| Single 800–1,200-line components | Small components, shared UI package |
| No tests, no licenses | Unit + E2E + axe in CI; MIT |
| Touch-only interaction | Switch scan, dwell, keyboard first-class |

## ⚠️ Privacy finding — action recommended (not taken)

Two **public** repos contain what appears to be a real person's personal data:

- `accessible-language-generation`: `MessageBank.json`, `transcripts.csv`,
  `training_data*.jsonl`, `words.db` — derived from voice-banking recordings,
  including intimate care phrases.
- `accessible-language-generation` and `gpt-access-client`: `names.json` — real
  first names ranked by frequency.

No API keys or secrets were found in any repo or its history.

**Recommendation:** make both repos private now (fast, reversible). If they
should stay public as portfolio history, remove the files *and* rewrite history
(`git filter-repo --path <file> --invert-paths`) then force-push, since deleting
in a new commit leaves them in history. Nothing in access-suite contains or
derives from this data.
