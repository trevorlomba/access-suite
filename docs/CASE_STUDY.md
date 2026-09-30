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

**What broke:** Heroku's free tier ended; davinci was retired. And the
personalization only worked for one person: the real vocabulary had to live in
a private fork, because a public tool can't ship anyone's words.

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

**Word grids are split into rows**, so a switch user scans row → word (about
√n steps) instead of stepping through every word.

**The boards fit one screen.** Dwell users can't scroll, and scrolling moves
words out from under a switch user, so Phrase Board and Listen & Reply fill
exactly the screen: header and message on top, the board takes the height
left, sized from its own measured box. Tiles never shrink below the user's
button size to make this work; a category that doesn't fit pages behind a
"More" tile in the last cell. Category tabs run down the side on landscape
screens, where width is spare, and across the top on portrait ones. Only when
the screen can't hold even one row at the chosen size does the page scroll.

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
  - the boards fit one screen with no scrolling across six screen sizes,
    button sizes from 48 to 120 px and their fullest states, with no button
    below the user's size and no label cut off
- All of it runs in CI on every PR.

### Results so far

- Three tools shipped as MVPs: Phrase Board, Listen & Reply, Vocabulary
  Builder. 70 unit tests and 67 E2E/axe checks pass.
- Initial JS is about 57 KB gzipped for the board; the Anthropic SDK (about
  49 KB gzipped) loads only if the user turns AI on.

### Listen & Reply: Generation 2, rebuilt

The 2024 idea (reply using the partner's words) on the new foundation. The
phrase-recognition module was ported to a tested `board/transcript`. Because
browser speech recognition rarely adds punctuation, questions are detected
from the first word ("do you…", "are you…"), and a yes/no question gets
one-tap Yes / No / Maybe replies. If the partner keeps talking, a reply in
progress is kept.

### Vocabulary Builder: the data pipeline, made private

Personalization was what made Generation 1 fast, and what kept it private to
one family. The Vocabulary Builder rebuilds that pipeline so anyone can run it
on their own data without it leaving the device:

```
parse (stg) → tag (int) → aggregate (int) → phrases (int) → rank (mart) → human review → export
```

- Each stage is a pure, unit-tested function, organized like a dbt project.
- It runs in a Web Worker so large inputs don't block the page.
- Multi-word names are merged back together ("Red Sox", "Dr Patel").
- Words already on the starter board are skipped, and phrases made only of
  board words ("I want") are dropped.
- Output is a versioned, validated JSON file. The Phrase Board and Listen &
  Reply read it as a "My words" category.
- An E2E test fails if any network request leaves the site during processing.

## What's next

Dwell Panels (custom big-button layouts, sharing the input layer), the Mac
Toolkit release, and offline install (PWA).
