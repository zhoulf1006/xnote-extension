# review-tests — #31 storageReadiness tests

Six cases in `tests/storageReadiness.test.js`. Suite: 90 (was 84; +6, −0 — the deleted
`summaryMappings.js` had no tests to delete with it, which is consistent with it having
had no consumers either).

## Dimension 1: coverage — findings

Coverage list = the ticket's three acceptance criteria (no spec exists for a bug ticket):

| Criterion | Backing |
|---|---|
| Mid-flight mount still gets migrated data — test | "still loads the migrated mappings, not the pre-migration emptiness" — the mid-flight state is genuinely driven: the backend's `localSet` takes a real turn, and mutation Q (removing the await) turned exactly this case red, proving the claimed boundary is the one being exercised |
| All readers of the four migrated keys covered — evidence | Enumeration recorded (grep of `getLocalValue`, `loadMappings`, store usages): live readers are the three `driveMappings.loadMappings` call sites, all covered by the one awaiting action; `summaryMappings.js` read the other three keys but has had zero consumers since a5ccd3e and is deleted with proof in the commit body. One mechanism, not per-site fixes |
| Existing suite stays green — test | 90/90 |

Also covered beyond the criteria: reader-first start (nothing guarantees startup asked
first), failed-run degradation, and failure visibility to the startup prerequisite.

**Declared gaps** (in the file header, not only here): the App.vue wiring — nothing
proves startup goes through the same singleton the stores default to; a fresh-instance
mistake would split the run and turn nothing red. Same class as #18's declared wiring
gap; owned by #19's extension-mode run. The repeat-startup fast path (marker already
set) is exercised at the migration layer in `storageBackend.test.js`, not re-proven
through the reader.

**Fixture sourcing**: the data is the app's own storage shapes, not third-party; the
mapping value used is shaped like `driveMappings`' real structure (locations keyed by
folder ID with `summaries`/`chats` maps), copied from the store's own documentation of
its state rather than invented flat values.

## Dimension 2: case design — findings

- No `vi.mock`/`vi.spyOn`/`vi.fn` anywhere in the file (verified by search); every
  double is a hand-written object passed through an injection seam.
- All states reachable through public paths: seeded backends model what real storage
  holds; `createStorageReadiness(migrate)` is the same factory production uses.
- Interaction assertion exemption, recorded: the two run-counting cases count
  invocations of the injected migrate function. Single-flight *is* the requirement —
  there is no output that distinguishes one shared run from two identical runs.

## Dimension 3: false greens — findings

All six cases were first red only against a missing module — a red that validates
nothing about assertion sensitivity. Every one has since been driven red by a mutation
that reintroduces the specific defect it guards:

| Mutation | Case(s) turned red |
|---|---|
| Q remove the reader's await | mid-flight case; reader-first case |
| R start a run per caller | single-flight case; join-in-flight case |
| S reader propagates the failure | degraded-read case |
| T ensure swallows the failure internally | failure-visibility case |

Mutation T is worth naming: the swallowing implementation was a design I considered
during implementation, so the case guards a road actually not taken, not a strawman.
Attribution checked for each (failure at the matching assertion), restoration by
re-copying the pre-mutation snapshot of the mutated file only.

No conditional skips, no tautologies (expected values are literals or independently
seeded data, never recomputed via the implementation), all promises awaited
(`rejects.toThrow` included).

---

## Addendum (2026-09-03) — write-side cases

Two cases added with the folded-in write-side fix (suite 90 → 92):

- "is not overwritten by the legacy data the migration is copying" — first red showed
  the exact clobber (`folder-legacy` winning over the fresh write), so the red's cause
  is precisely the defect the case guards. Formal mutation U (removing the writer's
  await) turned it red again after the fix; restored to green.
- "a failed migration does not block the write either" — first red was a missing
  signature (`backend` ignored), which is the wiring half of the same claim; its
  degradation assertion is the same shape as mutation-S-verified read-side case.

State setup assigns `store.locations` directly, with the reachability noted in the
case: the state is reachable via `setCurrentLocation`, which is not used because that
action also persists — the very step under test.
