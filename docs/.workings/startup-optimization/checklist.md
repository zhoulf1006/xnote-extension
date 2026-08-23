# Startup optimization — acceptance checklist

There is no spec for this work: it originated as a performance investigation rather than a
requirement, so the rows below are derived from the enumerated findings instead. The enumeration
was mechanical, not impressionistic — every `await` on the `onMounted` startup path, and every
storage operation reachable from each of them — so that "the tickets cover everything" rests on a
reproducible listing.

Enumeration used (re-runnable):

- startup steps: `awk '/^onMounted\(async/,/^\}\);/' src/sidepanel/App.vue | grep -nE "await [a-zA-Z]"`
- migration call sites: `grep -rn "migrateSyncToLocalStorage\|migrateToEncrypted" src/`
- diagnostics call sites: `grep -rn "checkStorage" src/`

| # | Finding | Ticket | Criterion backing it |
|---|---|---|---|
| 1 | Startup logic cannot be exercised without a real extension context, so it has no automated coverage | #13 | Injected backend driven by an in-memory fake — test |
| 2 | `migrateSyncToLocalStorage` re-reads four mapping keys on every open, forever | #14 | Second startup performs no migration reads — test |
| 3 | The same migration issues four unconditional `sync.remove` writes per open, burning sync write quota | #14 | Second startup performs no migration writes — test |
| 4 | `migrateToEncrypted` re-reads five sensitive keys on every open, forever | #14 | Second startup performs no migration reads — test |
| 5 | A never-migrated user must still migrate correctly once gating exists | #14 | Pre-migration data seeded, placement asserted — test |
| 6 | A partially failed migration must not be marked done | #14 | Failing write retried on next startup — test |
| 7 | The migration gate is only safe if the migrations are startup-only | #14 | Call-site grep output recorded — evidence |
| 8 | Mapping keys are read one per round trip although the API accepts arrays | #15 | Backend read-call count asserted — test |
| 9 | Sensitive keys are read one per round trip | #15 | Backend read-call count asserted — test |
| 10 | Drive state is read across five-plus separate round trips | #15 | Backend read-call count asserted — test |
| 11 | Batched reads must handle absent and empty keys identically to per-key reads | #15 | Present/absent/empty cases — test |
| 12 | Batched reads must degrade like the per-key path on backend failure | #15 | Rejecting backend case — test |
| 13 | `checkStorage()` reads the entire sync store on every open, purely to log it | #16 | No read-all reaches the backend with the switch off — test |
| 14 | Its return value is never used for control flow, so gating it is safe | #16 | Call-site grep output recorded — evidence |
| 15 | The debug switch must be discoverable rather than folklore | #16 | Documented in CLAUDE.md — evidence |
| 16 | Drive init blocks the rest of startup despite the panel being usable without it | #17 | Hanging Drive init still lets startup complete — test |
| 17 | Drive init can make network calls, so a slow or offline connection stalls startup | #17 | Rejected Drive init leaves a settled state — test |
| 18 | The Drive status indicator must show the resulting state, not a permanent spinner | #17 | Screenshots of connected / connecting / failed — evidence |
| 19 | Drive-dependent actions invoked before init settles must not silently no-op | #17 | Action-during-init case — test |
| 20 | Independent steps are serialised for no reason | #18 | Independent steps observed overlapping — test |
| 21 | The one genuine prerequisite must keep its ordering | #18 | Ordering asserted for the dependent step — test |
| 22 | One step failing must not prevent the others, and must still surface | #18 | Rejecting-step case — test |

## Rows owned by the closeout ticket

These only exist once the tickets are combined; no single ticket's range contains them, so each
would legitimately skip them.

| # | Requirement | Ticket | Criterion backing it |
|---|---|---|---|
| 23 | The real side panel still starts correctly in extension mode with all changes active | #19 | Unpacked extension exercised, observations recorded — evidence |
| 24 | An upgrading user still migrates correctly through the new gated path in a real extension | #19 | Extension-mode run seeded with pre-migration data — evidence |
| 25 | The end-to-end round-trip count actually dropped | #19 | Counts measured before the first ticket and after the last — evidence |
| 26 | Markers, batching and concurrency together produce a correct end state | #19 | Full startup path with all changes active — test |
| 27 | No `docs/features/` entry became false (expected: none, since no user-visible behaviour changes) | #19 | features-catalog closeout conclusions recorded — evidence |

## Not in scope

- The Font Awesome CDN dependency (the actual cause of the slow menu) — already fixed separately.
- The unconditional 200 ms startup delay — already removed separately.
