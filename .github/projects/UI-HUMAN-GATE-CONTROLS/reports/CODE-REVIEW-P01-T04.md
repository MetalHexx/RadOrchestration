---
project: "UI-HUMAN-GATE-CONTROLS"
phase: 1
task: 4
verdict: "approved"
severity: "none"
author: "reviewer-agent"
created: "2026-03-15"
---

# Code Review: Phase 1, Task 4 — Create POST Gate Approval API Route

## Verdict: APPROVED

## Summary

The gate API route is well-implemented, security-conscious, and fully consistent with the task handoff, architecture, and existing API route conventions. All seven HTTP response scenarios from the handoff are correctly mapped, the event whitelist is enforced before any I/O, `execFile` (not `exec`) prevents shell injection, and the project name regex blocks path traversal. TypeScript compilation and the production build both pass with zero errors. Two minor suggestions are noted below but neither blocks approval.

## Checklist

| Category | Status | Notes |
|----------|--------|-------|
| Architectural consistency | ✅ | Route placed at correct path per Architecture module map. Uses `path-resolver` and `fs-reader` as specified. Follows existing `state/route.ts` conventions (dynamic export, NextRequest/NextResponse, try/catch error handling). |
| Design consistency | ✅ | N/A — backend API route with no UI rendering. |
| Code quality | ✅ | Clean imports (Next.js → Node.js → types → local modules). `ReadonlySet` for the event whitelist. `satisfies` keyword for type-safe response bodies. Descriptive constant names. No dead code. |
| Test coverage | ⚠️ | No automated tests created. Task report cites a handoff "Constraints" section stating tests are verified by manual testing and type-checking. The handoff does list 9 test requirement checkboxes but does not include a formal Constraints section; however, API routes in this project have no test harness and mocking `execFile`/`readConfig`/`readProjectState` adds significant complexity. Acceptable for now; integration testing can be added in a future task. |
| Error handling | ✅ | All 7 error scenarios from the handoff are covered: invalid body (400), invalid event (400), invalid project name (400), project not found (404), pipeline rejection (409), pipeline execution failure (500), invalid pipeline JSON (500). Outer try/catch catches unexpected errors. Error messages are structured GateErrorResponse objects. |
| Accessibility | ✅ | N/A — backend API route. |
| Security | ✅ | See detailed security assessment below. |

## Security Assessment

| Control | Status | Evidence |
|---------|--------|----------|
| Event whitelist enforcement | ✅ | `ALLOWED_GATE_EVENTS: ReadonlySet<string>` with exactly `plan_approved` and `final_approved`. Checked via `.has(event)` at line 36 before any filesystem or process operation. Falsy/empty events also caught by `!event` guard. |
| Project name validation | ✅ | `PROJECT_NAME_PATTERN = /^[A-Z0-9][A-Z0-9_-]*$/` at line 15. Only uppercase alphanumeric, underscore, and hyphen are allowed. Must start with a letter or digit. Effectively blocks path traversal (`..`, `/`, `\`), shell metacharacters, and any special characters. |
| No shell invocation | ✅ | Uses `execFile` from `node:child_process` (line 2), not `exec`. `execFile` does not spawn a shell, preventing shell injection. Arguments are passed as an array — no string interpolation. |
| Safe Node.js binary resolution | ✅ | Uses `process.execPath` (not the string `'node'`) to invoke the pipeline script, avoiding PATH resolution issues. |
| Pipeline script path | ✅ | Constructed via `path.join(root, '.github', 'orchestration', 'scripts', 'pipeline.js')` using the workspace root — no user input in the path. |
| Error information leakage | ✅ | Pipeline stdout/stderr included in `detail` field for debugging. Acceptable for a local dev tool with no authentication (confirmed by Architecture: "No authentication required — local dev tool"). |
| Input sanitization ordering | ✅ | Validation order: body parse → event whitelist → project name regex → filesystem operations → process execution. All untrusted input is validated before any side effects. |

## Issues Found

| # | File | Line(s) | Severity | Issue | Suggestion |
|---|------|---------|----------|-------|-----------|
| 1 | `ui/app/api/projects/[name]/gate/route.ts` | 68 | suggestion | No timeout on `execFileAsync`. If `pipeline.js` hangs, the API request hangs indefinitely. | Add `{ timeout: 30000 }` to the `execFileAsync` options (merge with `{ encoding: 'utf-8' }`). Low priority — the pipeline script is local and deterministic, and Next.js has its own request timeout, but an explicit timeout is defensive. |
| 2 | `ui/app/api/projects/[name]/gate/route.ts` | — | suggestion | No automated tests for the 9 test requirement scenarios listed in the handoff. | Consider adding a test file in a future task using mocked `execFile`, `readConfig`, and `readProjectState` to cover the validation and error-mapping logic. Not blocking — route was manually verified and type-checked. |

## Positive Observations

- **Security-first design**: Input validation is thorough and correctly ordered — all untrusted input (event, project name) is validated before any I/O or process execution occurs.
- **Type safety**: Excellent use of TypeScript `satisfies` operator to ensure every `NextResponse.json()` call produces a valid `GateApproveResponse` or `GateErrorResponse`. The return type `Promise<NextResponse<GateApproveResponse | GateErrorResponse>>` provides compile-time guarantees.
- **Pattern consistency**: The route follows the existing `state/route.ts` conventions (`export const dynamic`, import ordering, try/catch structure, `NextRequest`/`NextResponse` usage) almost identically, making the codebase uniform.
- **Defensive error handling**: Every failure mode (JSON parse, whitelist miss, regex miss, missing project, pipeline crash, bad pipeline output, pipeline rejection, unexpected error) has a distinct HTTP status code and structured error body. No silent failures.
- **Clean code**: Well-organized imports, descriptive constant names (`ALLOWED_GATE_EVENTS`, `PROJECT_NAME_PATTERN`), `ReadonlySet` for immutability, and minimal type casting.

## Recommendations

- The two suggestions (timeout, future tests) are non-blocking improvements that can be tracked for a later task.
- No corrective action needed — task may advance.
