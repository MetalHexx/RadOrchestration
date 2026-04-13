# Full Audit — Complete Planning Set Review

Review the entire planning document set for codebase accuracy and cross-document cohesion.

## Inputs

1. **All planning documents** — read in pipeline order:
   PRD → Research Findings → Design → Architecture → Master Plan → Phase Plans (if they exist)
2. **Existing source files** — files the docs reference as already existing. These are ground truth.

## Workflow

### Step 1: Read all planning documents

Read every doc **in pipeline order**. Reading in order lets you trace the dependency chain and spot where drift enters.

As you read, note:
- Numbered requirements (FR-*, NFR-*)
- Contracts and interfaces (exact shapes, language-specific syntax)
- Components and design tokens
- Phase outlines and exit criteria
- Module map and file paths
- Anything marked frozen, sacred, or NFR
- Frontmatter fields (`total_phases` in Master Plan, `tasks` array in Phase Plans)

### Step 2: Read existing source files

Identify files the docs claim already exist — current dependencies, modified modules, unchanged modules. Read each one. Skip files that exist only as planned additions.

### Step 3: Accuracy checks

Apply [rubric §1](./audit-rubric.md#part-1-codebase-accuracy-docs-vs-code) across all documents. For every claim about existing code, verify against the source. Confirm the doc is claiming the thing *already exists* before recording a finding.

### Step 4: Cohesion checks

Apply [rubric §2](./audit-rubric.md#part-2-cross-document-cohesion-docs-vs-docs) across the full document set:

- §2.1 Requirement Traceability
- §2.2 Design ↔ Architecture Alignment
- §2.3 Master Plan Alignment
- §2.4 Contract Consistency
- §2.5 Scope Alignment
- §2.6 Terminology Consistency

### Step 5: Report

Use the [finding format](./audit-rubric.md#finding-format) from the rubric. Organize findings by dimension.

Zero findings: *"Audit complete. No findings — the planning set is accurate and cohesive."*

## Quality Bar

- **Zero false positives** — planned additions are not accuracy bugs; stylistic preferences are not cohesion issues
- **Both dimensions covered** — accuracy AND cohesion checks, not just one
- **Traceable findings** — every finding cites specific text in specific docs with specific evidence
- **Uncertainty defaults to no-flag** — a false positive damages trust more than a missed low-severity issue
