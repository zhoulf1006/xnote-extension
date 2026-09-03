# Round-trip measurement — before the first ticket vs after the last

Checklist row 25. Two figures with different provenance, stated separately rather than
blended: the **after** subset is measured live; the full-path figures are **derived by
static walk** of the code at each anchor, with the extraction commands recorded so the
walk is re-runnable. The scenario is the steady-state one — a **second panel open** by a
connected user whose migrations already ran — because that is the open every launch
after the first takes.

Anchors:

- **Before** = `3c53f7a` (perf: drop the 200ms delay, #12) — the last commit before the
  seam ticket. Extraction: `git show 3c53f7a:src/api/storageService.js` (and App.vue,
  googleDrive.js, googleDriveService.js).
- **After** = current main.

## Before: 25 chrome.storage operations, all on the awaited critical path

| Step (old onMounted order, all awaited) | Ops | Detail |
|---|---|---|
| initializeStorage eager cleanup | 1 | `sync.remove(problematicKeys)` — the #21 data-destroyer, then still present |
| initializeStorage test op | 1 | `sync.get('test-key')` |
| migrateSyncToLocalStorage (unconditional) | 8 | 4 keys × (`sync.get` + `sync.remove`), every open, forever |
| googleDriveStore.initialize (awaited) | 9 | connected ×2 (store + auth check), syncEnabled, lastSync, folderConfig ×3, rootFolderId — all per-key `sync.get` — plus mappings `local.get` |
| migrateToEncrypted (unconditional) | 5 | 5 sensitive keys × per-key `sync.get` |
| checkStorage | 1 | `sync.get(null)` — the whole store, read to be printed |
| **Total** | **25** | sequential; each read also paid the retry helper and its timeout timer |

## After: 8 operations, 3 on the critical path

Static walk of main, same scenario:

| Step | Ops | Path |
|---|---|---|
| initializeStorage test op | 1 `sync.get` | critical |
| mapping migration | 1 `local.get` (marker; gated) | critical |
| encryption migration | 1 `local.get` (marker; gated) | critical |
| checkStorage | 0 (read-all is opt-in) | — |
| Drive: auth check | 1 `sync.get` | background |
| Drive: settings (batched) | 1 `sync.get` | background |
| Drive: folder config (batched) | 1 `sync.get` | background |
| Drive: mappings | 1 `local.get` | background |
| Drive: root folder id | 1 `sync.get` | background |
| **Total** | **8** | **3 awaited + 5 background** |

## Measured subset: 4 ops

`tests/fullStartup.test.js` ("the second open is cheap…") counts a live second open of
the steps it wires: **4 ops** (1 syncGet, 3 localGet), printed as `[measurement]` in the
test output. It is lower than the static 8 because the test's scope excludes what cannot
run outside a browser — initializeStorage's extension branch (the test-key get) and the
full Drive store initialize (auth/settings/root-id reads); its Drive stub performs only
the mappings and folder-config reads. The 4 measured ops are a strict subset of the 8
derived ones and agree with the walk item for item.

## Conclusion

Steady-state open: **25 → 8** operations (−68%); the awaited critical path: **25 → 3**
(−88%), with the remaining 5 moved off it entirely. The first-ever open (migration
actually runs) pays the migration once and never again — previously it paid it on every
open. Row 25's criterion ("the end-to-end round-trip count actually dropped") is met;
the extension-mode run of this ticket is where the derived numbers get observed against
a real panel rather than a walk.
