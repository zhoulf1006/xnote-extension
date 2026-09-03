# Extension-mode verification — closeout ticket #19 (2026-09-03)

Unpacked `dist/` (dev-marked, v1.1.1 + all startup tickets) loaded in the user's Chrome;
panel driven by the user pasting recorded snippets, outputs pasted back verbatim.

## Round 1 — panel starts, data intact (checklist row 23)

Panel opened and rendered (the console was reachable from inside it). Redacted full dump
of both storage areas showed the migrated steady state:

- All three configured API keys stored in the encrypted envelope (`eyJpdiI6…` =
  base64 `{"iv":[…`), none in plain text — invariant "never store API keys unencrypted" observed live.
- Both migration markers `true` in local storage.
- `drive_location_mappings` ({8 keys}) in **local**, absent from sync — the migrated placement.
- Drive flags (`connected: true`, folder id present), model selections, and Quick Links
  (`seg_links_data`) present and in the expected areas.
- No `summary_*` keys in either area — consistent with the store that wrote them having
  had no consumers since a5ccd3e.

Startup console log lines were not captured in the paste-backs; the functional evidence
(panel rendered; round 2's migration executed end to end on a fresh open) is the record.

**Observation, out of scope, needs a home**: both areas contain a stray empty-string key
(`"": ""`). Pre-existing, harmless (bytes only), but something once wrote `{'': ''}`.
Raised to the user; candidate for a small cleanup ticket.

## Round 2 — seeded pre-migration upgrade (checklist row 24)

Seed chosen so no real data could be clobbered: `summary_folder_mappings` (absent
everywhere per round 1; the user's real `drive_location_mappings` was not in sync, so a
migration re-run could not overwrite the local copy). Seeded into **sync**, then the
sync-to-local marker removed, then the panel closed and reopened.

Verified after the fresh open, verbatim from the paste-back:

| Check | Result |
|---|---|
| Seeded key removed from sync | `sync_summary: {}` |
| Seeded key landed in local, value intact | full seeded object present |
| Marker re-set after the clean run | `storage_migration_sync_to_local_v1: true` |
| Real mapping data untouched | `drive_mappings_intact: 8` |

## Declared gaps this run closes

1. **Array-form `chrome.storage.sync.remove`** (#18 review: grounded in shipped code,
   "not measured in a live extension") — the migration's batched remove ran against real
   sync storage and the key is gone. Measured now.
2. **App.vue → startup-steps / storageReadiness wiring** (#18 and #31 declared gaps) —
   the shipped wiring, and nothing else, ran the migration to the correct end state in a
   real panel. Stated precisely: the evidence proves the migration executed and
   re-marked through App.vue's wiring; it does not distinguish *which* asker started
   the shared run (the prerequisite or a mapping reader joining first), because both
   routes are the same shipped wiring and converge on one single-flight run — that
   indistinguishability is the #31 design working, not a hole in the evidence. The
   role-assignment half (prerequisite vs dependent vs background) stays covered by
   `startupSteps.test.js` plus the fact that App.vue passes `buildStartupSteps(...)`
   straight into `runStartupSequence` with no reshaping in between.

Cleanup: the seeded `summary_folder_mappings` left in local; removal one-liner given to
the user (nothing reads the key either way).
