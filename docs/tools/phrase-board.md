# Phrase Board

**Status:** MVP built · `apps/phrase-board`

Compose a message by selecting words, hear it spoken, and — optionally — let AI
turn a few words into full sentences to choose from.

## User stories

- As an AAC user, I select "I", "want", "water" and press **Speak** to be heard.
- As a switch user, the board highlights each row, then each word, and I press
  my one switch to choose.
- As a dwell/head-pointer user, I rest the pointer on a word to select it.
- As a user with an AI key set, I select "water" "cold" and pick from three
  suggested sentences like "Could I have some cold water, please?".
- As a frequent user, the words I use most grow larger and the phrases I save
  are one selection away.

## Features (MVP)

- **Categories** (color-coded pages): Core, People, Needs, Feelings, Actions,
  Describe, Questions, Social. Starter vocabulary is generic core vocabulary.
- **Pronoun row** always visible (I, you, we, he, she, they, it, my, your).
- **Letter filter**: narrows the current page to words starting with a letter.
- **Frequency sizing**: each spoken message increments local word counts; more
  frequent words render larger (bounded so targets never shrink below minimum).
- **Sentence bar**: shows the message; each word can be moved left/right or
  removed; Backspace / Clear / Speak / Save controls.
- **Type a word**: on-screen keyboard for words not on the board.
- **Saved phrases**: one-select speak; delete.
- **Intent + AI suggestions** (only when a key is configured): Statement,
  Question, Yes, No, Casual. Up to 3 full-width suggestions; selecting one speaks
  it.
- **Input methods**: touch/mouse, keyboard, single-switch auto-scan, two-switch
  step-scan, dwell. Configured in Settings.

## Non-goals (MVP)

Multiple user profiles, cloud sync, symbol/pictogram sets (licensing), grammar
morphology (plurals/tenses) beyond what AI provides.

## Acceptance tests (automated)

- Keyboard-only: Tab to words, Enter to add, Speak calls speech synthesis with
  the composed text.
- Single-switch scan: Space selects row then word; message updates.
- Mock AI adapter returns suggestions; selecting one speaks it.
- axe: zero serious/critical violations in default and high-contrast themes.
