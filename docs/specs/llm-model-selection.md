# LLM Model Selection

> Related: [features](../features/llm-model-selection.md)

## Problem Statement

Each LLM provider's model is hardcoded in the provider registry. Users cannot pick a different model (e.g. DeepSeek's reasoner model, a newer Gemini) without a code change and rebuild. The only provider with configurable models is "Customized", and even there the user must know and type model IDs by hand — nothing tells them what the endpoint actually offers.

## Solution

The LLM Provider Configuration modal gains per-provider **Chat model** and **Vision model** selectors, populated live from each provider's list-models API, with a free-text escape hatch for any model ID the list misses. Selections persist across devices. Hardcoded model config shrinks to a single last-resort fallback default per provider, so existing setups keep working unchanged until the user picks something.

## User Stories

1. As a DeepSeek user, I want to pick `deepseek-reasoner` from a list of what DeepSeek actually offers, so that I can use reasoning models without editing code.
2. As a user opening the config modal, I want the model list fetched automatically when my API key is already configured, so that I see current options without extra clicks.
3. As a user, I want a refresh button on the model row, so that I can pull the latest list after a provider ships new models.
4. As a user, I want to type an arbitrary model ID manually, so that a brand-new or filter-missed model is never unselectable.
5. As a user, I want my model choices synced across my devices (like my keys), so that I configure once.
6. As a Capture user, I want vision to use my chat model unless I explicitly pick a separate vision model, so that one selection is enough for everything.
7. As a Customized-provider user, I want a "fetch models from endpoint" assist, so that I can see what my OpenAI-compatible endpoint offers instead of guessing IDs.
8. As an existing user upgrading, I want everything to behave exactly as before until I actively pick a model, so that the upgrade is invisible.
9. As a user with no API key configured, I want a clear hint that the list needs a key while manual entry still works, so that I'm never dead-ended.
10. As a user whose fetch fails (network, expired key), I want to see what went wrong and still be able to select from a cached list or type manually, so that a fetch failure never blocks configuration.

## Failure Modes and Boundaries

Enumerated along real user action sequences; each item states the expected behaviour.

**Opening the config modal:**

1. Provider with no key configured → no automatic fetch; informational note "configure an API key to load the list, manual entry still works"; the dropdown offers only manual entry; any existing selection is still displayed. The refresh button stays clickable: a key **just typed and not yet saved** can be used to fetch immediately; with an empty field, refresh only shows the no-key note.
2. Key configured → automatic fetch; during the fetch the selectors and refresh button are disabled and a loading state is shown; if a cached list exists it is displayed first (stale-while-revalidate).
3. Fetch returns 401 → red error note pointing at the key field; with a cache the list falls back to it, without one only manual entry remains; neither the stored key nor the current selection is cleared.
4. Network failure / timeout (aborted after 15 seconds without response) / non-JSON body / unexpected structure → warning note; with a cache, the cached list is shown along with its (relative) fetch time; without one, manual entry only.
5. Fetch succeeds but the filtered result is empty (or the API returns an empty list) → the same informational note form as the no-key case, worded "the API returned no usable models, enter one manually"; manual entry only. (Structurally identical to the confirmed prototype's info note and differing only in wording, so it is exempt from a further prototype round as pure copy.)
6. Gemini list pagination (50 per page by default) → request the maximum page size and follow the page token to collect everything; never treat the first page as the whole set.

**Selecting and manual entry:**

7. The selected model is absent from the latest fetch (retired or renamed) → the selection is still displayed in the selector; no matching row and no checkmark appear in the expanded list; the user's choice is never silently cleared or replaced.
8. Empty or whitespace-only manual input → no effect; input is trimmed first.
9. Manually entered IDs are not checked for existence (that is the point of the escape hatch) — a wrong ID surfaces through the provider's existing error path when actually used.
10. Vision set to "Same as chat model" (the default) → image analysis resolves as vision selection → chat selection → provider fallback default, a three-level chain; if the resolved model has no vision capability, the provider's request-time error path reports it.
10a. The vision dropdown lists only models judged vision-capable (the list APIs carry no capability metadata, so capability is inferred from naming: DeepSeek keeps IDs containing vision/vl, OpenAI keeps multimodal family prefixes; Gemini and Customized are not filtered); typing any ID by hand is not restricted.
11. List entries and the selected value are untrusted text (especially IDs returned by an arbitrary Customized endpoint): always rendered as plain text with no HTML interpretation; over-long IDs wrap inside the list and are ellipsised in the selector; no links, scripts or other new interaction surfaces are introduced.
12. Very long lists (OpenAI returns ~70+ raw, still dozens after filtering) → the list scrolls internally and expands within the document flow, pushing content down (the modal is a scroll container, so a floating layer would be clipped — confirmed by the prototype).

**Concurrency and races:**

13. Switching the provider radio while a fetch is outstanding → the late response must not populate the current provider's list (responses are discarded based on the provider at request time).
14. Clicking refresh repeatedly while loading → the button is disabled during the fetch, which de-duplicates naturally.
15. Two devices changing the selection at once → last write wins (Chrome sync semantics), no merging; acceptable.

**Save and cancel:**

16. Save → selections are written to sync storage; Cancel → the round's changes are discarded (the modal reloads from storage next time it opens, matching existing key behaviour).
17. The list cache is unaffected by Save/Cancel — the cache belongs to the fetch action, selections belong to the save action.

**Upgrade and regression of existing data:**

18. An existing user with no stored selection → behaviour is byte-for-byte what it was (the fallback default equals the previously hardcoded value); no migration needed.
19. The Customized provider's existing config structure (including the speech capability) is unchanged; the fetch assist only offers candidates beside its model fields and does not alter stored semantics.
20. Existing-feature regression points: Chat, Summary, Translation and Capture (vision) all go through the same model resolution chain; Speech exists only for Customized and is unaffected.

**Storage and quota:**

21. Model selections (small) go to sync storage; the fetched list cache (potentially large) goes to local storage — honouring the existing "large data never in sync" invariant.
22. The cache is keyed by provider, not by API key; after switching accounts the cache may belong to the previous account, and one refresh overwrites it; acceptable, no invalidation logic.

**Development mode:**

23. On localhost the fetch is subject to CORS; when blocked it takes the network-failure path (item 4) with manual entry as the fallback; extension mode is unaffected.

**Capabilities introduced by rendered content (second dimension):** the only external content is model ID strings from the API, whose rendering surface is covered by item 11 (plain text, no link/media/form/script surface); sanitisation and behavioural destination coincide here, and no extra interaction surface exists.

## Implementation Decisions

- **Uniform request-time model resolution**: every provider resolves its model on each request (vision → chat → fallback default), instead of baking the model in at client creation (which is what Gemini did and had to change to build the model instance from the current selection).
- **Model catalog service** (new module, mostly pure logic): encapsulates request construction, response parsing, filtering and cache access per provider type. Filtering rules: Gemini keeps models whose supportedGenerationMethods include generateContent and strips the name prefix; OpenAI uses an exclusion heuristic (any of embedding/tts/whisper/transcribe/dall-e/image/moderation/realtime/audio in the ID); DeepSeek is unfiltered; Customized is read from `{baseURL}/models` unfiltered, with the base URL's trailing slashes normalised.
- **Registry slimming**: the provider registry keeps exactly one fallback default model per provider; dead config (the unconsumed models sub-objects, the visionModel reference and the supportsSpeech flag) is deleted as part of this rewrite, after verifying repo-wide that nothing consumed them.
- **Storage contract**: each provider's {chat, vision} selection uses the existing sync storage path; the list cache (with its fetch timestamp) uses local storage. An empty vision value means "Same as chat model".
- **UI conclusions** (confirmed by prototype): an inline extension of the existing modal — below the provider radios and after the key row come the Chat model row (with a refresh icon button) and the Vision model row; **the Vision row renders only for providers with supportsVision**; the selector expands into an in-flow list (internally scrollable, not floating) and closes on an outside click; a pinned "Enter custom model ID…" entry at the end of the list opens the manual input row; four state notes (loading / 401 / network error with cache / no key) appear as a banner below the rows; the vision list's first entry is "Same as chat model"; a fallback-default hint line sits below. Icons reuse the project's Font Awesome classes.
- **Customized**: each capability's model input becomes the same selector, with candidates supplied by the fetch assist; the assist button sits below the Base URL.

## Testing Decisions

- **Seam**: the model catalog service's public interface (this project's first unit-test seam; Vitest introduced as the zero-config fit for Vite). Tests observe external behaviour: per-provider response fixtures (shaped from the real APIs) → parsing and filtering output; three-level resolution; cache read/write with timestamps; pagination aggregation; stale response discarding; URL normalisation. No real network requests.
- UI behaviour and real API connectivity follow the project's existing practice of manual testing (development mode plus extension mode), covering each modal state and the Save/Cancel round trip.
- Prior art: the project had no automated tests before this; `tests/` held only manual pages — this is the first test infrastructure.

## Out of Scope

- Per-feature model selection (translation / summary / chat) — one selection per provider applies globally.
- Capability probing or post-selection validation (no verification request is sent; errors surface on use).
- Speech capability for the built-in providers (only Customized retains it).
- Inference parameters such as temperature and max_tokens.
- Provider health checks and automatic failover.
- Active cache invalidation or per-key cache isolation (see boundary item 22).

## Further Notes

- OpenAI's list-models carries no capability metadata, so exclusion filtering will inevitably miss cases — the manual entry escape hatch exists for exactly that, and the filter errs on the permissive side.
- DeepSeek's documented examples already show v4-series models, which is what makes a dynamic list timely.
