---
name: execute-coding-task
description: 'Execute any coding or testing task end-to-end from a Task Handoff document. Covers reading the handoff, implementing code, creating / running tests, and builds, verifying acceptance criteria, and writing the Task Report.'
---

# Execute Coding Task

Implement the coding task fully and correctly from a self-contained Task Handoff document. This skill governs the complete execution loop — from reading the handoff through delivering working code and a Task Report.

## Role & Constraints

### What you do:
- Read the Task Handoff document (your SOLE input)
- Implement the code changes specified in the handoff
- Create and modify files as listed in the File Targets section
- Follow the implementation steps in order
- Conform to the inlined contracts and interfaces exactly
- Write tests as specified in the Test Requirements section
- Run the test suite and build to verify your work
- Produce a structured Task Report documenting results

### What you do NOT do:
- Read any planning documents (PRD, Design, Architecture, Master Plan) — everything you need is in the handoff
- Write to `state.json` — no agent directly writes `state.json`
- Make product, design, or architectural decisions
- Deviate from the handoff without documenting the deviation
- Skip running tests — you must run them and report actual results

### Write access: Source code + tests + Task Report only

## Workflow

1. **Read the Task Handoff** at the path provided — this is your ONLY input
2. **Understand the objective**: Read the Objective and Context sections
3. **Review file targets**: Know exactly which files to create or modify
4. **Follow implementation steps**: Execute each step in order
5. **Conform to contracts**: Match the inlined interfaces exactly — type signatures, method names, return types
6. **Apply design tokens**: If the handoff includes design tokens, use the exact values provided
7. **Write tests**: Implement the test cases from the Test Requirements section
8. **Run tests**: Execute the test suite and record actual results
9. **Run build**: Execute the build command to verify compilation
10. **Restore the working directory**: After running any terminal commands inside a project subdirectory, restore CWD to the workspace root before continuing:
    ```
    cd <workspace-root>
    ```
    Failure to restore CWD will slow down the project.
11. **Check acceptance criteria**: Go through each criterion and verify it's met
12. **Produce the Task Report** using the `generate-task-report` skill
13. **Save the Task Report** to the path specified (typically `{PROJECT-DIR}/reports/{NAME}-TASK-REPORT-P{NN}-T{NN}.md`)

## Handling Issues

- **If a step is unclear**: Make the most reasonable interpretation and document it as a deviation
- **If a test fails**: Debug and fix if possible; if not, document the failure with details
- **If the build breaks**: Fix build errors before reporting; if you can't fix them, document them
- **If you deviate from the handoff**: Always document what you changed and why in the Task Report

## Output Contract

| Document | Path | Format |
|----------|------|--------|
| Source Code | Paths from Task Handoff File Targets | Language-specific |
| Tests | Paths from Task Handoff Test Requirements | Language-specific |
| Task Report | `{PROJECT-DIR}/reports/{NAME}-TASK-REPORT-P{NN}-T{NN}.md` | Markdown per template |

## Quality Standards

- **Follow the handoff exactly**: The handoff is your contract — implement what it says
- **Test results are actual**: Run the tests and record real output — never assume they pass
- **Build status is actual**: Run the build and record real output — never assume it passes
- **Every file target accounted for**: Each file from the handoff's File Targets appears in the report
- **Every acceptance criterion assessed**: Each criterion has a Met / Partial / Not Met result
- **Deviations are documented**: If you did something differently, explain what and why
