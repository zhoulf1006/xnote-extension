# review-code — #13 injectable storage seam

Change surface: `storageBackend.js` (new), `storageService.js` (four primitives plus
`migrateSyncToLocalStorage` and `checkStorage` made backend-aware), `encryptionService.js`
(device key made lazy), `tests/storageBackend.test.js` (new).

## [1] Underlying premises — findings

Assumptions this change rests on, and how each was settled:

- **`chromeStorageBackend.isAvailable()` is equivalent to `isExtensionMode()`** — confirmed by
  reading both: each tests `chrome`, `chrome.storage` and `chrome.storage.sync`. The only
  difference is that the new one returns a boolean where the old returned the truthy value, and
  every use site is a condition.
- **No caller distinguishes `undefined` from `null` out of `getStoredValue`** — confirmed by
  searching every call site for strict comparisons; there are none. This mattered because the two
  branches already disagreed: the extension path returned `undefined` for a missing key while the
  development path returned `null`. Both now return `null`. This is a deliberate normalisation of a
  pre-existing inconsistency, not an accident.
- **Making `masterPassword` a getter is safe** — the property is read in exactly one place, is never
  assigned outside the constructor, and the instance is never enumerated, spread or serialised
  (searched for all three). A getter is therefore indistinguishable from the own property it replaced.
- **Not verified, stated as such**: whether the seam behaves identically inside a real extension.
  Every test here runs against the memory backend; the Chrome-backed path is exercised only by the
  existing manual flow. This is the same gap the ticket set exists to close, and the closeout ticket
  owns it.

## [2] Runnability — findings

- **Error paths preserved.** `migrateSyncToLocalStorage` keeps its "always remove from sync, even if
  the read or the store failed" contract; the restructure moved from one outer try/catch to
  per-operation ones, which makes the escape surface narrower rather than wider. A failure on one
  key is self-inflicted: it is logged and the loop continues to the next key. No same-layer or
  upward escape.
- **Retry semantics preserved.** `getStoredValue` and `storeValue` still route through
  `safeExecuteChromeAPI`; `getLocalValue` and `storeLocalValue` still do not, exactly as before.
- **Timeout preserved.** The 3000 ms guard moved from five duplicated inline promise wrappers into
  the backend, where it is written once.
- **`checkStorage` gained a `typeof localStorage` guard.** Production always has it, so no behaviour
  changes; it exists so the function can run outside a browser at all.
- **Test-only code does not ship.** `createMemoryBackend` is exported from a production module, so
  this was checked rather than assumed: it appears 0 times in the built bundle, having been
  tree-shaken because no production path imports it.

## [3] Security correctness — conclusion: no findings

The seam passes values through unchanged and introduces no new persistence, logging or transport of
secrets. Making the device key lazy does not change its value or its derivation, only when it is
computed.

## [4] Consistency — findings

- **Naming follows the existing precedent** set by the model catalog work (`createModelCatalog`,
  injected `cacheStore`): `chromeStorageBackend` as the default, `createMemoryBackend` for tests.
- **`isExtensionMode` is not orphaned** — still used in eight places outside the converted
  functions, so it was left alone rather than removed.
- **`removeStoredValue` was not converted** and still holds raw `chrome.storage` access. It is not on
  the startup path (it is not among the five awaits in `onMounted`), so it is out of this ticket's
  range, but it does leave the primitives inconsistent: four of five take a backend. Recorded in the
  refactor list below rather than widened into this change.
- **`initializeStorage` was not converted.** It is startup-path function #1, so this is a deliberate
  and declared gap rather than an oversight: what it does is environment bootstrapping — URL-based
  mode detection, polling for API availability, a liveness probe, secure-storage init — rather than
  storage I/O against an area. Injecting a storage backend would not make it testable; that needs the
  environment probes injected too. Neither #14 nor #15 needs it. Ticket #18 will, and this is noted
  there.

## Change-surface-external finding — reported, not fixed

**`initializeStorage` deletes the very data `migrateSyncToLocalStorage` then tries to migrate.**

`initializeStorage` issues a fire-and-forget `chrome.storage.sync.remove(problematicKeys)` for four
keys. `migrateSyncToLocalStorage`, called immediately afterwards, reads **the same four keys** from
sync in order to copy them into local storage. The two lists were compared and are identical:
`drive_location_mappings`, and the three summary mapping keys.

- **Impact**: for any user who still holds those keys in sync storage, the mapping data is destroyed
  instead of being moved to local storage. The observable effect is losing Drive folder and summary
  mappings — the migration silently finds nothing to migrate on every run.
- **Confidence**: the mechanism is clear and the key lists are confirmed identical, but the ordering
  itself is **inferred, not measured** — the remove is issued first against the same storage area and
  Chrome processes an area's operations in order. Confirming it requires a real extension context.
- **Recommendation**: fix as part of ticket #14, which already owns migration correctness and has an
  acceptance criterion for a never-migrated user migrating correctly. That criterion cannot honestly
  pass while this race stands.
- **Destination**: recorded on ticket #14 so it does not live only in this file.

## Refactor list (not blocking, for user decision)

1. Convert `removeStoredValue` to the backend for consistency with the other four primitives —
   impact: self-inflicted only; suggestion: fold into #15, which is already touching the primitives.
2. Make `initializeStorage` injectable, which needs the environment probes (`isExtensionURL`,
   `waitForChromeAPI`) injected alongside the storage backend — impact: self-inflicted; suggestion:
   do it in #18, where testing startup ordering requires it.

---

# review-code — #21 startup cleanup destroyed the data the migration moves

Change surface: `storageService.js` (`initializeStorage` — removal of the eager cleanup block),
`tests/storageBackend.test.js` (one invariant case added).

## [1] Underlying premises — findings

- **The migration frees the same quota the cleanup was there for** — confirmed: its key list holds
  the same four keys, and it calls `syncRemove` for each one inside the per-key loop. The new test
  asserts all four are absent from sync afterwards, so the quota goal is protected by a check rather
  than by argument.
- **Nothing between the two steps writes to sync**, which is what the cleanup's "must happen BEFORE
  any other storage operations" comment claimed to protect — confirmed by inspecting
  `encryptionService.initialize` and `secureStorageService.initialize`: neither performs a storage
  write. So there is no quota pressure in the gap the cleanup was covering.
- **Still inferred, not measured**: that the fire-and-forget remove actually completed before the
  migration's read in a real extension. The fix is safe either way — removing the cleanup cannot make
  matters worse — but ticket #21 carries an acceptance criterion asking for extension-context
  evidence, and **that criterion is not met by this change**. It is called out in the delivery notes
  as outstanding rather than quietly ticked.

## [2] Runnability — findings

- `initializeStorage` still returns its status object and still performs its remaining work; verified
  in the running app, which reported `storageType: localStorage`, `encryptionEnabled: true`.
- **Nothing else depended on the removed block** — searched for `problematicKeys` repo-wide, no
  remaining references.

## [3] Security correctness — conclusion: no findings

Deleting a destructive operation removes an unwanted side effect; nothing about secret handling
changes.

## [4] Consistency — findings

- The reason for the absence is written **at the site where someone would otherwise re-add it**,
  naming the failure it caused. A removal with no trace invites reinstatement by the next person who
  reads the quota comment in isolation.
