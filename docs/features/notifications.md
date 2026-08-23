# In-app messages and confirmations

## Overview

Success, failure and confirmation prompts used to be invisible in the side panel: the browser suppresses native dialogs there, so errors never appeared and destructive buttons looked like they did nothing. All feedback is now rendered by the app itself — toasts, a confirmation dialog, and a category picker.

## Capabilities

- Operation results appear as toasts at the bottom of the panel, in three severities: success (green), error (red), and informational (blue).
- Error toasts stay until dismissed with their close button; success and informational toasts disappear after a few seconds.
- At most three toasts are shown at once; when a new one arrives the oldest leaves.
- Toasts float above the content instead of pushing it down, and remain readable while the LLM Config dialog is open, so errors raised inside that dialog are still seen.
- Deleting, disconnecting, clearing history, and changing the storage location all ask for confirmation first; cancelling changes nothing.
- Saving a page into Quick Links from the right-click menu offers a list of categories with the number of links in each, instead of asking for a typed number.

## Boundaries and non-goals

- Toasts keep no history: once dismissed or expired they cannot be recalled, though the full detail is also written to the developer console.
- Repeating the same message shows it again; identical messages are not merged or counted.
- Toasts offer no undo — the confirmation dialog is the only point where an action can be stopped.
