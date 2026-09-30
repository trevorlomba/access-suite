# Dwell Panels

**Status:** Spec · inspired by `notion-access` Accessibility Keyboard panels

The macOS Accessibility Keyboard Panel Editor lets you build custom on-screen
button panels that a dwell or head-pointer user can operate. It's powerful and
Mac-only. Dwell Panels brings the idea to the browser: design a grid of large
buttons, each of which speaks a phrase, opens another panel, or copies text.

## Features

- Panel editor: grid size, button label, color, action.
- Actions: **speak** text, **go to** panel, **copy** to clipboard, **append**
  to a message bar.
- Operate with dwell, switch scan, keyboard or touch (shared `access-ui`).
- Panels saved locally; import/export as JSON to share a layout between
  devices or caregivers.
- Starter templates: "Care needs", "Yes / No / Maybe", "Pain scale 0–10",
  "Quick social".

## Limits (explicit)

A web page cannot send keystrokes to other apps. System-wide control stays in
the [Mac Toolkit](mac-toolkit.md); Dwell Panels is for communication and for
use inside the browser.

## Acceptance

- Build a 2-panel layout in the editor, export, re-import, identical result.
- Dwell selection works with a pointer resting on a button for the configured
  time; moving off cancels.
