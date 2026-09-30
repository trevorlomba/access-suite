# Listen & Reply

**Status:** Spec · successor to `speech-assist` / `speech-assist-app`

When someone speaks *to* an AAC user, the fastest reply usually reuses their
words. Listen & Reply transcribes the conversation partner, turns what they said
into selectable word and phrase buttons, and lets the user reply in a few
selections.

## Flow

1. Partner taps **Listen** (or the user selects it) and speaks.
2. Transcript appears; distinct words become a color-coded word page; detected
   phrases (e.g. "the doctor", "this afternoon") become phrase buttons.
3. User selects a few words + an intent (Yes / No / Question / Statement).
4. Optional AI proposes up to 3 replies grounded in the transcript. Without AI,
   the selected words go straight to the Phrase Board sentence bar.
5. Selected reply is spoken.

## Design notes

- **Speech recognition:** Web Speech API where available (Chromium, Safari).
  Feature-detected via `useListen` in `packages/access-ui`; unsupported browsers
  show a typed-input fallback so the partner can type instead.
- **Privacy:** browser speech recognition may be processed by the browser vendor
  (Chrome sends audio to Google). Say so plainly in the UI; offer a "typed only"
  mode.
- **Phrase extraction:** port `speech-assist-app/src/utils/phraseRecognition.js`
  (compromise NLP: noun phrases, questions, commands) into a tested module.
- **Shared board:** reuse Phrase Board's grid, scanning, dwell, sentence bar and
  AI package. The transcript page is just another category.

## Prompt

Extends `packages/ai/src/prompt.ts` with a `context` field: the last N
transcript utterances, so replies answer what was actually asked.

## Acceptance

- Transcript → word page unit tests (dedupe, stop-word handling, order).
- E2E with a stubbed recognizer emitting a fixed utterance.
- Works end-to-end with AI off.
