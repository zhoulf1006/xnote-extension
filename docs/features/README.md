# Features

Describes the **current behaviour of features that exist in this version**, written for people rather than for the build.

- Invariant: present in this directory = available in the current version; behaviour changes are rewritten in place; a removed feature means a deleted file.
- Roadmap items belong elsewhere; history lives in git and release notes; implementation decisions live in `docs/adr`.
- Content rule: user-visible behaviour only, no implementation detail.
- Catalog started 2026-08: pre-existing features (Chat, Capture, Translate, Summary, Quick Links, Transfer, Drive sync) still need backfilling — a missing entry does not mean a missing feature.

| Feature | One line |
|---|---|
| [LLM model selection](llm-model-selection.md) | Pick chat and vision models per provider from a live model list, or type any model ID |
| [In-app messages and confirmations](notifications.md) | Results appear as toasts, destructive actions ask for confirmation, saving a page picks a category from a list |
