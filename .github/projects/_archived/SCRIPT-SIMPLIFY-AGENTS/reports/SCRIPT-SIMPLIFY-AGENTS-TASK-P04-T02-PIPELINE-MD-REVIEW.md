# Code Review — P04-T02: Rewrite pipeline.md

## Verdict: APPROVED

## Summary
docs/pipeline.md fully rewritten to document event-driven pipeline.js architecture. Zero stale references to deleted scripts. All acceptance criteria met.

## Checklist
- [x] No references to next-action.js, triage.js, validate-state.js
- [x] No references to STATUS.md, Next-Action Resolver, Triage Executor
- [x] pipeline.js documented as sole state-mutation authority
- [x] 18-action routing table present and correct
- [x] Mermaid diagrams updated (planning + execution)
- [x] Task lifecycle reflects 4-step flow with pipeline.js triage
- [x] Phase lifecycle reflects pipeline.js event processing
- [x] triage_attempts documented as persisted state.json field
- [x] Human gates section accurate
- [x] Error handling / retry budget documented
- [x] All 455 tests passing

## Issues
None.
