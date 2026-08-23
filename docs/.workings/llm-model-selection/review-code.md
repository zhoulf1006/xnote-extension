# review-code — llm-model-selection

Scope: modelCatalog.js / modelSelection.js / modelConfigService.js (new), llmProviders.js (rewritten), providerFactory.js / openaiProvider.js / geminiProvider.js (reworked), ModelSelect.vue (new), App.vue (config modal), Vitest infrastructure.

## [1] Underlying premises — findings

- **Verified by real measurement**: the Gemini list API shape and the generateContent filter (a live dev-mode call returned 38 real models); the DeepSeek /models shape (a live call returned three v4-series models); selection persistence surviving a full page reload; CORS working in dev mode; the no-key state (OpenAI with no env key correctly shows the hint).
- **Not measured (recorded honestly)**: a live OpenAI list call (no key on this machine; the shape is the OpenAI standard list, corroborated by the DeepSeek-compatible endpoint); a live Customized endpoint (none available); **the chrome.storage sync/local object round trip in extension mode** (proven in dev mode, pending an extension-mode load — listed as a manual check in the delivery notes).
- Newly written comments state causes that have all been verified (sync quota, floating layers being clipped, per-request model resolution).

## [2] Runnability — findings

- **BUG (escapes upward, fixed)**: `loadModelConfig` had no guard — in extension mode a transient storage read failure would abort the load, leaving selections at their null defaults, and a subsequent Save would then write those nulls back, **overwriting the real selection (a data-loss path)**. Fixed by wrapping each segment in try/catch and keeping the in-memory value on failure. This path lives in App.vue's orchestration layer, which currently has no component-test seam, so it cannot be unit-tested — recorded as an honest gap covered by manual testing (see review-tests).
- **Fixed (prototype fidelity)**: ModelSelect had no outside-click close (the prototype does). Added a document listener with cleanup on unmount; verified in the browser: open → click outside → closes → reopens.
- **Deferred (self-inflicted only, self-healing)**: the global modelFetchSeq is shared across providers, so a customized fetch invalidates an in-flight built-in fetch and leaves its state stuck at 'loading'; that state is only visible if the provider is reselected, which itself triggers a new fetch and clears it. See the refactor list.
- The race guard (boundary 13) is implemented at the UI layer via sequence comparison; the save path joins the existing Promise.all flow; reactive proxies are destructured into plain objects by setSelections before reaching chrome.storage, so there is no clone problem.

## [3] Security correctness — conclusion: no findings

- Model IDs are always rendered through Vue interpolation (plain text, boundary 11); keys are only sent to their own provider's endpoint; Gemini's key in the URL query is that API's documented mechanism; neither the cache nor the selections hold secrets.

## [4] Consistency — findings

- No existing invariant was broken: the CUSTOMIZED_CONFIG shape is untouched, STORAGE_KEYS is untouched, the llmConfig store flow is untouched, and the "large data goes to local storage" invariant is honoured (list cache → local, selections → sync).
- Smell hits and exemptions:
  - Provider conditionals are concentrated in the single modelCatalog module (dispatch is that module's job) — exempt.
  - `loadModelsFor` and `fetchCustomizedModels`, and `modelNote` and `customizedNote`, are each a near-duplicate pair — added to the refactor list.
- **Found outside the change surface (recorded, not changed, needs a destination)**: `src/api/openai.js` (legacy Azure direct-fetch) has zero imports repo-wide and appears to be dead code; likewise `chatService.js`'s consumer surface and `testStorage.js` / `testSecureStorage.js` were not verified. Impact: no runtime effect, only reader confusion. Suggestion: a separate cleanup task that confirms across full history before deleting. **The destination needs a decision from the user** (file a ticket / drop it).

## Class-level judgement

"Missing injection seam makes this untestable" is class-level (every orchestration function in App.vue shares it: loadModelConfig / loadModelsFor / fetchCustomizedModels / the saveConfig addition) — all enumerated and handled the same way: covered by manual testing, with "extract the orchestration layer into an injectable module" recorded as an optional refactor.

## Refactor list (awaiting user decision, none blocking delivery)

1. Per-provider fetch sequence instead of a global one — reason: the stuck state self-heals but the semantics are muddy; impact: self-inflicted only; suggestion: a small separate task, or fold it into the next change that touches this area.
2. Merge the loadModelsFor/fetchCustomizedModels pair and the two note computeds — reason: duplicated code; impact: no behavioural difference; suggestion: don't do it (only two instances; parameterising them would add more complexity than it removes).
3. Extract App.vue's model orchestration into an injectable composable (adding a test seam) — reason: the missing seam behind the gap in section 1; impact: self-inflicted only; suggestion: a separate task, worth doing only if this area evolves further.
