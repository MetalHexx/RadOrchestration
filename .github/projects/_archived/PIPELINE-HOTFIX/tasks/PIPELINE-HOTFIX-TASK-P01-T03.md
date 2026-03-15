---
project: "PIPELINE-HOTFIX"
phase: 1
task: 3
title: "Status Normalization & Skill Vocabulary Reinforcement"
status: "pending"
skills_required: []
skills_optional: ["generate-task-report"]
estimated_files: 3
---

# Status Normalization & Skill Vocabulary Reinforcement

## Objective

Add status normalization in `pipeline-engine.js` inside the existing task report pre-read block so that synonyms (`pass` → `complete`, `fail` → `failed`) are translated before triage, and unknown values produce a hard error. Reinforce the `generate-task-report` skill and its template to constrain the status vocabulary to exactly `complete | partial | failed`.

## Context

The pipeline engine reads the task report's YAML frontmatter `status` field and passes it as `context.report_status` to the mutation/triage path. Currently, no normalization occurs — if an LLM Coder emits `status: 'pass'` instead of `status: 'complete'`, the triage engine receives an unrecognized value and produces unpredictable results. T01 already landed the `plan_approved` pre-read block and T02 fixed the resolver conditional split; neither touches the task report pre-read path modified here.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/orchestration/scripts/lib/pipeline-engine.js` | Insert normalization logic after `context.report_status` extraction (~line 197) |
| MODIFY | `.github/skills/generate-task-report/SKILL.md` | Insert vocabulary constraint callout before the Status Classification table |
| MODIFY | `.github/skills/generate-task-report/templates/TASK-REPORT.md` | Update frontmatter `status` field comment |

## Implementation Steps

1. **Open `.github/orchestration/scripts/lib/pipeline-engine.js`**. Locate the task report pre-read block (starts with `if (event === 'task_completed' && context.report_path)`). Find the line:
   ```javascript
   context.report_status = fm.status || null;
   ```

2. **Insert the following normalization block immediately after that line** (before `context.report_severity`):
   ```javascript
         // Normalize task report status vocabulary
         const STATUS_SYNONYMS = { 'pass': 'complete', 'fail': 'failed' };
         const VALID_STATUSES = ['complete', 'partial', 'failed'];
         if (context.report_status && STATUS_SYNONYMS[context.report_status]) {
           context.report_status = STATUS_SYNONYMS[context.report_status];
         }
         if (context.report_status && !VALID_STATUSES.includes(context.report_status)) {
           return makeErrorResult(
             `Unrecognized task report status: '${context.report_status}'. Expected one of: complete, partial, failed (or synonyms: pass, fail)`,
             event, [], null, null
           );
         }
   ```

3. **Verify indentation**: The normalization block must be indented to the same level as the surrounding lines inside the `try` block (6 spaces). The `STATUS_SYNONYMS` and `VALID_STATUSES` constants are local to the pre-read block — do NOT place them at module scope.

4. **The resulting code in the pre-read block should read** (showing full context):
   ```javascript
         const fm = reportDoc.frontmatter || {};
         context.report_status = fm.status || null;
         // Normalize task report status vocabulary
         const STATUS_SYNONYMS = { 'pass': 'complete', 'fail': 'failed' };
         const VALID_STATUSES = ['complete', 'partial', 'failed'];
         if (context.report_status && STATUS_SYNONYMS[context.report_status]) {
           context.report_status = STATUS_SYNONYMS[context.report_status];
         }
         if (context.report_status && !VALID_STATUSES.includes(context.report_status)) {
           return makeErrorResult(
             `Unrecognized task report status: '${context.report_status}'. Expected one of: complete, partial, failed (or synonyms: pass, fail)`,
             event, [], null, null
           );
         }
         context.report_severity = fm.severity || null;
         context.report_deviations = Boolean(fm.has_deviations !== undefined ? fm.has_deviations : fm.deviations);
   ```

5. **Open `.github/skills/generate-task-report/SKILL.md`**. Find the `## Status Classification` heading. Insert the following callout block **immediately before** the `## Status Classification` heading (with a blank line above and below):
   ```markdown
   > **IMPORTANT: The `status` field in the frontmatter MUST be exactly one of: `complete`, `partial`, or `failed`. Do NOT use synonyms like `pass`, `fail`, `success`, `done`, or any other word. The pipeline engine will reject reports with unrecognized status values.**
   ```

6. **Open `.github/skills/generate-task-report/templates/TASK-REPORT.md`**. Find the frontmatter `status` line. The current line reads:
   ```yaml
   status: "complete|partial|failed"
   ```
   Replace it with:
   ```yaml
   status: "complete"   # MUST be exactly: complete | partial | failed — no synonyms
   ```

## Contracts & Interfaces

### Status Normalization Map (pipeline-engine.js)

Defined as local constants inside the `task_completed` pre-read `try` block:

```javascript
const STATUS_SYNONYMS = { 'pass': 'complete', 'fail': 'failed' };
const VALID_STATUSES = ['complete', 'partial', 'failed'];
```

| Raw Value | Normalized Value | Behavior |
|-----------|------------------|----------|
| `'pass'`    | `'complete'`       | Synonym mapping applied |
| `'fail'`    | `'failed'`         | Synonym mapping applied |
| `'complete'`| `'complete'`       | Already valid — no change |
| `'partial'` | `'partial'`        | Already valid — no change |
| `'failed'`  | `'failed'`         | Already valid — no change |
| Anything else | **HARD ERROR**  | `makeErrorResult()` with exit 1 |

### Error Message Contract

When the status value is unrecognized after normalization, return:

```javascript
return makeErrorResult(
  `Unrecognized task report status: '${context.report_status}'. Expected one of: complete, partial, failed (or synonyms: pass, fail)`,
  event, [], null, null
);
```

The `makeErrorResult` helper already exists in `pipeline-engine.js` — it is used by the surrounding pre-read blocks. Do NOT create a new helper.

### makeErrorResult Signature (existing — do NOT modify)

```javascript
function makeErrorResult(message, event, mutations, context, validationPassed) {
  return {
    success: false,
    error: message,
    event,
    mutations_applied: mutations || [],
    context: context || null,
    validation_passed: validationPassed
  };
}
```

## Styles & Design Tokens

Not applicable — no UI components in this task.

## Test Requirements

- [ ] No new test files are created in this task (regression tests are in T07)
- [ ] Run the full test suite: `node --test .github/orchestration/scripts/tests/` — all existing tests must pass
- [ ] Verify no existing test assertions break due to the inserted normalization code (the normalization only fires when `context.report_status` is truthy and not already in the valid set, so existing tests using valid statuses are unaffected)

## Acceptance Criteria

- [ ] `status: 'pass'` in a task report frontmatter is normalized to `'complete'` in `context.report_status` before triage runs
- [ ] `status: 'fail'` is normalized to `'failed'`
- [ ] `status: 'banana'` (or any unrecognized value) produces `success: false` with an error message containing the string `'banana'` and listing valid options
- [ ] `status: 'complete'`, `'partial'`, `'failed'` pass through unchanged (no error, no mapping)
- [ ] `generate-task-report/SKILL.md` contains a prominent vocabulary constraint callout immediately before the Status Classification table
- [ ] `generate-task-report/templates/TASK-REPORT.md` frontmatter status line reads exactly: `status: "complete"   # MUST be exactly: complete | partial | failed — no synonyms`
- [ ] All existing tests pass: `node --test .github/orchestration/scripts/tests/` exits 0
- [ ] No new imports are added to `pipeline-engine.js`
- [ ] No files other than the three listed in File Targets are modified

## Constraints

- Do NOT add `STATUS_SYNONYMS` or `VALID_STATUSES` at module scope — they must be local to the `task_completed` pre-read `try` block
- Do NOT modify any other pre-read block (the `plan_approved` pre-read from T01 must remain untouched)
- Do NOT modify `triage-engine.js`, `mutations.js`, `resolver.js`, or `constants.js`
- Do NOT create new test files — regression tests covering this fix are handled by T07
- Do NOT change the `makeErrorResult` helper signature or behavior
- Do NOT modify the Status Classification table content in SKILL.md — only add the constraint callout block above it
- Do NOT change any existing tests — if any test uses `'pass'` or `'fail'` as a status value, the normalization will transparently convert it before triage
