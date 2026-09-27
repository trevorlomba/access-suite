# Access Suite — Strategy

> Working name. Free, local-first communication and access tools for people with
> severe speech and motor impairments, and the people who care for them.

## Why this exists

Between 2023 and 2024 I built two generations of AI-assisted communication aids
for a person living with severe speech and motor impairment (see
[LEGACY_AUDIT.md](LEGACY_AUDIT.md)), plus a macOS dwell-control toolkit that let a
composer who could no longer use a keyboard or mouse keep writing music.

They worked, for a while, for one person. None of them survived contact with
time: free hosting tiers disappeared, the model they depended on was retired,
and every version fought the same problem — how do you ship a paid API key in a
free static web app?

This suite is the rebuild: the same ideas, designed so they **cost nothing to
run, cannot break when a vendor changes, and work for anyone who opens the
link.**

## Who it's for

| Person | What they need |
|---|---|
| **AAC user** — ALS/MND, locked-in syndrome, brainstem stroke, cerebral palsy, post-intubation, aphasia | Say what they mean with the fewest possible selections; be understood by strangers, not just family |
| **Switch / dwell / head-pointer user** | Every control reachable by one or two switches, dwell, or keyboard — not "mostly" |
| **Caregiver, nurse, SLP** | Set a tool up in minutes on whatever device is on hand, with no account, no install, and nothing to pay for |

## Principles

1. **Free forever, $0 to run.** Static files only. No server, no database, no
   account. Hosting is GitHub Pages.
2. **Local-first and private by default.** Vocabulary, saved phrases, usage
   frequencies and settings live in the browser. Nothing is sent anywhere unless
   the user turns on an AI feature with their own key.
3. **AI is an accelerator, never a dependency.** Every tool is fully useful with
   AI off. When on, it uses the user's own provider key (Anthropic or OpenAI),
   called directly from their browser. No proxy for anyone to abuse; no bill
   for the project.
4. **Every input method is first-class.** Touch, mouse, keyboard, single-switch
   auto-scan, two-switch step-scan and dwell are all tested in CI, not bolted on.
5. **Accessibility is verified, not asserted.** Automated axe scans, keyboard-
   only and scan-mode end-to-end tests gate every merge.
6. **Degrade gracefully.** Missing speech synthesis, speech recognition, or
   storage produces a clear message and a working fallback — never a blank
   screen.

## Tool roadmap

| # | Tool | Status | One-liner |
|---|---|---|---|
| 1 | [Phrase Board](tools/phrase-board.md) | **MVP built** | Tap or scan words into a sentence, speak it, optionally let AI expand it |
| 2 | [Listen & Reply](tools/listen-and-reply.md) | **MVP built** | Transcribe what someone says to you, turn it into word buttons, reply in a few taps |
| 3 | [Vocabulary Builder](tools/vocabulary-builder.md) | **MVP built** | Turn your own texts/transcripts into a personal, frequency-ranked vocabulary — in-browser |
| 4 | [Dwell Panels](tools/dwell-panels.md) | Spec | Build custom dwell/scan button panels that speak phrases or send keystrokes |
| 5 | [Mac Toolkit](tools/mac-toolkit.md) | Spec (later) | Documented Keyboard Maestro + Accessibility Keyboard panels; possible SwiftUI menu-bar app |

Tools 1–4 share one codebase and one set of input primitives
(`packages/access-ui`), so every improvement to scanning or dwell lands in all
of them at once.

### Sequencing

1. **Now:** Phrase Board MVP, shared UI kit, CI with accessibility gates.
2. **Next:** Listen & Reply (reuses the board; adds speech recognition and
   phrase extraction). Go public on GitHub Pages.
3. **Then:** Vocabulary Builder (feeds personal vocabulary into 1 and 2),
   import/export of settings and phrases as a JSON file.
4. **Later:** Dwell Panels, Mac Toolkit release, PWA/offline install,
   translations.

## Architecture in one paragraph

An npm-workspaces monorepo. `packages/access-ui` holds the accessible input and
output primitives (big buttons, scanning, dwell, speech, settings).
`packages/ai` holds a provider-agnostic `generate()` with Anthropic, OpenAI and
mock adapters. Each tool is a small Vite + React + TypeScript app under `apps/`,
and `apps/hub` is the landing page. One build step assembles everything into a
single static site for GitHub Pages.

## Success measures

- **For users:** time-to-first-spoken-sentence under 10 seconds on first visit;
  median selections per spoken message (lower is better); works with one switch.
- **For quality:** 0 serious/critical axe violations; keyboard-only and
  scan-only E2E tests green on every PR; Lighthouse accessibility 100.
- **For reach:** listed in at least one AAC/assistive-tech resource directory;
  feedback from at least one SLP or AAC user before v1.0.

## Portfolio framing

This is a product and engineering story, not a tutorial clone:

- **Real users, real constraints.** Designed from lived experience with a
  locked-in user; input-method constraints drive the architecture.
- **Shipping discipline.** Monorepo, typed, tested, CI-gated, documented, free
  to host, with a documented threat model for the BYO-key design.
- **Data thinking.** Vocabulary Builder is a small in-browser data pipeline
  (tokenize → normalize → rank → export) — the same modeling instincts as
  analytics engineering, applied to language.
- **Evolution.** The [case study](CASE_STUDY.md) shows three generations of the
  same idea and why each architectural decision changed.

## Open decisions

- Final name (working name: *Access Suite*).
- When to make the repo public and turn on Pages.
- License for starter vocabulary content (currently MIT with the code; all
  starter words are generic core vocabulary, no personal data).
