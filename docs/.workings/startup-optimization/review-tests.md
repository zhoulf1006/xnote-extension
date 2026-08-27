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

---

# review-tests — #16 opt-in diagnostics

## Dimension 1: coverage

Two cases: with the switch off nothing reads the whole store, and with it on the same information is
still reported. Both also assert the returned status keeps its shape, because that is what the two
production call sites consume — gating the expensive work would be a regression if it changed what
callers receive.

The remaining criterion (the switch is discoverable) is **evidence**, not a case: it is documented in
CLAUDE.md.

## Dimension 2: case design — one case retired, deliberately

The earlier case "reports the backend as the active storage and reads what it holds" asserted
`syncGet > 0` on a plain `checkStorage(backend)` call — an assertion that **encoded the always-on read
as the contract**. That is exactly the behaviour this ticket changes, so keeping it would have meant
either a failing suite or weakening it into vacuity. It is superseded by the "switch on" case, which
makes the same assertion about the same behaviour, now under the condition where it belongs.

Recorded rather than quietly deleted: retiring a test because it contradicts a change is legitimate
only when something else still covers the behaviour, and here it does.

## Dimension 3: false passes — mutation-verified

The "switch on" case passed on its first run, so the pair was mutated: making `checkStorage` ignore
`verbose` (reverting to always-on) turned the "switch off" case red with `expected 1 to be +0`, and
only that case. Restored, green.

Note the asymmetry: the "switch off" case is the one carrying the guarantee, and it was red before the
implementation. The "switch on" case guards against over-correcting into a switch that never dumps.

---

# review-tests — #17 non-blocking Drive initialization

## Dimension 1: coverage

Four cases: an in-flight initialization reports as initializing; a failure settles into a defined
failed state while keeping the entry in the rail; `whenReady()` resolves once initialization settles;
and a Drive action invoked mid-initialization waits instead of misreporting.

**Declared gap**: the ticket's first criterion — "startup completes while Drive init hangs" — is met by
observation, not by a case, because `App.vue`'s `onMounted` has no seam to drive. What was observed:
the panel mounted with all seven nav items and an interactive chat tab while Drive had not settled.
Recorded as a refactor item for #18 rather than left implicit.

The indicator criterion is **evidence**: computed colours and animation names for all four states.
That is stronger than a screenshot for "distinctly", since it compares the actual rendered values
rather than relying on the reader's eye.

## Dimension 2: case design — no findings

The Drive service is injected as a plain fake through a defaulted parameter; no module mocking. The
hanging fake returns a promise that never settles, which is a real condition rather than a simulated
one. Assertions read store state through the store's own interface.

## Dimension 3: false passes — the one case written alongside its implementation was mutated

Three cases were red first, for the right reasons (`expected undefined to be true` — the state did not
exist yet, and `store.whenReady is not a function`).

The fourth, "syncing waits for initialization rather than reporting not connected", was added in the
same step as its guard, so it was mutation-tested: removing the `whenReady()` await turned it red with
`expected true to be false` — the silent settle it exists to prevent. Only that case failed. Restored,
green.

Note on why the assertion is shaped as it is: it checks both that the call has **not settled** and that
`lastSyncError` is still null. Checking only settlement would pass if the call resolved with a wrong
error; checking only the error would pass if the call hung for an unrelated reason.

---

# review-tests — #18 startup seam, batched reads, concurrent independent steps

31 cases added across `startupSequence.test.js` (9), `startupSteps.test.js` (6),
`migrationBatching.test.js` (7), `driveReadBatching.test.js` (5) and the new
`batched reads` block in `storageBackend.test.js` (4). Suite: 53 → 84.

## Dimension 1: coverage — findings

There is no spec for this work, so the coverage list is the checklist rows #18 owns.
All ten are answered, each by a named case:

| Row | Case |
|---|---|
| 8 mapping keys per round trip | "all four mapping keys are fetched in a single call" |
| 9 sensitive keys per round trip | "every sensitive key is fetched in a single call" |
| 10 Drive reads | "three configuration keys cost one read, not three"; "initialization never fetches the connected flag itself"; "the remaining store keys are fetched together in one call" |
| 11 absent/empty identical to per-key | "answers exactly what the per-key path answers, key for key"; "a key that is absent comes back as an own property, not a hole" |
| 12 degrade on backend failure | "a rejecting backend degrades like the per-key path and writes nothing" |
| 20 independent steps overlap | "a dependent starts while an earlier one is still unfinished"; "diagnostics does not wait for the encryption migration" |
| 21 prerequisite ordering | "no dependent starts until the prerequisite has finished" |
| 22 one failure contained + surfaced | "the others still complete and the failure is reported" |
| 22a sequence driveable with injected steps | all of `startupSequence.test.js` |
| 22b hung background step | "startup completes while a background step hangs forever" |

**Declared gaps** (written into the test file headers, not only here):

- **The App.vue call site is not covered.** `buildStartupSteps` proves the roles are
  assigned correctly; nothing proves App.vue hands the *real* functions to the right
  roles. Passing the wrong function there turns nothing red. Closing it needs a started
  panel — #19's extension-mode run.
- **No case runs against real chrome.storage.** Every case here drives the in-memory
  backend. Its fidelity to chrome.storage — in particular that a missing key is an
  absent property rather than an undefined one — is an assumption inherited from #13,
  not re-derived here, and every case using it inherits that assumption too.
- Extension-mode behaviour generally belongs to #19.

**Fixture sourcing.** The rule targets external/third-party data. The values here are
the app's own (storage keys it wrote itself), so there is no third-party sample to copy
shapes from. The one genuinely external shape that matters is chrome.storage's own
response convention, which is modelled in the memory backend — flagged above as
inherited rather than independently verified, which is the honest description.

## Dimension 2: case design — findings

- **No mocking of our own modules.** Verified by search, not by recollection: no
  `vi.mock`, `vi.spyOn` or `vi.fn` in any of the four files. Every double is a
  hand-written object passed through an injection seam.
- **No private access and no unreachable state.** `globalThis.screen` is supplied in
  `migrationBatching.test.js` — that is providing an environment a real browser has, not
  reaching into the service. `secureStorageService.initialize()` is a public method.
- **Interaction assertions — exemption taken and recorded.** Counting `backend.calls`
  is asserting on an interaction, normally a rewrite trigger. The exemption applies:
  chrome.storage is a system boundary, and the round-trip count is not a detail behind
  the requirement, it *is* the requirement. No observable output distinguishes one
  batched read from three separate ones. Noted in `driveReadBatching.test.js`'s header
  so the exemption travels with the code.
- **Ordering asserted through deferred promises, not timers.** A concurrency case built
  on `setTimeout` races only proves one delay is shorter than another and goes green on
  sequential code whenever the machine is fast enough.

## Dimension 3: false greens — findings

**Every case was asked "when would this go red?".** For the load-bearing ones the answer
was checked by mutation rather than asserted: 19 of 31 cases have been driven red by a
deliberate defect and restored. Each mutation was confirmed to land on the tested path,
to fail at the matching assertion, and was reverted by restoring a pre-mutation snapshot
of that file only — never by checking the file out, which would have discarded the
uncommitted real work along with it.

| Mutation | Case turned red |
|---|---|
| A sequentialise dependents | "a dependent starts while an earlier one is still unfinished" |
| B await background steps | "startup completes while a background step hangs forever" (by timeout) |
| C `Promise.all` for `allSettled` | "the others still complete and the failure is reported" |
| D omit absent keys | 3 cases in the batched-reads block |
| E per-key fetch in `getStoredValues` | "reads a group of keys in one backend call" |
| F rethrow instead of degrading | "a rejecting backend degrades like the per-key path" |
| G failed mapping read treated as no-data | "a failed batched read migrates nothing and stays unmarked" |
| H mapping keys read one at a time | "all four mapping keys are fetched in a single call" |
| I remove keys one at a time | "the keys are removed from sync in a single call" |
| J swallow encryption read failure | "a failed batched read is not recorded as a completed migration" |
| K per-key folder configuration | "three configuration keys cost one read, not three" |
| L restore the duplicate connected read | "initialization never fetches the connected flag itself" |
| M split the store's two settings reads | "the remaining store keys are fetched together in one call" |
| N demote the mapping migration to a dependent | both ordering cases in `startupSteps.test.js` |
| O per-key sensitive read | "every sensitive key is fetched in a single call" |
| P serialise the two dependents | "diagnostics does not wait for the encryption migration" |

**Why this mattered here.** Most of these cases first went red only because a module or
function did not exist yet — a red that proves the import resolves, not that the
assertion is sensitive to the defect it exists to catch. Treating that as validation
would have been a certificate written by the candidate. Mutation O and P specifically
covered cases whose only prior red was of that kind, and both were sensitive.

**One vacuous-pass shape found and fixed.** "answers exactly what the per-key path
answers" carries its comparison inside a `for` loop, so an empty key list would have
satisfied it while comparing nothing — and the assertions after the loop would still
have passed, since a zero-key batched read is still one call. A non-empty guard was
added.

**Remaining unmutated cases (12)** are value/regression guards whose red condition is
plain by inspection — "dependents receive the value the prerequisite resolved with",
"absent configuration keys still produce the documented defaults", and similar. They are
paired with mutated cases covering the same code path, so a defect there is caught by
the pair even where the guard alone was not separately driven red.

**Conditional-skip check: none present.** `migrationBatching.test.js` asserts
`encryptionEnabled === true` in its own case rather than skipping when encryption is
unavailable. An environment change turns that red instead of quietly passing the whole
block — the distinction the report cannot otherwise show.
