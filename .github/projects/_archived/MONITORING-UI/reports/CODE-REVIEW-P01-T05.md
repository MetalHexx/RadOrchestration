---
project: "MONITORING-UI"
phase: 1
task: 5
verdict: "approved"
severity: "none"
author: "reviewer-agent"
created: "2026-03-09"
---

# Code Review: Phase 1, Task 5 — API Routes (Re-review after Corrective Fix)

## Verdict: APPROVED

## Summary

Re-review after the Coder applied a corrective fix for the path traversal vulnerability identified in the initial review. The fix implements a two-layer defense — input sanitization rejecting `..` in the path parameter, plus defense-in-depth verification that the resolved path stays within the project directory. Both guards are correctly placed before any filesystem read. All four API routes remain clean, and build/lint/tsc pass with zero errors.

## Checklist

| Category | Status | Notes |
|----------|--------|-------|
| Architectural consistency | ✅ | All four routes remain thin wrappers delegating to `@/lib/*` utilities. No business logic in route handlers. Module boundaries honored. |
| Design consistency | ✅ | N/A — API routes have no UI. Response shapes match `DocumentResponse`, `ProjectSummary[]`, `ParsedConfig` contracts. |
| Code quality | ✅ | Clean, consistent patterns across all 4 files. The security guards are concise and well-commented. No dead code. |
| Test coverage | ✅ | No test files required per task constraints. Build, type-check, and lint verified. |
| Error handling | ✅ | Correct HTTP status codes: 200/400/404/422/500 as specified. Both security guards return 400 with generic `{ error: 'Invalid path' }` — appropriately avoids leaking path details. |
| Accessibility | ✅ | N/A — API routes. |
| Security | ✅ | Path traversal vulnerability is fixed. See detailed analysis below. |

## Security Fix Analysis

### Layer 1: Input Sanitization (line 21–26)

```typescript
if (pathParam.includes('..')) {
  return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
}
```

Rejects any `pathParam` containing `..` before any filesystem operations occur. This blocks the classic `../../etc/passwd` traversal and any encoded variants that decode to `..` before reaching this check.

### Layer 2: Defense-in-Depth (lines 33–37)

```typescript
const projectDir = resolveProjectDir(root, config.projects.base_path, params.name);
const absPath = resolveDocPath(root, config.projects.base_path, params.name, pathParam);

if (!absPath.startsWith(projectDir)) {
  return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
}
```

After resolving the absolute path via `path.resolve()`, verifies the result starts with the expected project directory. This catches edge cases that bypass the `..` check — for example, if `pathParam` is an absolute path like `/etc/passwd`, `path.resolve()` would ignore the preceding segments, but the `startsWith` check catches it since the result won't be under `projectDir`.

### Attack Vectors Verified

| Vector | Blocked By | Result |
|--------|-----------|--------|
| `?path=../../etc/passwd` | Layer 1 (`..` check) | 400 |
| `?path=..%2F..%2Fetc%2Fpasswd` (URL-decoded by Next.js) | Layer 1 (`..` check) | 400 |
| `?path=/etc/passwd` (absolute path) | Layer 2 (`startsWith` check) | 400 |
| `?path=C:\etc\passwd` (absolute Windows path) | Layer 2 (`startsWith` check) | 400 |
| `?path=` (empty) | Existing `!pathParam` falsy check | 400 |
| `?path=tasks/valid-doc.md` (legitimate) | Neither — passes through | 200 |

### Minor Hardening Note

The `startsWith(projectDir)` check uses string prefix matching without a trailing path separator. In theory, if a sibling project directory shares a prefix (e.g., `FOO` and `FOOBAR`), a path resolved under `FOOBAR` would pass a `startsWith('...FOO')` check. In practice this is not exploitable here because: (a) Layer 1 blocks `..`, preventing traversal to a sibling directory, and (b) without `..`, `path.resolve(root, basePath, name, relativePath)` always resolves under `projectDir/`. Noted for awareness, not blocking.

## Issues Found

_No issues found. The previous review's Issue #1 (path traversal vulnerability) has been properly resolved._

## Positive Observations

- **Two-layer defense correctly implemented**: Both guards must pass before `readDocument()` is called. The order is correct — cheap string check first, then the `path.resolve`-based verification.
- **Generic error messages**: Both guards return `{ error: 'Invalid path' }` without revealing internal path details, avoiding information leakage.
- **Minimal diff**: The fix adds exactly the needed guards (~12 lines) plus one import addition without restructuring the existing logic. Clean surgical change.
- **All original strengths preserved**: Thin wrapper pattern, consistent error handling across all 4 routes, correct HTTP status codes, read-only GET exports, clean TypeScript.

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ Pass — zero type errors |
| `npm run lint` | ✅ Pass — no ESLint warnings or errors |
| `npm run build` | ✅ Pass — all 4 routes compiled, static/dynamic correctly identified |

## Recommendations

- No further changes needed for this task. The path traversal fix is correct and the code is production-quality.
- Proceed with marking Task P01-T05 as complete and advancing the phase.
