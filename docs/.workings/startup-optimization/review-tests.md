# review-tests — #13 injectable storage seam

Under review: `tests/storageBackend.test.js`, nine cases.

## Dimension 1: coverage completeness — conclusion: adequate for this ticket, with declared gaps

The ticket carries one checklist row (row 1: startup logic cannot be exercised without a real
extension context). Its declared backing is "injected backend driven by an in-memory fake — test",
and every case in this file runs with **no `chrome` global present**, asserted in a `beforeEach` so
a stray global leaking in from another module fails loudly rather than quietly making the suite
meaningless.

Covered: the memory backend's own contract (round trip, area separation, operation counting), the
migration's populated and empty paths, the four primitives through the injected backend, and
`checkStorage`.

Declared gaps, recorded rather than papered over:

- **The Chrome-backed path is not exercised anywhere.** These tests prove the logic is correct given
  a backend; they cannot prove `chromeStorageBackend` itself talks to Chrome correctly. That needs a
  real extension context and belongs to the closeout ticket (#19), which owns extension-mode
  verification.
- **`initializeStorage` has no coverage** because it was deliberately not converted (reasons in
  review-code.md). Ticket #18 will need it.
- **`migrateToEncrypted` has no coverage.** It routes through the now-injectable primitives, so it is
  reachable in principle, but exercising it needs a working `EncryptionService`, which requires
  browser crypto and fingerprinting globals. Left to #14, which owns that migration.

## Dimension 2: case design — conclusion: no findings

- Zero `vi.mock`/`vi.spyOn` anywhere in `tests/` — verified by search, empty output. The backend is a
  system boundary supplied through a constructor parameter, not a patched module.
- Every assertion goes through a public interface: the exported functions, or the backend's own
  read methods. No private state is written directly.
- Every state used in setup is reachable through a public path: the memory backend is seeded through
  its documented `seed` argument, and the migration cases observe it through `localGet`/`syncGet`.
- No assertions on call ordering. The one count-based assertion (`calls.localSet`) asserts an
  externally meaningful fact — whether a write happened at all — not an implementation detail of how
  it happened.

## Dimension 3: false passes — one found and fixed

Two cases were green on their very first run, so both were mutation-tested rather than trusted.

**1. "leaves local storage untouched when sync holds nothing to migrate" — was a false pass, now fixed.**

Three mutations were needed to establish this, and the first two are worth recording because each
failed for a different reason:

- *Mutation A* (bypass the inner `hasData` guard): no test went red. Not because the case was weak —
  **the mutation never reached the tested path**, since with nothing seeded the outer presence guard
  short-circuits first. A mutation that does not arrive proves nothing either way.
- *Mutation B* (bypass the outer presence guard): still no red. `hasData` then evaluated `undefined`
  as falsy, so the write still did not happen.
- *Mutation C* (bypass both, so a spurious write really occurs): still would not have been caught by
  the original assertion, because it compared **contents** with `toEqual({})` — and an object holding
  the key with an `undefined` value compares equal to an empty object. The case was structurally
  incapable of detecting a spurious write.

Fixed by asserting on the write itself (`calls.localSet` is 0) rather than on the resulting contents,
and re-verified: under mutation C the case now fails with "expected 4 to be +0". Restored afterwards
with a precise inverse edit, never a version-control restore, and the suite is green again.

**2. "getStoredValue answers null for a key the backend does not hold" — verified genuine.**

*Mutation D* removed the null normalisation from the backend branch, reproducing the pre-existing
inconsistency where the extension path returned `undefined`. Two cases went red with
"expected undefined to be null", and the failures landed on the mutated behaviour. Restored, green.

Remaining cases all went red during their own red-green cycle, each for the reason it was written to
guard (missing module, then ignored backend, then `localStorage is not defined` where the primitives
still fell through to the development path).

No always-true assertions, no un-awaited async assertions, no conditional skips.

## Fixture provenance

There is no external data source here — the fixtures are storage keys drawn from the production
`STORAGE_KEYS` list and the migration's own key list, so they are not an independent invention.
Where a value's shape mattered (the mapping object), it was modelled on the shape the Drive mapping
store actually persists rather than on an imagined one.

---

# review-tests — #21 invariant case

## Dimension 1: coverage — the invariant, not the mechanism

One case added, asserting both halves of what startup must guarantee for these keys: **every mapping
key present in sync ends up in local** (data preserved) and **none is left in sync** (quota freed).
Asserting only the first would have let a fix that abandons the quota goal pass; asserting only the
second is what the buggy code already satisfied.

Its key list is **sourced from the production `STORAGE_KEYS`** rather than retyped, so renaming a key
breaks this test loudly instead of quietly leaving it seeding keys nothing reads. Retyped names were
the first draft and were replaced for exactly that reason.

Declared gap: the case exercises the migration against the memory backend. It does **not** prove the
real extension's operation ordering, which is what ticket #21 asks for as evidence and what remains
outstanding.

## Dimension 2: case design — no findings

Seeds through the backend's documented seed argument, asserts through its public read methods, no
mocking of our own modules, no assertions on call order.

## Dimension 3: false passes — verified genuine by mutation

The case passes against the fixed code, so it was mutation-tested rather than trusted: the pre-fix
startup order was reproduced by removing the four keys from sync before running the migration. The
case failed with `expected undefined to deeply equal { drive_location_mappings_value: true }` — the
data loss itself, named in the failure. Restored with a precise inverse edit and green again.

This is the mutation that matters here: it reproduces the actual reported defect, not a nearby one.

---

# review-tests — #22 singleton import probe

## Dimension 1: coverage — one case per module, by design

Eight cases, one per singleton module, so a failure **names the module** instead of reporting that
"something in the import graph broke". The module list is generated by a recorded command rather
than from memory, and the file says so, including the warning that a newly added singleton missing
from the list is a gap in the file rather than evidence none exists.

The `beforeEach` asserts `chrome`, `screen` and `localStorage` are all absent. Without it the suite
could pass because some earlier module leaked a global, which is precisely the condition being
tested against.

## Dimension 2: case design — no findings

No mocking of our own modules; each case performs a real dynamic import and asserts the module
object exists. Nothing reaches into private state.

## Dimension 3: false passes — seven cases were never red, so the probe was mutation-tested

`llm.js` produced a genuine red before the fix (`localStorage is not defined`). The other seven were
green from the first run, so the probe itself was checked rather than trusted: an unguarded
`screen.width` was added to `linksService`'s constructor.

Two cases went red, which is the correct result and more informative than one:

- `linksService` — the mutated module.
- `quickLinksService` — which imports it, demonstrating the probe also catches **transitive**
  unloadability, the actual failure mode being guarded against.

Both named their module in the failure. Restored with a precise inverse edit; 43 green again.

Note for whoever extends this file: the mutation had to be placed in a **constructor**. Putting it in
a method would not have turned anything red, because only construction runs at import — and a
mutation that cannot reach the tested path proves nothing.

---

# review-tests — #14 migration markers

## Dimension 1: coverage — every ticket criterion has a case, except one measured by evidence

Five cases added: repeat startup does no per-key traffic; a never-migrated user still migrates; a
failed copy is retried rather than marked; the encryption migration skips when marked; and it stays
unmarked when it could not encrypt. The round-trip criterion is **evidence**, not a case — measured
before and after through the counting backend and re-confirmed in the running app.

Declared gap: `migrateToEncrypted`'s *successful* path is still uncovered, because encryption cannot
initialise in this environment — the device key needs browser fingerprinting globals. What is covered
is the marker behaviour on both sides of it. Extension-mode verification belongs to the closeout.

## Dimension 2: case design — one refinement worth recording

An existing case, "writes nothing to local storage when sync holds nothing to migrate", **legitimately
broke** when the marker was introduced: the marker is itself a local write, so a write-count assertion
was no longer the right contract. It was rewritten to assert that no *mapping key* was written, by
counting keys present in the result rather than comparing objects — a key set to `undefined` compares
equal to an absent one, so a contents comparison could not tell a spurious write from no write.

This is a contract refinement, not a weakening: the new assertion still fails on a spurious mapping
write, which is what the case was protecting.

## Dimension 3: false passes — both never-red cases mutation-verified

The two encryption-marker cases were green on their first run, because the implementation was written
before them — a discipline lapse, recorded rather than hidden. Both were therefore mutated:

- **Marker check removed** from `migrateToEncrypted` → "a marked run returns immediately" failed with
  `expected undefined to be true`. Only that case failed.
- **Marks done even when encryption was unavailable** → "a run that could not encrypt is not marked"
  failed with `expected true to be undefined`. Only that case failed.

Both failures landed on the mutated behaviour, and both were restored with precise inverse edits.

The three `migrateSyncToLocalStorage` cases were red first, for the right reasons: the repeat-startup
case reported `expected 8 to be 4` (the re-run), and the retry case reported
`expected undefined to deeply equal { a: 1 }` — the stranded-data defect itself.
