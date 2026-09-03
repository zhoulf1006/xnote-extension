# review-code — #34 stray empty-string key + #35 isEncryptedFormat boolean

Change surface: `encryptionService.js` (one return wrapped), `testStorage.js` (deleted),
`tests/encryptionFormat.test.js` (new), `tests/fullStartup.test.js` (workaround removed).

## [1] Underlying premises — findings

- **#34's conclusion is a negative claim, so it was settled by enumeration, not
  sampling**: every write route to chrome.storage — `storage.sync/local.set`,
  `syncSet`/`localSet`, `storeValue`/`storeLocalValue`/`storeSecureValue` — across
  `src`, `background.js` and both content scripts. Every key is a non-empty literal, a
  `STORAGE_KEYS` constant, or a timestamped self-removed test key; background and
  content scripts issue zero writes. **No current writer can produce `{'': ''}`.** The
  stray key predates current code; sync storage also propagates across the profile's
  devices, so an old build anywhere could have seeded the sync side.
- The comment added at the fixed return states a cause (`&&` yields its last operand)
  that the first red demonstrated directly — both faces of it: the byte array for
  encrypted input, `undefined` for a wrong-shaped envelope.

## [2] Runnability — findings

- Caller-compatibility for #35 verified by enumeration: three callers branch on the
  result (truthiness-identical before/after); the one non-branching caller stores it
  into `backupEncryptedData`'s `isEncrypted` field — and `backupEncryptedData` itself
  has **no callers**, so no live path can observe the change at all.
- **Deletion of `testStorage.js`** — dead and broken: no importer, no html/manifest or
  dynamic reference (searched); it reads `STORAGE_KEYS.AZURE_OPENAI_KEY`, which stopped
  existing at b369788, so if revived it would write a key named `"undefined"` — the
  same class of landmine #34 exists to clean. Proof recorded in the commit body.

## [3] Security correctness — conclusion: no findings

The boolean wrap narrows an output type; nothing new is stored or logged.

## [4] Consistency — findings

- `backupEncryptedData` observed to be dead code — **reported, not deleted** (outside
  this surface; deleting a public-looking method of a live service is a decision, not a
  tidy-up). Impact: none (unreachable). Suggested: leave, or fold into a future
  encryption-service cleanup. Raised in the PR so it has a recorded home.

# review-tests — #35 encryptionFormat.test.js

**Dimension 1 (coverage)**: the ticket's criterion is exact-boolean answers for
encrypted / plain / malformed input — one case each, plus empty/non-string inputs.
The encrypted-shaped fixture is built by hand from the documented envelope format,
not by calling `encrypt()`, so the expectation cannot move in step with the code
under test. `fullStartup.test.js`'s unwrapped assertion re-proves the fix against a
value produced by the *real* encryption path.

**Dimension 2 (design)**: no mocks, no private access; drives the public method with
literal inputs. Conclusion: no findings.

**Dimension 3 (false greens)**: both meaningful cases were red first against the
genuine defect — the array-for-true and undefined-for-false reds *are* the failure
modes the cases guard, so their validity needs no separate mutation. The always-false
inputs went green immediately; their red condition (a format-checker that accepts
plain strings) is the inverse of the first red's evidence. No conditional skips, no
tautologies.
