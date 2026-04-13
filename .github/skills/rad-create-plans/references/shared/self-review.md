# Self-Review — Planner-Time Audit

Run this after every draft, before saving.
You are checking your own output for accuracy against the codebase and cohesion with upstream documents.

## Scope

- **Your document** — the doc you are creating or revising
- **Upstream documents** — planning docs your document consumes (see dependency chain below)
- **Existing source files** — files your document references as already existing

### Planning Dependency Chain

| Document | Upstream Inputs |
|----------|----------------|
| PRD | Brainstorming doc *(if available)* |
| Research Findings | PRD |
| Design | PRD + Research Findings |
| Architecture | PRD + Design + Research Findings |
| Master Plan | PRD + Architecture + Design |
| Phase Plan | Master Plan + Architecture |
| Task Handoff | Phase Plan + Architecture |

## Workflow

1. **Identify upstream docs** from the dependency chain above.

2. **Read each upstream doc** you haven't already read in this session.

3. **Read existing source files** your document claims already exist.
   Do not assume they exist — read each file to verify your claims.

4. **Apply accuracy checks** — [rubric §1](./audit-rubric.md#part-1-codebase-accuracy-docs-vs-code).
   Verify every claim your doc makes about existing code (names, signatures, paths, types, behaviors).
   Record discrepancies and revise your document before continuing.

5. **Apply cohesion checks** — [rubric §2](./audit-rubric.md#part-2-cross-document-cohesion-docs-vs-docs).
   Verify your doc aligns with upstream docs.
   Record alignment gaps and revise before saving.
   Focus on the subsections relevant to your document type:

   | You are writing | Focus on |
   |----------------|----------|
   | PRD | §2.1 — requirements are traceable to brainstorming document |
   | Research Findings | §2.1, §2.5 — findings are scoped to PRD problem statement, terminology matches |
   | Design | §2.2 — components map to PRD functional requirements |
   | Architecture | §2.1, §2.2, §2.3 — modules cover all requirements, contracts are exact, design components have corresponding modules |
   | Master Plan | §2.1, §2.4, §2.5 — key requirements and constraints trace to PRD, Architecture and Design docs. Phase scopes cover all requirements, terminology is consistent |
   | Phase Plan | §2.4, §2.5 — tasks trace to phase scope, terminology matches upstream docs |
   | Task Handoff | §2.3, §2.5 — inlined contracts match Architecture exactly, terminology is consistent |
