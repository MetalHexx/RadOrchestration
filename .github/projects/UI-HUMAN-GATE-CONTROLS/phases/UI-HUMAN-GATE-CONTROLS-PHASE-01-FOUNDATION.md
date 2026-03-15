---
project: "UI-HUMAN-GATE-CONTROLS"
phase: 1
title: "Foundation"
status: "active"
total_tasks: 4
tasks:
  - id: "T01-GATE-TYPES"
    title: "Add gate domain types to state.ts"
  - id: "T02-DIALOG-PRIMITIVE"
    title: "Create centered Dialog UI primitive"
  - id: "T03-NORMALIZER-FIX"
    title: "Fix normalizer v3 final-review fallback"
  - id: "T04-GATE-API-ROUTE"
    title: "Create POST gate approval API route"
author: "tactical-planner-agent"
created: "2026-03-15"
---

# Phase 1: Foundation

## Phase Goal

Establish the gate domain types, reusable `Dialog` centered modal primitive, v3 normalizer fix for the Final Review section, and the backend POST API route that invokes `pipeline.js` — the foundational pieces required before any UI-component integration work in Phase 2.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../UI-HUMAN-GATE-CONTROLS-MASTER-PLAN.md) | Phase 1 scope, exit criteria, execution constraints, risk register |
| [Architecture](../UI-HUMAN-GATE-CONTROLS-ARCHITECTURE.md) | Contracts & Interfaces (gate types, Dialog primitive API, gate API route spec), File Structure, Cross-Cutting Concerns (security, input validation), Dependencies |
| [Design](../UI-HUMAN-GATE-CONTROLS-DESIGN.md) | Confirmation Dialog layout (backdrop, centered container, design tokens), Dialog states & transitions, accessibility requirements |
| [PRD](../UI-HUMAN-GATE-CONTROLS-PRD.md) | FR-6, FR-7, FR-11, NFR-3, NFR-4 — functional requirements driving each task |
| [Research](../UI-HUMAN-GATE-CONTROLS-RESEARCH-FINDINGS.md) | Pipeline CLI interface (Section 1), existing API route patterns (Section 3), type definitions (Section 5), Dialog patterns (Section 8), v3 normalizer gap (Section 10) |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T01 | Add gate domain types to `state.ts` | — | TypeScript types | 1 | [Link](../tasks/UI-HUMAN-GATE-CONTROLS-TASK-P01-T01-GATE-TYPES.md) |
| T02 | Create centered `Dialog` UI primitive | — | React components, `@base-ui/react/dialog` | 1 | [Link](../tasks/UI-HUMAN-GATE-CONTROLS-TASK-P01-T02-DIALOG-PRIMITIVE.md) |
| T03 | Fix normalizer v3 final-review fallback | — | TypeScript, normalizer logic | 1 | [Link](../tasks/UI-HUMAN-GATE-CONTROLS-TASK-P01-T03-NORMALIZER-FIX.md) |
| T04 | Create POST gate approval API route | T01 | Next.js API routes, `execFile`, input validation | 1 | [Link](../tasks/UI-HUMAN-GATE-CONTROLS-TASK-P01-T04-GATE-API-ROUTE.md) |

## Execution Order

```
T01 (gate domain types)
 ├→ T04 (gate API route — imports GateEvent, GateApproveResponse, GateErrorResponse from T01)
T02 (dialog primitive)         ← parallel-ready with T01, T03
T03 (normalizer v3 fix)        ← parallel-ready with T01, T02
```

**Sequential execution order**: T01 → T02 → T03 → T04

*Note: T01, T02, and T03 have no mutual dependencies and are parallel-ready. T04 depends only on T01 (it imports the gate types). In v1 sequential execution, T01 runs first so T04's dependency is satisfied by the time it executes.*

## Task Details

### T01 — Add Gate Domain Types to `state.ts`

**Objective**: Add `GateEvent`, `GateApproveRequest`, `GateApproveResponse`, and `GateErrorResponse` type definitions to the existing `ui/types/state.ts` file.

**File targets**:
- `ui/types/state.ts` — MODIFY (append new types)

**Key requirements**:
- `GateEvent` is a string union type: `'plan_approved' | 'final_approved'` — whitelist only these two values
- `GateApproveRequest` has a single `event: GateEvent` field
- `GateApproveResponse` has `success: true`, `action: string`, `mutations_applied: string[]`
- `GateErrorResponse` has `error: string` and optional `detail?: string`
- All four types must be exported

**Acceptance criteria**:
- [ ] All four types are exported from `ui/types/state.ts`
- [ ] `GateEvent` is exactly `'plan_approved' | 'final_approved'` — no wider string type
- [ ] Project compiles without type errors

---

### T02 — Create Centered `Dialog` UI Primitive

**Objective**: Create `ui/components/ui/dialog.tsx` — a centered modal dialog primitive using `@base-ui/react/dialog`, exporting `Dialog`, `DialogTrigger`, `DialogClose`, `DialogOverlay`, `DialogContent`, `DialogTitle`, `DialogDescription`.

**File targets**:
- `ui/components/ui/dialog.tsx` — CREATE

**Key requirements**:
- Uses `@base-ui/react/dialog` primitives: `Dialog.Root`, `Dialog.Trigger`, `Dialog.Close`, `Dialog.Portal`, `Dialog.Backdrop`, `Dialog.Popup`, `Dialog.Title`, `Dialog.Description`
- Mirrors the existing `Sheet` component API pattern (see `ui/components/ui/sheet.tsx`) but with centered layout instead of side-panel
- `DialogOverlay` applies `bg-black/10 backdrop-blur-xs` backdrop styling
- `DialogContent` applies `bg-card ring-1 ring-foreground/10 rounded-xl` with `max-w-md` (28rem) centered layout, responsive `mx-4` on mobile
- Supports `role="alertdialog"` via prop passthrough
- Focus trap built into `@base-ui/react/dialog` — no custom implementation needed
- Escape key dismisses the dialog (native `Dialog.Root` behavior)
- Animations: `data-starting-style:opacity-0` / `data-ending-style:opacity-0` for fade; `zoom-in-95` / `zoom-out-95` for scale; 150ms duration; respects `prefers-reduced-motion`
- `DialogTitle` provides `aria-labelledby`, `DialogDescription` provides `aria-describedby`

**Acceptance criteria**:
- [ ] All seven exports are available: `Dialog`, `DialogTrigger`, `DialogClose`, `DialogOverlay`, `DialogContent`, `DialogTitle`, `DialogDescription`
- [ ] Dialog renders as a centered modal with semi-transparent backdrop
- [ ] Focus is trapped inside the dialog while open
- [ ] Escape key closes the dialog
- [ ] `aria-labelledby` and `aria-describedby` are wired via `DialogTitle` and `DialogDescription`
- [ ] Project compiles without type errors

---

### T03 — Fix Normalizer v3 Final-Review Fallback

**Objective**: Update `normalizeState()` in `ui/lib/normalizer.ts` so that when `raw.final_review` is undefined (v3 schema), it falls back to `execution.final_review_status`, `execution.final_review_doc`, and `execution.final_review_approved` fields.

**File targets**:
- `ui/lib/normalizer.ts` — MODIFY (update `final_review` mapping in `normalizeState()`)

**Key requirements**:
- When `raw.final_review` exists (v4+ schema), use it as-is (no behavior change)
- When `raw.final_review` is undefined (v3 schema), construct the normalized `final_review` from:
  - `status`: `raw.execution.final_review_status ?? 'not_started'`
  - `report_doc`: `raw.execution.final_review_doc ?? null`
  - `human_approved`: `raw.execution.final_review_approved ?? false`
- Must not break existing normalizer behavior for non-final-review fields
- This is the prerequisite for FR-2 and FR-11 — without it, the Final Review section is invisible in v3

**Acceptance criteria**:
- [ ] `normalizeState()` returns correct `final_review` when `raw.final_review` is undefined and `execution.final_review_*` fields are present
- [ ] `normalizeState()` returns default `final_review` (`status: 'not_started'`, `report_doc: null`, `human_approved: false`) when both `raw.final_review` and `execution.final_review_*` are absent
- [ ] Existing normalizer behavior for all other fields is unchanged
- [ ] Project compiles without type errors

---

### T04 — Create POST Gate Approval API Route

**Objective**: Create `ui/app/api/projects/[name]/gate/route.ts` — a POST endpoint that validates the request, invokes `pipeline.js` via `execFile`, and returns structured success/error responses.

**File targets**:
- `ui/app/api/projects/[name]/gate/route.ts` — CREATE

**Key requirements**:
- **Event whitelist**: Request body `event` must be exactly `'plan_approved'` or `'final_approved'`. Any other value → HTTP 400 `{ error: "Invalid gate event. Allowed: plan_approved, final_approved." }`
- **Project name validation**: URL param `name` must match `/^[A-Z0-9][A-Z0-9_-]*$/`. Mismatch → HTTP 400 `{ error: "Invalid project name format." }`
- **Project existence**: Use `resolveProjectDir()` from `ui/lib/path-resolver.ts` (and `getWorkspaceRoot()`). If the project directory or `state.json` does not exist → HTTP 404 `{ error: "Project not found." }`
- **Pipeline invocation**: Use `execFile` from `node:child_process` (NOT `exec`) with `promisify` from `node:util`. Command: `process.execPath` (NOT `'node'`), args: `[pipelineScriptPath, '--event', event, '--project-dir', absProjectDir]`. Encoding: `'utf-8'`.
- **Pipeline script path**: `path.join(getWorkspaceRoot(), '.github', 'orchestration', 'scripts', 'pipeline.js')`
- **Success handling**: Parse stdout as JSON. If `result.success === true` → HTTP 200 with `{ success: true, action: result.action, mutations_applied: result.mutations_applied }`
- **Pipeline rejection**: If `result.success === false` → HTTP 409 with `{ error: "Pipeline rejected the event.", detail: stdout }`
- **Spawn/crash failure**: If `execFile` throws → HTTP 500 with `{ error: "Pipeline execution failed.", detail: stderr || error.message }`
- **JSON parse failure**: If stdout is not valid JSON → HTTP 500 with `{ error: "Invalid pipeline response.", detail: stdout }`
- Uses `GateEvent`, `GateApproveResponse`, `GateErrorResponse` types from `ui/types/state.ts` (from T01)

**Acceptance criteria**:
- [ ] Returns HTTP 200 with `{ success, action, mutations_applied }` for valid `plan_approved` / `final_approved` events on an eligible project
- [ ] Returns HTTP 400 for events not in the whitelist
- [ ] Returns HTTP 400 for project names not matching `/^[A-Z0-9][A-Z0-9_-]*$/`
- [ ] Returns HTTP 404 for non-existent projects
- [ ] Returns HTTP 409 when pipeline returns `success: false`
- [ ] Returns HTTP 500 for spawn failures or unparseable pipeline output
- [ ] Uses `execFile` (not `exec`) — no shell spawned
- [ ] Uses `process.execPath` (not `'node'` string)
- [ ] Project compiles without type errors

## Phase Exit Criteria

- [ ] `GateEvent`, `GateApproveRequest`, `GateApproveResponse`, `GateErrorResponse` types exported from `ui/types/state.ts`
- [ ] `Dialog` primitive renders a centered modal with backdrop, focus trap, keyboard dismiss, and accessible roles
- [ ] `normalizeState()` correctly populates `final_review` from `execution.*` fields when `raw.final_review` is undefined
- [ ] `POST /api/projects/[name]/gate` returns 200 with pipeline result for valid `plan_approved` / `final_approved` events
- [ ] `POST /api/projects/[name]/gate` returns 400 for invalid events, 400 for malformed project names, 404 for missing projects, 409 for pipeline rejection, 500 for spawn failures
- [ ] Project compiles without type errors
- [ ] All tasks complete with status `complete`
- [ ] Build passes

## Known Risks for This Phase

- **v3 normalizer gap is a P0 prerequisite**: If T03 (normalizer fix) is not completed correctly, Phase 2's Final Review approval button integration will fail. T03 has no dependencies and can be verified independently.
- **First write-path API route**: T04 introduces the first `execFile` child-process invocation in the API layer. If `process.execPath` resolution behaves unexpectedly in the Next.js server environment, the fallback is chat-based approval. Risk is low per research findings — `process.execPath` is always available in standard Node.js/Next.js server contexts.
- **`@base-ui/react/dialog` API surface**: T02 relies on the `@base-ui/react/dialog` API matching the pattern used by the existing `Sheet` component. The library is already installed (v1.2.0+) and `Sheet` provides a working reference implementation, so integration risk is low.
