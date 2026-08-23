# review-tests — llm-model-selection

Under review: tests/modelCatalog.test.js (16 cases) and tests/modelSelection.test.js (5 cases).

## Dimension 1: coverage completeness — findings, addressed

Reconciled item by item against the spec's failure modes and boundaries:

- **Logic side fully covered**: #3 (401), #4 (network failure / HTTP 500 / malformed structure / **non-JSON — added during this review**), #5 (empty list), #6 (pagination aggregation), #8 (manual input sanitising), #10 (three-level resolution), #17 (cache independent of save), #18 (no selection = previous behaviour), #21–22 (cache keyed per provider).
- **UI-side gaps declared honestly** (listed with their re-test conditions in the test file header): the state notes of #1–5, the stale-while-revalidate display of #2, the not-in-list display of #7, the race guard of #13, and modelConfigService's production bindings. All were exercised live in dev mode (see review-code section 1); extension mode remains a manual check.
- Coverage bookkeeping checked: each case's inputs really drive the boundary it claims (the 401 case's fixture does return status 401; the pagination case really carries a nextPageToken across two pages).

## Dimension 2: case design — no findings

- Zero `vi.mock` / `vi.spyOn` pointed at our own code; network and storage are system boundaries, injected as fakes through constructor parameters (routedFetch routes by URL — URL correctness shows up through behaviour rather than by asserting call arguments).
- All assertions go through the public interface (return values / readCache / getSelections); no direct writes to private state; every state in setup is reachable through a public path (the cache is seeded by a real fetchModels call).
- No assertions on call counts or ordering.

## Dimension 3: false passes — findings, addressed

- **One caught during development**: `toThrow(ModelListParseError)` with the class not yet exported is equivalent to `toThrow(undefined)`, which passes on any exception — expected red but got green. Changed on the spot to a `thrownBy(...)?.name` literal assertion and re-verified red. That pattern (asserting the name literal) is used for every error-type assertion and is immune to a missing import.
- **Mutation-tested the cases that had never been red** (arrival / attribution / restoration all satisfied):
  - Empty-list case: mutated parse to throw on an empty array → that case went red with the mutation's message; green again after restoring.
  - Non-JSON case (added here, green on its first run): mutated away the try/catch around json() → red with `'SyntaxError' ≠ 'ModelListFetchError'`, and the failure landed on the mutation; green after restoring.
  - Both restorations used precise inverse edits, never a version-control restore command.
- Every other case went red during its own red-green cycle, and the cause of each red was the absence of the behaviour it guards (recorded per cycle in the session).
- No always-true assertions (all expectations are independent literals), no un-awaited async assertions, no conditional skips.

## Fixture provenance check

- Gemini: shape taken from the official documentation on the day, corroborated by a live dev-mode call returning 38 real models (matching the supportedGenerationMethods and models/ prefix characteristics).
- DeepSeek: shape taken from the official documentation on the day; a live call returning real v4 models corroborates the same shape.
- OpenAI: the documentation page was unreachable, so the shape was cross-checked independently against the local openai SDK's type definitions (the Model interface: id/created/object/owned_by), which matches the fixture.
- None of the three were invented from imagination, so they are not a shared source with the spec.
