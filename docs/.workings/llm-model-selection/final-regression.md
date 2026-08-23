# final-regression — llm-model-selection

## 2026-08-23

### Stage 1 — statement-by-statement check (declaration surfaces touched this round)

| Check | Against | Conclusion |
|---|---|---|
| spec ↔ implementation | walked all 23 failure-mode items | consistent; implementation-time deviations (Vision row rendered per supportsVision, the 15s timeout, the OpenAI filter word list, removal of supportsSpeech) written back into the spec |
| spec failure modes ↔ tests/gaps | tests/*.test.js plus the gap declarations in the file headers | logic side covered by 22 cases; UI-side gaps declared item by item in the test header (see review-tests) |
| spec ↔ features | the two documents with the same slug | features is a distillation of the spec's user-visible layer; no contradictions, no behaviour present in one and absent from the other |
| ADR ↔ spec/features | — | per the project capability declaration, ADRs are not enabled; item skipped |
| CONTEXT ↔ everything | — | per the project capability declaration, CONTEXT.md is not enabled; item skipped |
| prototype ↔ implementation | docs/prototypes/llm-model-selection | the conditional Vision row was synced into the prototype (synced rather than marked stale); all other UI points match (outside-click close added to the implementation) |
| CLAUDE.md (rewritten this round) | current code | "no automated test suite" had become false → rewritten as Vitest plus manual testing; a line about model selection added to the LLM section |

### Stage 2 — relationship reading (the other end is in the diff, the statement is not)

| Relationship | Check | Conclusion |
|---|---|---|
| file ↔ its index row | docs/specs/README.md, docs/features/README.md | both indexes carry this feature's row and the one-liners match the documents |
| a fact ↔ its statements elsewhere | repo-wide search for wording about models being fixed vs selectable (docs/, README.md, src copy) | the root README enumerates no models; docs/intro.md makes no claim about model fixity; no change needed |
| rule ↔ the gate that guards it | .github does not exist | this repository has no CI gate; tests run locally only — "should a gate exist" raised as a finding below |
| rule ↔ templates restating it | — | no rule with a restating template was touched this round |

### Stage 3 — event reconciliation (neither end is in the diff)

| Event | Reach | Conclusion |
|---|---|---|
| automated test infrastructure introduced (the "verification means" dimension went 0 → 1) | documents stating how testing is done | CLAUDE.md hit and already fixed (see stage 1); the root README has no such statement |
| each provider went from one model to a dynamic list | wording that enumerates model names | repo-wide search for gpt-4o / deepseek-chat / gemini-2.0-flash across declaration surfaces: only spec and features mention them, and only as the fallback default, which is the correct characterisation |
| `Pending:` notes | spec | none present |
| new general rules decided this round | — | "a dropdown inside a scroll container expands in the document flow" is recorded in the spec's UI conclusions (the authoritative place within this project's declaration surfaces); no other general rules |

### Findings (fixed on the spot where possible, otherwise given a destination)

1. **docs/intro.md states "Azure OpenAI" and "Azure Speech Service"** — already stale before this round (not caused by it). Impact: misleads users on a publicly published introduction page. Suggestion: a separate documentation cleanup task, batched with the `src/api/openai.js` dead-code cleanup. Destination pending a user decision.
2. **The repository has no CI gate** — the 22 unit tests only ever run locally, so pull requests are unchecked. Suggestion: a GitHub Actions workflow running `pnpm test` and `pnpm run build`, set as a required check (see github-ops section 8). Destination pending a user decision.
