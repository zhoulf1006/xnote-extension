# review-code — #31 storage readiness for mapping readers

Change surface: `storageReadiness.js` (new), `driveMappings.js` (`loadMappings` awaits the
shared run), `App.vue` (prerequisite goes through the same run), `CLAUDE.md` (invariant
updated to name the mechanism), `summaryMappings.js` (deleted),
`tests/storageReadiness.test.js` (new).

## [1] Underlying premises — findings

- **The race does not even need Vue's children-first mount order.** The comment cites it,
  and it is true (Vue 3 mounts depth-first, children's `onMounted` before the parent's),
  but the race holds under the weaker fact too: the two `onMounted` callbacks are not
  ordered by any await — a child's proceeds while the parent's is still awaiting storage.
  The fix depends on neither claim, which is the point: ordering is owned by the data
  path now, not by mount timing of any kind.
- **"First asker's backend wins" in `ensure(backend)`.** Verified against both production
  callers: App.vue passes nothing and `loadMappings` defaults to nothing, so production
  always runs against the chrome backend regardless of who starts the run. The parameter
  matters only for tests, where each case builds its own readiness instance.
- **Deletion safety of `summaryMappings.js`** — proven, not sampled, before deleting:
  identifier and store-id string matched only the file itself across `src`, `tests`,
  `background.js`, `scripts`, `public`; `git log -S` shows the store's sole consumer
  switched to `useDriveMappings` in a5ccd3e; the persisted `summary_*` keys are defined
  in `storageService.STORAGE_KEYS` and the migration continues to preserve them. Full
  proof in the commit body, which is the deletion's authorization record.

## [2] Runnability — findings

- **Failure paths walked end to end.** The memoized run rejecting: a reader swallows it
  and reads anyway (self-harm surface — that read serves whatever local holds, which
  beats nothing); the startup prerequisite awaits the same promise and still surfaces
  the failure as a toast — including when a reader *started* the run, since joiners get
  the same rejected promise. No unhandled rejection: the starter always attaches a
  handler synchronously (the reader's `.catch` or the prerequisite's `await`).
- **Concurrent readers**: both join one run, both then read, last assignment wins with
  identical data. No cross-item escape.
- **Existing call sites re-walked**: `googleDrive.initialize` (background, post-
  prerequisite) and `connect` both call `loadMappings()` argument-less → default
  readiness, run already resolved → zero added latency in the common case.
- **Reported, not fixed — the write-side mirror of this race.** `setCurrentLocation`
  writes `drive_location_mappings`; a write landing while the migration's copy is in
  flight could be overwritten by legacy sync data. Enumerated all four call sites: two
  (init, connect) are preceded in-flow by the now-awaiting `loadMappings`, so they are
  ordered; the two in location-change user actions are not. Reachability: a legacy
  user's very first startup on the new version AND a location change inside the
  migration's milliseconds of flight — strictly narrower than the read race this ticket
  fixes, and pre-existing. Escape surface: self-harm (that user's own mapping write).
  Recommended handling: not now; if wanted, `saveToStorage` awaiting the same readiness
  is a two-line follow-up. Home: raised in the PR for a decision — it has no persistent
  owner otherwise.

## [3] Security correctness — conclusion: no findings

Reviewed rather than skipped: no new persistence, network, or logging; the module logs
nothing at all. The deletion only removes code.

## [4] Consistency — findings

- CLAUDE.md's ordering invariant was written against the #18 mechanism (step placement);
  this change replaces the mechanism, so the invariant was updated in the same commit —
  the exact "rule ↔ what enforces it" pair that goes stale when only one side moves.
- `startupSteps.js`'s comment ("part of storage readiness rather than a step of its
  own") was re-read against the new arrangement: still accurate, now literally so.
- Smells: `createStorageReadiness` factory-with-default matches the repo's established
  seam pattern (`createModelCatalog`, `createMemoryBackend`) — not speculative
  generality; the singleton is the production instance, the factory is the test seam.

## Refactor list

Empty — nothing deferred beyond the write-side finding above, which is a decision for
the user rather than a refactor.
