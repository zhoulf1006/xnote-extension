# LLM model selection

## Overview

Users of different AI providers could not choose which model to use — each provider was pinned to one hardcoded model. The LLM Config dialog now offers model selection per provider: the list is fetched live from the provider's own API, and any model ID can also be typed by hand.

## Capabilities

- In the LLM Config dialog, OpenAI, DeepSeek and Gemini each have a Chat model selector; providers that support image analysis also have a Vision model selector, whose choices are limited to vision-capable models (typing an ID by hand is not restricted).
- Opening the dialog fetches the model list automatically when that provider already has an API key; the refresh button beside the Chat model row re-fetches on demand — including with a key that has just been typed and not yet saved.
- While a fetch is in flight the selectors and the refresh button are disabled and a loading message is shown.
- "Enter custom model ID…" at the end of every list accepts any model ID; blank or whitespace-only input is ignored.
- Vision defaults to "Same as chat model": with nothing chosen there, image analysis uses the selected chat model.
- With no selection at all, behaviour is identical to before the feature existed (the provider's built-in default), and the hint line below the selectors names that default.
- Distinct messages cover a rejected key, a failed network request, a missing key, and an empty list from the API. On network failure the most recent successfully fetched list is shown along with when it was fetched, and manual entry always remains available.
- Model choices sync across devices through the Chrome account, the same way API keys do.
- For the Customized provider, a "Fetch models from endpoint" button below the Base URL loads that endpoint's models as suggestions for the Chat, Vision and Speech capability fields; manual entry is unaffected.
- Saving takes effect immediately for subsequent chats, summaries, translations and screenshot analysis; Cancel discards the changes.

## Boundaries and non-goals

- Models cannot be chosen per feature (chat, summary, translation) — one selection per provider applies everywhere.
- Manually entered model IDs are not validated; an incorrect ID surfaces as a provider error when it is actually used.
- Vision capability is inferred from model naming, because the providers' list APIs expose no capability metadata; manual entry is the escape hatch when that inference is wrong.
- OpenAI's list is filtered heuristically to drop non-chat models, so a new model may occasionally be missed — again, manual entry covers it.
- Changing an API key does not clear the cached model list; one refresh replaces it.
- A model list request that gets no response within 15 seconds is treated as a network failure.
