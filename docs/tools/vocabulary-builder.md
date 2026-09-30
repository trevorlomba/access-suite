# Vocabulary Builder

**Status:** Spec · reimagines the `accessible-language-generation` data pipeline

A starter vocabulary is generic. A person's *own* words — names of family, the
nurse, their dog, their favorite team — are what make an AAC board fast. The
2023 project built this from voice-banking recordings with Python scripts and a
SQLite file. This tool does the same thing, for anyone, entirely in the browser,
and the data never leaves the device.

## Inputs

- Pasted text, `.txt`, `.csv` (choose a column), `.json` message banks.
- Optional: an existing Access Suite vocabulary export to merge.

## Pipeline (in-browser, Web Worker)

```
raw text ─► normalize (case, punctuation, contractions)
         ─► tokenize (words + 2–3-word phrases)
         ─► tag (proper noun / pronoun / verb / other via compromise)
         ─► filter (stop-word handling, min count, profanity toggle)
         ─► rank (frequency, recency weight)
         ─► review UI (keep / drop / rename / assign category)
         ─► export vocabulary.json  ─► import into Phrase Board / Listen & Reply
```

Modeled as small pure functions with unit tests on each stage — the same
staging discipline as a dbt project (`stg_` → `int_` → `mart_`), applied to
language data.

## Output schema

```json
{
  "version": 1,
  "categories": [{ "id": "people", "label": "People", "words": [{ "text": "Maria", "count": 42 }] }],
  "phrases": [{ "text": "call the nurse", "count": 12 }]
}
```

## Privacy

No network requests during processing (asserted in an E2E test by failing on
any outbound request). Clear "your data stays on this device" copy.

## Acceptance

- Deterministic output for a fixture corpus (snapshot test).
- 1 MB of text processed in < 2 s on a mid-range laptop without blocking the UI.
