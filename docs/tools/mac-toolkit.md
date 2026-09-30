# Mac Toolkit

**Status:** Spec (later phase) · from `notion-access`

## Phase 1 — documented release of what exists

Package the `notion-access` Keyboard Maestro macros and Accessibility Keyboard
panels as a versioned GitHub release others can install:

- Install guide with screenshots: enabling Accessibility Keyboard, Dwell,
  Head Pointer; importing `.kmmacros` and `.ascconfig`.
- **Calibration guide:** the macros click window-relative positions; document
  how to recalibrate for a different screen size / Notion version.
- Demo video (existing GIF + a narrated walkthrough).
- License (MIT) and a clear "tested with" matrix (macOS, Keyboard Maestro and
  Notion versions).

## Phase 2 — generalize

- Extract the non-Notion-specific ideas into a reusable panel pack: window
  management, text editing, media control, "speak this" buttons.
- Replace coordinate clicks with menu-item and Accessibility-API actions where
  Keyboard Maestro supports them, so panels survive layout changes.

## Phase 3 — optional native app

A small SwiftUI menu-bar app that runs panels defined in the same JSON schema as
web [Dwell Panels](dwell-panels.md), using the macOS Accessibility API for
system-wide actions. Only if Phases 1–2 show demand; requires notarization and
an Apple Developer account ($99/yr — the only non-zero cost in the roadmap).
