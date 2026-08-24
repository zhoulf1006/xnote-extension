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

---

# review-code — #22 import-time browser globals across the singleton modules

Change surface: `vitest.config.js` (`@` alias), `llm.js` (guarded provider read plus a guarded
persist helper), `tests/moduleImport.test.js` (new).

## [1] Underlying premises — findings

- **The question was unanswerable before, and that was the real blocker.** Vitest had no `@` alias,
  so several modules failed on module *resolution* — indistinguishable from failing for their own
  reasons. Mirroring the alias from `vite.config.js` made the probe meaningful; only then could the
  enumeration produce an answer rather than noise.
- **"Only `encryptionService` was affected" is now proven, not assumed.** Of the eight singleton
  modules, seven load cleanly and exactly one — `llm.js` — did not. Before this ticket that was
  explicitly recorded as unknown.
- **My first enumeration was wrong, and the correction matters.** The initial pattern matched only
  `… = new X()` and silently missed the `export default new X()` form, hiding `linksService`,
  `encryptionService` and `quickLinksService`. The widened pattern found 8 modules where the first
  found 5. Recorded because the failure mode is exactly the one the ticket warns about: an
  enumeration that looks complete and is not.

## [2] Runnability — findings

- **Browser behaviour is unchanged**, verified in the running app rather than argued: the provider is
  still read at construction (`gemini`), switching still persists (`deepseek`), and the previous
  selection was restored afterwards so the app was left as found.
- **The unhandled rejection was a real second defect, not noise.** Guarding only the constructor's
  read left the suite failing: the eager `setProvider()` reached a `localStorage.setItem` inside its
  own `catch` block, which threw again and rejected. Three write sites existed, all now routed
  through one guarded helper.

## [3] Security correctness — conclusion: no findings

Guarding a write changes neither what is written nor where.

## [4] Consistency — findings

- One guarded helper rather than three inline guards, so a fourth write site cannot quietly reappear
  unguarded next to guarded ones.
- **Declared deviation from the ticket.** #22 asks for defects to be "fixed by deferring the
  browser-dependent work out of construction, as #13 did". `llm.js` was **guarded** instead of
  deferred. Deferring would move when `requiresConfiguration` becomes accurate, and `chatService`
  reads that flag *before* calling `chat()` — so deferral changes user-visible error behaviour on the
  first call, which is beyond what this ticket asked for. Guarding satisfies the acceptance criterion
  (module imports cleanly, values unchanged) with no behaviour change at all.

## Refactor list (not blocking)

1. `llm.js` still starts asynchronous provider initialization **inside its constructor**, so importing
   the module performs storage I/O before the app has decided anything. Guarding made it harmless,
   but it remains a design smell — impact: self-inflicted; suggestion: defer to first use *together*
   with giving `chatService` an explicit readiness check, since the two must change together.

---

# review-code — #14 migration markers

Change surface: `storageService.js` (`migrateSyncToLocalStorage`, `migrateToEncrypted`, two marker
constants), `tests/storageBackend.test.js` (five cases added, one refined).

## [1] Underlying premises — findings

- **Markers belong in local storage, not sync** — deliberate, for two reasons. Per-device is the
  correct scope: each device migrates its own copy, and a device that has never migrated must still
  do so even if another already has. And a sync-stored marker would consume the very write quota this
  ticket exists to stop consuming.
- **The measurement is real, not projected** — the before and after were both measured through the
  counting backend, and the after was re-confirmed in the running app: a repeat startup goes from
  4 reads plus 4 writes to a single marker lookup.
- **In development mode the encryption migration still runs every reload**, because the marker is only
  written when a real backend is available. Deliberate: the development path has no chrome storage to
  mark against, and marking there would be meaningless. Noted so it is not mistaken for a defect.

## [2] Runnability — findings

- **A second data-loss path was found by the red test and fixed.** The migration previously removed a
  key from sync "even if the read or the store failed". With markers alone, a failed copy would have
  removed the source and then retried against nothing. The removal now happens only after the copy
  succeeds, or when there was nothing to copy. This is a behaviour change beyond "stop re-running",
  and it is in scope: the ticket's criterion is that a partial failure must not strand data.
- **A partial failure leaves the work unmarked**, so the next startup retries. Covered by a case that
  fails one key's write and then asserts the retry succeeds.
- **A failed read is treated as unsettled, not as absent** — otherwise a transient read error would
  look like "no data here", remove the key, and destroy it.
- **`migrateToEncrypted` marks only on a fully clean run** (`errors.length === 0`), so one failing key
  keeps the whole migration retryable.

## [3] Security correctness — conclusion: no findings

The encryption migration's logic is unchanged; it gained a backend parameter and a completion marker.
No key material is logged or persisted differently.

## [4] Consistency — findings

- Both markers are **versioned** (`..._v1`), and each constant's comment states what it records, so a
  future migration adds its own marker rather than silently riding on an existing one.
- The two migrations now follow the same shape: check marker, do work, mark only on full success.

## Refactor list (not blocking)

1. The marker constants are module-local rather than part of `STORAGE_KEYS`. Left deliberately: they
   are internal bookkeeping, not user configuration, and putting them in `STORAGE_KEYS` would sweep
   them into `checkStorage`'s dump and the sensitive-key iteration. Worth revisiting only if a third
   marker appears.

---

# review-code — #16 opt-in storage diagnostics

Change surface: `storageService.js` (`checkStorage`, new `isStorageDebugEnabled`, flag constant),
`CLAUDE.md` (the switch documented), `tests/storageBackend.test.js` (two cases added, one retired).

## [1] Underlying premises — findings

- **Nothing branched on the return value** — verified at both call sites, not assumed: one logs the
  status on the very next line, the other discards it entirely. Gating the expensive part was
  therefore safe.
- **A second call site turned up that the ticket did not mention**: `checkStorage()` also runs inside
  `saveConfig`, so the whole sync store was being read on **every Save**, not only on startup. The
  same change covers it; recorded because the ticket's framing ("on every panel open") understated
  the cost.
- **The flag lives in localStorage rather than in stored settings** — deliberate: reading a setting
  would itself cost the round trip the switch exists to avoid.

## [2] Runnability — findings

- **The returned shape is unchanged whether the switch is on or off**, so both call sites keep
  working: `devStorage` is still computed, since that is a cheap local read, and only the
  whole-store dump and the per-key legacy scan are gated.
- **Verified end to end in the running app**, not only in tests: with the flag absent the whole-store
  read count is 0; with it set to `'true'` it is 1; and `isStorageDebugEnabled()` agrees with the flag
  in both directions.
- The flag read is wrapped in try/catch, so a storage-access exception degrades to "off" rather than
  breaking startup.

## [3] Security correctness — one incidental improvement

`chrome.storage.sync.get(null)` dumped **the entire store to the console on every panel open**,
including the encrypted API-key entries, and `devStorage` was printed alongside it. The values are
encrypted, so this was not a plaintext leak, but dumping everything unconditionally is more exposure
than a diagnostic warrants. It is now off unless someone asks for it.

## [4] Consistency — findings

- The flag name `xnote-debug-storage` follows the existing `xnote-` localStorage prefix used by
  `xnote-llm-provider` and `xnote-api-keys`.
- The switch is documented in CLAUDE.md's testing section rather than only in a code comment, so it is
  discoverable by someone debugging rather than only by someone already reading this function.

---

# review-code — #17 non-blocking Drive initialization

Change surface: `stores/googleDrive.js` (injectable service, initialization state, readiness gate,
`syncAll` guard), `App.vue` (startup no longer awaits, indicator conditions), `tests/driveInit.test.js`.

## [1] Underlying premises — findings

- **The prototype gate was cleared by choice, not by omission.** The user selected reusing the
  existing dot vocabulary, so connecting maps to the amber pulse and failure to the red dot that
  already exist. No new visual form is introduced, which is the declared exemption; had a distinct
  "connecting" treatment been chosen it would have gone through a prototype round first.
- **The four states are measurably distinct**, verified by computed style rather than by eye:
  amber `rgb(255,193,7)` pulsing, red `rgb(224,49,49)`, green `rgb(76,175,80)`, grey
  `rgb(108,117,125)`.
- **Not verified**: the states as driven by a *real* Drive call in the extension. Dev mode has no
  `chrome.identity`, so the store was driven directly. The rendering path is real; what is simulated
  is the cause. Extension-mode confirmation belongs to closeout #19.

## [2] Runnability — findings

- **A defect the ticket did not anticipate, fixed here**: the previous `initialize()` set
  `isAvailable = false` in its catch, and the nav entry renders `v-if="isAvailable"`. A failed
  initialization therefore made the whole Storage & Sync entry **disappear**, leaving no way to open
  it and retry — the opposite of the ticket's "leaves the panel usable" requirement. Availability is
  now the capability question only; failure is carried by `initFailed`.
- **`syncAll` would have misreported the cause.** Reached during initialization, `isConnected` is not
  yet final, so it returned "Not connected to Google Drive" — a claim about a fact it could not yet
  know. It now awaits readiness first.
- **Initialization never rejects**: the promise settles either way, and `whenReady()` resolves on both
  paths, so a caller cannot hang on a failure.
- **The indicator cannot show connected and connecting at once** — `connected` is conditioned on
  `!isInitializing`, so the states are mutually exclusive rather than merely ordered in CSS.

## [3] Security correctness — conclusion: no findings

No change to what is stored, requested or logged.

## [4] Consistency — findings

- The injectable-service parameter follows the same defaulted-argument shape used by the storage
  backend in #13, rather than inventing a second injection style.
- `isUsable()` is optional on the service: production `googleDriveService` does not define it and
  falls back to the browser check, so nothing about the real path changed.

## Refactor list (not blocking)

1. The startup sequence in `App.vue`'s `onMounted` still has no seam, so "the rest of startup
   completes while Drive hangs" is covered by observation rather than by a test. #18 needs that seam
   to test ordering and should introduce it.
