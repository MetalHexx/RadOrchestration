# User Hand-Verification — code-review-rework-e2e

After the runner drives the automated cycle to completion and writes `run-notes.md`, **complete the following checks by hand**. This verification is required before the iteration is considered done — the automated runner verifies contract shape; you verify UX + observation surfaces.

## 1. Review `run-notes.md`

Open the baseline run folder:

```
prompt-tests/code-review-rework-e2e/output/conformance-tiered/baseline-conformance-tiered-<YYYY-MM-DD>/run-notes.md
```

Confirm:

- All 11 pass criteria are explicitly marked green.
- The event trace shows the full cycle: `start` → `spawn_code_reviewer` (T2) → mediation → corrective coder spawn → `spawn_code_reviewer` (re-review, approved) → `spawn_phase_reviewer` → `spawn_final_reviewer` → `request_final_approval` (or equivalent final-tier action).
- No unexpected halts, error messages, or "action: null" stalls outside the documented resume point.

## 2. Skim each review doc

For each of the four review docs, confirm:

- **Per-requirement audit table** is present. Columns: Requirement ID | Status | Severity | Finding / Evidence | Fix Proposal / Notes.
- **Status enum matches scope**:
  - Task reviews + phase review → `on-track | drift | regression`.
  - Final review → `met | missing`.
- Verdict frontmatter matches the table's worst row (drift → at least `changes_requested`; missing → at least `changes_requested`; regression → `rejected`).
- Final review doc body contains NO references to `PRD`, `ARCHITECTURE`, or `DESIGN` documents.
- Final review doc body contains NO reference to a previous final review or "Corrective Review Context" section.

## 3. UI smoke check (Claude-in-Chrome)

### 3a. Start the UI dev server

- Kill any process on port 3000:
  - Windows: **Note** — this assumes Git Bash or WSL — the `grep` command isn't available in cmd or PowerShell. Run: `netstat -ano | grep :3000` then `taskkill /PID <pid> /F`.
  - Unix: `lsof -i :3000` then `kill <pid>`.
- Create `ui/.env.local` if absent, per `installer/lib/env-generator.js`:
  ```
  WORKSPACE_ROOT=<absolute path to prompt-tests/code-review-rework-e2e/fixtures>
  ORCH_ROOT=.claude
  ```
- In the `ui/` tree: `npm run build` first (catches compile errors up front), then `npm run dev` in the background. Confirm it binds to port 3000.

### 3b. Verify in the browser

Open `http://localhost:3000/` and navigate to the `conformance-tiered` project (baseline run folder is the project surface once the runner has driven the pipeline through).

Check:

- **Final-review section** renders from `reports/{NAME}-FINAL-REVIEW.md` — the document link should resolve to the `reports/` subdirectory, NOT the project root.
- Task and phase review doc drawers open cleanly and show the audit-table shape with Status + Severity columns.
- Final-review drawer shows `met | missing` status enum only (no `on-track`).
- Browser DevTools console shows no errors.

### 3c. Legacy-project regression check

Switch to a pre-iter-12 legacy project (e.g., `fully-hydrated` from iter-11, or `broken-colors` from iter-10). Confirm:

- Legacy final-review docs still render from their project-root path — the UI did not break back-compat.
- Task + phase review doc drawers render identically to pre-iter-12 behaviour.

### 3d. Stop the dev server

Kill the background `npm run dev` process and close the Chrome tab.

## 4. Report

Surface any regressions to the iteration agent before declaring iter-12 done. If any UI check fails, stop and root-cause — do not adjust the test to match broken output.

## 5. Sign-off

Once all four checks pass, reply to the iteration agent confirming hand-verification is complete. The agent will then consider iter-12 finished and release the worktree for merge.
