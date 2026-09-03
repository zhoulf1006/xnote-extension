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

---

# review-code — #18 startup seam, batched reads, concurrent independent steps

Change surface: `startupSequence.js` (new, machinery), `startupSteps.js` (new, role
assignment), `storageService.js` (`getStoredValues` added; both migrations batched),
`storageBackend.js` (`syncRemove` accepts arrays), `googleDriveService.js`
(`getFolderConfiguration` batched), `googleDrive.js` (duplicate read removed, settings
batched), `App.vue` (`onMounted` wired to the seam), four test files.

## [1] Underlying premises — findings

- **chrome.storage accepts an array on `get` and on `remove`.** The whole batching
  change rests on this. Settled from shipped code rather than from documentation:
  `storageService.js:173` has always called `syncGet([key])`, and
  `screenshotService.js:210` ships `chrome.storage.local.remove(['screenshotHistory'])`.
  `remove` is the same method on the same `StorageArea` interface for both areas, and
  array length is not a distinct parameter type. **Not measured in a live extension** —
  no chrome APIs are reachable from the test environment. #19 exercises the real thing
  in extension mode and is where this stops being inference.

- **A comment in `tests/storageBackend.test.js` recorded a false cause.** It said
  encryption was unavailable in the test environment. Probed it: Web Crypto *is*
  available (`EncryptionService.isAvailable()` returns true), and the case passes
  because the shared service was never initialised. Initialising additionally needs
  `screen`, which the device-key derivation reads. Corrected in place. This is the
  layer-1 failure mode exactly: a passing test carrying an explanation that would have
  sent the next reader down the wrong path, indistinguishable in the source from a
  grounded one.

- **Removing the store's `google_drive_connected` read is behaviour-preserving.**
  Checked against the old logic rather than assumed: old code set `isConnected` from the
  stored flag and then overwrote it with `isAuthenticated()` when truthy; the check
  itself reads the same flag and returns false when unset. Both paths yield the same
  value for both branches, and the falsy branch still makes no token call.

## [2] Runnability — findings

- **BUG FOUND AND FIXED — mapping migration raced Drive initialization.** Making the
  mapping migration an independent dependent let it run concurrently with Drive init.
  `driveMappings.loadMappings()` reads `drive_location_mappings` from **local** storage,
  and that migration is what moves the key sync→local. On the one startup where the move
  actually happens, Drive could read local first and find nothing. Escape surface:
  **same-layer** — one step corrupted by another's timing — so fixed rather than
  deferred. The migration is now part of storage readiness, which is what it always
  was: it does not tidy up, it relocates data other components read. Enumerated all four
  migrated keys and their readers first; the three summary keys are read the same way
  from local by `summaryMappings.js`, so the fix covers them too rather than only the
  one that surfaced. Regression test: `startupSteps.test.js` → "Drive initialization
  never begins before the mapping migration has finished". Verified by mutation:
  demoting the migration back to a dependent turns it red.

- **BUG FOUND AND FIXED (pre-existing) — a failed read marked the encryption migration
  complete.** `migrateToEncrypted` read through a helper that degrades a failed read to
  null, which is indistinguishable from "this key holds nothing". A transient storage
  failure therefore ended the run with zero errors and set the completion marker,
  leaving plain-text keys never encrypted. Escape surface: **upper layer** — it defeats
  the migration permanently, not just for that run. Now reports the failure and stays
  unmarked. The mapping migration reads raw for the same reason, where the consequence
  would have been worse still: keys that look empty get removed.

- Startup step order compared against the original sequence step by step. Drive still
  starts at the same relative point; the encryption migration and diagnostics now run
  concurrently with each other and with Drive, and none reads what another writes.

- Failure escape surfaces, per step: prerequisite → upper layer **by design** (storage
  is genuinely required; unchanged from before). Encryption migration, diagnostics →
  self-harm; each is now contained where previously either aborted everything after it.
  Drive → self-harm, and its rejection is now caught rather than becoming an unhandled
  rejection as it was before.

## [3] Security correctness — conclusion: no findings

Reviewed rather than skipped. No new persistence, no new network calls, no widening of
permissions. Logging was checked specifically because batching changed the messages: the
fallback path logs key *names* (`openai_api_key`), never values, matching what the
per-key path already logged. `getStoredValues` holds values in memory only. The
diagnostics dump remains opt-in and unchanged.

## [4] Consistency — findings

- Invariants in CLAUDE.md re-checked against this diff: keys still only stored through
  `secureStorageService`; large mapping data still lands in `chrome.storage.local`;
  transfer device ID untouched; Drive tokens still never persisted; no IndexedDB schema
  change. None broken.
- Machinery and policy were deliberately split (`startupSequence.js` vs
  `startupSteps.js`) to avoid Divergent Change — one file would otherwise be edited both
  when the sequencing rules change and when a step is added.
- Data Clumps: the three Drive folder-configuration keys always travelled together and
  are now fetched together, which is the smell resolving rather than appearing.

## Change-surface-external finding — reported, not fixed

**`Summary/index.vue` reads mapping data from its own `onMounted`.** Vue mounts children
before the parent, so in principle it can read the mapping keys before `App.vue`'s
startup migrates them — the same class as the bug fixed above, but pre-existing and
outside this change.

- **Blast radius**: unreachable in practice today. The tab is rendered with `v-if` and
  the default tab is `chat` (`navigation.js:5`), so the component only mounts on user
  action, long after startup. It would become reachable if the default tab changed to
  `summary` or tab state were restored across sessions.
- **Recommended handling**: do not fix now — it fixes itself if the store is made to
  await storage readiness, which is a broader change than this ticket.
- **Home**: needs one. It has no persistent place yet; raising it here so it is either
  ticketed or consciously dropped rather than left in a conversation.

## Refactor list (not blocking, for user decision)

1. **`getStoredValue` and `getStoredValues` differ by one character.** Easy to misread
   at a call site, and the compiler cannot help in a JS codebase. Matches the existing
   naming style in the file, so left alone. Impact: self-harm. Suggested: no change.
2. **Verbose diagnostics can dump a mid-migration snapshot** now that it runs alongside
   the encryption migration. Diagnostics-only and off by default. Impact: self-harm.
   Suggested: no change.

---

# review-code — #19 closeout (fullStartup test + evidence documents)

Change surface: `tests/fullStartup.test.js`, `measurement.md`,
`extension-verification.md`, `final-regression.md`. No production code. The layered scan
applies mostly to the documents, which are factual-claim surfaces.

## [1] Underlying premises — findings

- **A phase-3 row cited a command that had not been run.** final-regression's store-
  enumeration check named a grep as its basis before the grep existed — the exact
  "claims coverage it does not have" failure this whole feature has been policing. Ran
  the real command; the two README hits are directory-tree lines naming directories,
  not members, so the verdict (nothing falsified) stands — but now on evidence. Row
  rewritten to cite the actual command and its actual output.
- **A gap-closure claim overstated the evidence.** extension-verification said the
  migration ran "through the real prerequisite"; the paste-backs cannot distinguish
  which asker started the single-flight run, and pretending otherwise converts a design
  property (routes converge) into an unobserved ordering claim. Rewritten to state
  precisely what is and is not proven, and where the role-assignment half is covered.
- measurement.md's 25/8/3 walks re-derived once more against the extracted files before
  accepting: the before-side items (eager remove present at 3c53f7a, double CONNECTED
  read, per-key migration gets+removes on the no-data path, read-all in checkStorage)
  each re-confirmed by the recorded greps; the after-side measured subset (4) agrees
  item-for-item with the derived 8 minus the stubbed steps.

## [2] Runnability — findings

- The test's `driveSettled` deferred resolves only after the stubbed Drive step's
  reads; if those throw, the case hangs into the runner's timeout — a red, correctly
  attributed by the timeout message to the awaiting case. Acceptable failure shape.
- The `< 10` ops threshold is not constant-true: mutation V (marker unset) pushes a
  re-migrating second open past it, independent of the key-name assertions that also
  fire.

## [3] Security correctness — conclusion: no findings

The documents contain no secrets: the dump in chat was redacted at source (12-char
prefixes, key counts); nothing sensitive was copied into the records — checked the
three documents for the folder id and key material specifically.

## [4] Consistency — findings

None. Records follow the workings conventions (dated appended sections; checklist rows
untouched except through their owning documents). No smells material to a test file
plus three records.
