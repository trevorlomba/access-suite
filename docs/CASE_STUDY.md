# Case study: three generations of an AI communication aid

## The problem

A person with locked-in syndrome or late-stage ALS can often understand
everything but move very little: an eyebrow, a finger, gaze. Every letter
costs effort, so an ordinary sentence can take minutes. Commercial AAC
(augmentative and alternative communication) devices help, but they are
expensive, often locked to one device, and slow to set up when a family is
already overwhelmed.

I first built for one specific person. The question since then has been how
to make what worked for them work for anyone, for free, and keep it working.

## Generation 1: gpt-access (2023)

**Idea:** Let the user pick a few keywords, then let a language model write
the sentence.

- React/TypeScript word-cloud board. Words were sized by how often *this
  person* said them, a frequency list built by a Python pipeline from their
  voice-banking recordings.
- Flask backend on Heroku calling `text-davinci-003`, with pronoun-set handling
  ("we/us/ours") so sentences came out in the right voice.

**What broke:** Heroku's free tier ended; davinci was retired. The personal
data lived in the repo, which was fine for one family and wrong for a
public project.

## Generation 2: speech-assist (2024)

**Idea:** Flip the input. When someone speaks *to* the user, transcribe it and
turn the partner's words into buttons, because the fastest reply usually
reuses the question's words.

- Browser speech recognition, 40-word color-coded pages, intent buttons
  (yes / no / question / casual), spoken replies.
- An Express proxy on Render to hide the OpenAI key.

**What broke:** The commit history is a long fight with key handling
("debugging for API key", "omg15"). The proxy had open CORS and no rate
limit, so anyone could have spent the key. The free tier slept, and the app
grew into a single 1,229-line component.

## Generation 3: Access Suite (2026)

The lesson from both: **the fragile part was never the UI, it was the server.**
So this generation has none.

| Decision | Why |
|---|---|
| Static site on GitHub Pages | $0 forever; nothing to go down or be abused |
| AI optional, bring-your-own key, called browser-direct | Removes the proxy entirely; the project never holds a secret or a bill |
| Every feature works with AI off | Communication can't depend on a vendor or a network |
| Local-first storage | Personal vocabulary is health-adjacent data; it shouldn't leave the device |
| Input-method layer shared by all tools | Switch scanning and dwell are the product, not an add-on |

### Architecture

```
apps/phrase-board ─┐                     ┌─ Anthropic SDK (lazy-loaded)
apps/hub ──────────┼─► packages/ai ──────┼─ OpenAI fetch (lazy-loaded)
                   │                     └─ demo adapter (no network)
                   └─► packages/access-ui
                         AccessInput  → scanning (Scanner) + dwell
                         ScanGroup    → opt-in markup contract
                         useSpeak / useListen / SettingsProvider
```

**Scanning is DOM-driven, not registration-driven.** Any component opts in by
wrapping buttons in a `ScanGroup`. The `Scanner` walks visible groups in DOM
order, confines itself to the top-most dialog, skips disabled items, and backs
out of a row after two unanswered loops. That keeps new tools accessible by
default: there is no scan-order registry to forget to update.

**Word grids are split into rows sized to the viewport**, so a switch user
scans row → word (about √n steps) instead of stepping through every word.

**Colors follow the Modified Fitzgerald Key**, the AAC convention where yellow
means people, green verbs, blue descriptors, and so on. A unit test checks
that every tile color meets WCAG AAA (7:1) against its text.

### Verifying accessibility, not asserting it

- `eslint-plugin-jsx-a11y` (strict) in lint.
- Unit tests for the scanner state machine, color contrast, prompt building
  and response parsing, and message editing.
- Playwright E2E on desktop and phone viewports:
  - compose and speak using **only the keyboard**
  - compose with **two-switch step-scan** and **one-switch auto-scan**
  - **dwell** selects on hover, cancels on leave, and doesn't repeat
  - axe scans with zero serious or critical violations across 7 UI states ×
    light/dark, plus high contrast
  - no horizontal scroll at 360 px
- All of it runs in CI on every PR.

### Results so far

- Phrase Board MVP: 33 unit tests and 41 E2E/axe checks passing locally.
- Initial JS is about 57 KB gzipped for the board; the Anthropic SDK (about
  49 KB gzipped) loads only if the user turns AI on.

## What's next

Listen & Reply (Generation 2's idea on Generation 3's foundation), then the
Vocabulary Builder: the 2023 voice-banking pipeline rebuilt as an in-browser,
privacy-preserving tokenize → rank → review → export flow.
