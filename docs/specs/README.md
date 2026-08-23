# Specs

Full requirement picture per feature: user stories, exhaustive failure modes and boundaries, testing decisions, and what is explicitly not being built. Written for whoever has to change this code next.

One document per feature module, with the slug matching `docs/features/`. Describes the current state and is rewritten in place; change history lives in git; a removed feature means a deleted file.

## Invariants

- A spec never references ticket numbers, branch names, or working-record paths — it exists before those and outlives them.
- Design trade-offs belong in ADRs (referenced by number, not restated); current product behaviour belongs in `docs/features/`.
- Facts that are not yet true are marked `> Pending: <condition that can be judged against the implementation>`, and are re-judged at the end of every round.

## Index

- [llm-model-selection](./llm-model-selection.md) — fetching model lists per provider and choosing chat/vision models in the LLM Config dialog
