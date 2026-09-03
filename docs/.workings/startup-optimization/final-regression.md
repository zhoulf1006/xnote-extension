# Final regression — startup optimization, full-feature closeout

## 2026-09-03 — closeout ticket #19 (whole-feature scope)

Scope: every ticket of the feature combined (#13, #14, #16, #17, #18, #21, #22, #28,
plus #31 which grew out of #18's review; #15 closed as superseded). Change surface for
phase 1 taken as the union of all the feature's PRs: the only declaration-surface file
the feature changed is `CLAUDE.md` (everything else under `docs/` is working records,
which are kept as-written and not truth-checked).

### Phase 1 — sentence check of changed declaration-surface files

| # | File · sentence | Counterpart | Verdict |
|---|---|---|---|
| 1 | CLAUDE.md · "Debugging storage" section (flag `xnote-debug-storage`, off by default) | `storageService.js` `STORAGE_DEBUG_FLAG` + `checkStorage` verbose gate | true — flag name and default verified in code |
| 2 | CLAUDE.md · mapping-ordering invariant (readiness single-flight; reads *and* writes await; names `storageReadiness.js`, `loadMappings`, `saveToStorage`) | the named files and functions | true — every named symbol exists and does what the sentence says |
| 3 | CLAUDE.md · Testing: "a test that needs a browser global must define it" (names `tests/migrationBatching.test.js`) | that file's `beforeAll` | true |
| 4 | CLAUDE.md · Testing: reproduce-under-CI-Node command (`v20.9.0` nvm path) | `~/.nvm/versions/node/v20.9.0` verified present; CI pins Node 20 | true |
| 5 | CLAUDE.md · Storage Layers: "`migrateSyncToLocalStorage()` exists for this reason" | function exists, still the mover of the large keys | true |

### Phase 2 — relation pairs (counterpart changed, sentence elsewhere)

| # | Pair | Verdict |
|---|---|---|
| 1 | features/specs files ↔ their README index rows | no content file added, removed or re-summarised by this feature → index rows untouched and still true |
| 2 | rule ↔ gate: "tests must pass" ↔ CI `checks` job | the gate demonstrably **can fail** — it did, live, on #18's first push (navigator/Node-20), which is stronger evidence than any audit of its config |
| 3 | fact "large mapping data goes in local, not sync" ↔ its statements | stated in CLAUDE.md Storage Layers, the invariants list, and enforced by the migration — all three agree |
| 4 | README.md line 263 "Automatic migration from plain text to encrypted format" ↔ the now-gated migration | still true: gating changed *when it re-runs*, not whether it happens automatically |

### Phase 3 — event check (neither end in any diff)

| # | Event | Verdict |
|---|---|---|
| 1 | Enumerable member count changed: one Pinia store deleted (#31) | `grep -rn "summaryMappings\|driveMappings\|Pinia store" docs/features docs/specs README.md docs/intro.md` → two README directory-tree lines ("stores/ # Pinia stores") that name directories, not members — both directories still exist, so neither sentence is falsified; no doc enumerates stores by name |
| 2 | `Pending:` notes due? | `grep -rn "Pending:" docs/specs/` → only the README meta-sentence describing the convention; zero live notes |
| 3 | General rules minted this feature | three: browser-globals-in-tests, reproduce-under-CI-Node, mapping-ordering invariant — all landed in CLAUDE.md (their proper home), none living only in comments or review records |

### Checklist — full-scope核销 (rows 1–27)

Rows 1–22b were honoured per-ticket; re-verified here as still delivered on main
(94 tests green):

| Rows | Delivered by | Note |
|---|---|---|
| 1 | `storageBackend.test.js` injected-backend suite | |
| 2–6 | marker cases in `storageBackend.test.js` | |
| 7 | **evidence refreshed this closeout** — the old "migrations are startup-only" enumeration went stale when #31 added call sites. Re-enumerated: `migrateToEncrypted` remains startup-only (`startupSteps.js` sole caller); `migrateSyncToLocalStorage` is now reachable from mapping reads/writes **through `storageReadiness` only** — the gate stays safe on a stronger basis than "startup-only": single-flight + marker + every toucher awaiting the same run | grep outputs in this session's record |
| 8–12 | `migrationBatching.test.js` + batched-reads block | |
| 13–15 | diagnostics cases + CLAUDE.md section (phase-1 row 1) | |
| 16–19 | `driveInit.test.js` + `startupSteps.test.js` row-22b case + #17-era indicator screenshots | |
| 20–22b | `startupSequence.test.js` / `startupSteps.test.js` | |
| 23 | `extension-verification.md` round 1 | real panel, real data intact |
| 24 | `extension-verification.md` round 2 | seeded upgrade through the gated path, before/after recorded |
| 25 | `measurement.md` | 25 → 8 ops (crit. path 25 → 3); measured subset agrees with the walk |
| 26 | `fullStartup.test.js`, both cases, mutation-verified | |
| 27 | this document | see conclusion |

### Row 27 conclusion — the two questions, answered not assumed

Did the feature make any `docs/features/` sentence false? **No** — the catalog's two
entries (LLM model selection, notifications) describe behaviours this feature did not
touch; verified by reading them against the change surface, and no sentence anywhere in
the catalog describes startup timing, storage internals or migrations. Is any sentence
missing? **No** — the user-visible product behaves identically (same data, same panel,
same error message on failure); faster startup is a quality of existing behaviour, not a
new capability with a missing entry.

### Findings

1. **Stray empty-string key** (`"": ""`) in both storage areas of the real profile —
   pre-existing, harmless, cause unknown; raised to the user as a candidate cleanup
   ticket (also noted in `extension-verification.md`).
2. Row 7's evidence rot (caught and refreshed above) is itself the lesson the checklist
   ownership-note predicted: an evidence row goes stale silently when a later ticket
   changes the enumerated set. No further action — the refreshed enumeration stands.
