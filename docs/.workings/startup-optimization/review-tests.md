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
