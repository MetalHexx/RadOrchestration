# Self-Review — Planner-Time Audit

Run this after every draft, before saving.
You are checking your own output for accuracy against the codebase and cohesion with upstream documents.

## Scope

- **Your document** — the doc you are creating or revising
- **Upstream documents** — planning docs your document consumes (see dependency chain below)
- **Existing source files** — files your document references as already existing

### Planning Dependency Chain
`Some documents may not be applicable depending on the process template being used, but this is a typical chain:`

| Document | Upstream Inputs |
|----------|----------------|
| PRD | Brainstorming doc *(if available)* |
| Research Findings | PRD |
| Design | PRD + Research Findings |
| Architecture | PRD + Design + Research Findings |
| Master Plan | PRD, Design, Architecture, Research Findings |
| Phase Plan | Master Plan, Architecture, Design, PRD |
| Task Handoff | Phase Plan, Architecture, Design |

## Workflow

1. **Identify upstream docs** from the dependency chain above (or based on the selected process template).

2. **Read each upstream doc** you haven't already read in this session.

3. **Read existing source files** your document claims already exist.
   Do not assume they exist — read each file to verify your claims.

4. **Apply accuracy checks** — [rubric §1](../../../rad-plan-audit/references/audit-rubric.md#part-1-codebase-accuracy-docs-vs-code).
   Verify every claim your doc makes about existing code (names, signatures, paths, types, behaviors).
   Record discrepancies and revise your document before continuing.

5. **Apply cohesion checks** — [rubric §2](../../../rad-plan-audit/references/audit-rubric.md#part-2-cross-document-cohesion-docs-vs-docs).
   Verify your doc aligns with upstream docs.
   Record alignment gaps and revise before saving.
   Focus on the subsections relevant to your document type:

   | You are writing | Focus on |
   |----------------|----------|
   | PRD | §2.1 — requirements are traceable to brainstorming document |
   | Research Findings | §2.1, §2.6 — findings are scoped to PRD problem statement, terminology matches |
   | Design | §2.2 — components map to PRD functional requirements |
   | Architecture | §2.1, §2.2, §2.4 — modules cover all requirements, contracts are exact, design components have corresponding modules |
   | Master Plan | §2.1, §2.5, §2.6 — key requirements and constraints trace to PRD, Architecture and Design docs. Phase scopes cover all requirements, terminology is consistent |
   | Phase Plan | §2.5, §2.6 — tasks trace to phase scope, terminology matches upstream docs |
   | Task Handoff | §2.4, §2.6 — inlined contracts match Architecture exactly, terminology is consistent |

6. **Apply anti-duplication checks** (Research Findings, Design, Architecture, and Master Plan):

   **Research Findings**:
   - Does any finding body restate requirement text from the PRD? → Remove restatement
   - Does every finding add file paths, code patterns, constraints, or unknowns
     not present in the PRD? → Remove findings that only restate PRD content
   - Does any finding use "should," "recommend," or "consider"? → Remove
     prescriptive language
   - Does every finding have a traceability tag (`Relates to FR-N`)? → Add if missing

   **Design**:
   - Do any User Flows merely linearize functional requirements into steps without
     adding error recovery, branching logic, or state transitions? → Rewrite to add
     unique interaction signal or remove the flow
   - Do any component descriptions restate PRD requirement text instead of describing
     the visual and interaction contract? → Rewrite to focus on design intent
   - Do any component props include TypeScript types, file paths, or technology
     choices? → Replace with conceptual descriptions

   **Architecture**:
   - Does every addressable element have a flat sequential AD-N identifier? → Add if missing
   - Does every H3 section have a `**Tags:** AD-N, ...` line as its first body line? → Add if missing
   - Does every module, contract, and API endpoint section have a `**Resolves:** FR-X` line? → Add if missing
   - Does any code block exceed 512 tokens? → Split element or reduce interface surface
   - Does the document contain any mermaid code blocks? → Remove all mermaid blocks
   - Does any section body restate requirement text from the PRD? → Rewrite to reference FR-N only
   - Does a `## Technical Overview` section exist? → Remove it
   - Does a `## Phasing Recommendations` section exist? → Remove it

   **Master Plan**:
   - Is `total_phases` present in frontmatter and a positive integer? → Add or correct if missing or zero
   - Does `total_phases` equal the count of `### Phase N:` headings in the document body? → Reconcile if mismatched
   - Is `author` set to `"tactical-planner-agent"`? → Correct if any other value is present
   - Does every FR-N and NFR-N from the PRD appear in exactly one phase scope? → Assign any unassigned identifiers; remove any that appear in more than one phase
   - Does every AD-N from the Architecture document appear in exactly one phase scope? → Assign any unassigned; remove duplicates
   - Is every exit criterion binary (met or not met, no "should" or "mostly")? → Rewrite any non-binary criteria as observable outcomes
   - Do all Phase Outlines use the same set of fields (no mixed thick/thin phases)? → Normalize to a single thickness tier
   - Does any Phase Outline contain source code, concrete file paths (outside the Source Documents table), or technology/framework choices? → Remove all implementation content from Phase Outlines
