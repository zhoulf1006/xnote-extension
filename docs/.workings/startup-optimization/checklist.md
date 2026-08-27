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
| 8 | Mapping keys are read one per round trip although the API accepts arrays | #18 | Backend read-call count asserted — test |
| 9 | Sensitive keys are read one per round trip | #18 | Backend read-call count asserted — test |
| 10 | Drive state is read across eight sequential round trips for a connected user, one key twice | #18 | Backend read-call count asserted — test |
| 11 | Batched reads must handle absent and empty keys identically to per-key reads | #18 | Present/absent/empty cases — test |
| 12 | Batched reads must degrade like the per-key path on backend failure | #18 | Rejecting backend case — test |
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
| 22a | The startup sequence has no seam, so its ordering cannot be tested at all | #18 | Sequence driven with injected steps — test |
| 22b | Row 16 is backed by store-level state under a hang, not by the startup sequence proceeding past it | #18 | Hanging Drive step, the other startup steps still complete — test |

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

## Ownership changes

**Rows 8–12 moved from #15 to #18** (2026-08-27). #15 was closed as superseded, not dropped, and
these rows are why the distinction matters: a row still pointing at a closed ticket is how a
requirement quietly stops being anyone's.

What changed under those rows, stated precisely rather than as "mostly fixed":

- Rows 8 and 9 (mapping keys, sensitive keys) are now reached only on a run where the corresponding
  migration has not completed, because #14 added completion markers. They did not stop existing —
  a first-ever startup still performs them. What changed is that they left the *repeat* startup path,
  which is the one every open after the first takes.
- Row 10 (Drive state) is unchanged in cost. #17 moved it off the critical path, so it no longer
  delays anything the user waits for, but every round trip is still issued. Re-counting it while
  re-homing the row showed the original "five-plus" understated it: for a connected user the chain
  is eight sequential reads, and `GOOGLE_DRIVE_CONNECTED` is read twice — once by the store and
  again inside the authentication check it then calls. The row now carries the counted figure.
  Counted with `grep -c "await getStoredValue("` over the Drive store and service, then walked by
  hand through the connected branch; recorded because a "five-plus" that nobody re-derives is how
  an estimate becomes a fact.

So one row is genuinely still on the hot path and two are on a path taken once per install. All
three are reads in the same code #18 restructures, which is the reason to fold rather than to keep
a separate ticket — not a claim that the work became unnecessary.

**Rows 22a and 22b added** — the missing startup seam, and the part of row 16 that is not actually
covered yet.

Row 16 reads "Drive init blocks the rest of startup" and names a test as its backing. Tests using a
never-settling Drive service do exist, so the row is not unbacked — but what they assert is the
*store's* behaviour under a hang: that it reports itself initializing, that waiting for readiness
resolves, that a sync request queues instead of reporting "not connected". None of them asserts the
claim the row actually makes, which is about the **startup sequence** continuing past a hung step.
That assertion has nowhere to live: `onMounted` runs its steps inline, so there is no way to drive
the sequence and observe what completed.

The distinction is easy to lose, and losing it is the failure mode: the row looks backed, the tests
are real and green, and the sentence the row states has still never been checked. Row 22b carries
that remainder explicitly rather than leaving it inside a row that reads as done. Recorded here so
"every ticket is closed, therefore the feature is done" cannot come out true while it stands.

## Not in scope

- The Font Awesome CDN dependency (the actual cause of the slow menu) — already fixed separately.
- The unconditional 200 ms startup delay — already removed separately.
