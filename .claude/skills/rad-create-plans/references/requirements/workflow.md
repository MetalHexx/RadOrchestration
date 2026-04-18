## Role Summary

You author the project-level Requirements doc — a single ledger that captures
functional requirements (FR), non-functional requirements (NFR), architectural
decisions (AD), and design decisions (DD). This doc is the source of truth every
Master Plan step cites by ID. Keep each block lean enough to chunk, short
enough to scan, specific enough to act on.

This workflow does NOT load `references/shared/guidelines.md` or
`references/shared/self-review.md`. The authoring rules below are the full set.

## Inputs

| Input | Source | Required? |
|-------|--------|-----------|
| Orchestrator prompt | Spawn context | Yes — provides project name, output path, user description |
| Brainstorming | `{PROJECT-DIR}/{NAME}-BRAINSTORMING.md` | Optional — read if present |
| Codebase | Workspace (via Grep/Glob/Read) | Yes — private discovery to ground requirements in reality |

If no brainstorming doc exists, the orchestrator prompt plus private codebase
discovery is the full input. Do not manufacture brainstorming — say what the
prompt says, no more.

## Workflow

### Steps

1. Read inputs. Read brainstorming (if present). Read the orchestrator prompt.
   Do targeted codebase discovery — only what you need to write grounded
   requirements. Do not survey the whole repo; Grep specific symbols, Glob
   expected paths, Read the few files that actually matter.

2. Decide the four ID ranges. Count roughly how many FRs, NFRs, ADs, and DDs
   the project needs. Use four separate sequences:
   - FR-1, FR-2, ... (functional requirements — what the system does)
   - NFR-1, NFR-2, ... (non-functional — performance, security, limits)
   - AD-1, AD-2, ... (architectural decisions — cross-cutting structure)
   - DD-1, DD-2, ... (design decisions — observable state, UX, interactions)

3. Author the intro. Two short paragraphs (2–3 sentences each) capturing
   project sentiment: what is being built, who it's for, what success looks
   like. No identifier lists. No "executive summary" prose padding.

4. Author `## Goals` — single-line bullets. One thought per bullet. No caps,
   no deep-nested sub-goals; if a goal needs a paragraph, it is probably an
   FR. Within reason — two or three sub-bullets is fine if that's how the
   goal reads naturally.

5. Author `## Non-Goals` — single-line bullets. State what is explicitly
   out of scope so the master plan can't drift into it.

6. Author the four requirement sections in this order:
   - `## Functional Requirements`
   - `## Non-Functional Requirements`
   - `## Architectural Decisions`
   - `## Design Decisions`

   Skip a section entirely if the project has no items of that type. Do NOT
   include an empty heading with "None" under it.

7. Author each block with the shape:

   ```markdown
   ### {ID}: {Title}
   **Tags:** {ID}, {keyword}, {keyword}
   **Resolves:** FR-N[, FR-M]   ← only for AD/DD blocks when applicable

   {1–2 sentence description. Constraints inlined as a short bullet list
    only when a bullet form genuinely adds clarity.}
   ```

   AD and DD bodies may end with a single inline sentence capturing a
   rejected alternative:
   `Rejected alternative: {option} — {one-line consequence}.`
   Do not expand this into its own section.

8. Run the token lint:

       node .claude/skills/rad-create-plans/references/requirements/scripts/token-lint.js <path-to-saved-doc>

   The script prints a JSON array of offenders (blocks > 500 estimated tokens)
   with heading, line number, and estimated token count. Exit code is always 0;
   the lint is a soft warning, not a blocker.

9. If the offender list is non-empty, load and invoke the `log-error` skill to
   append a single entry to `{PROJECT-DIR}/{NAME}-ERROR-LOG.md` listing the
   offender headings + estimated token counts. Save the Requirements doc
   regardless — the lint is advisory.

10. Save to `{PROJECT-DIR}/{NAME}-REQUIREMENTS.md`.

## Output Contract

**Filename**: `{NAME}-REQUIREMENTS.md` at project root.

**Frontmatter**:

```yaml
---
project: "{PROJECT-NAME}"
type: requirements
status: "draft"
approved_at: null
created: "{YYYY-MM-DD}"
requirement_count: {N}
author: "planner-agent"
---
```

- `status`: `draft` | `approved` | `frozen`. Always `draft` at authoring time.
- `approved_at`: `null` at authoring time. Set to `"{ISO-DATE-TIME}"` when a
  human gate approves the doc.
- `requirement_count`: total of FR + NFR + AD + DD blocks in the body.
- `author`: exactly `"planner-agent"`.

**Body section order**:

1. `# {PROJECT-NAME} — Requirements` (H1 title)
2. Intro (1–2 paragraphs, unheaded)
3. `## Goals`
4. `## Non-Goals`
5. `## Functional Requirements` → `### FR-1:` ...
6. `## Non-Functional Requirements` → `### NFR-1:` ...
7. `## Architectural Decisions` → `### AD-1:` ...
8. `## Design Decisions` → `### DD-1:` ...

**Hard per-block target**: every `### {ID}:` block is ≤ 500 estimated tokens
(heading + body). Token-lint enforces as a soft warning.

## Constraints

- No `## Context` or `## Rationale` sub-sections inside blocks. One or two
  sentences of prose is the whole body.
- No restating the project in block bodies. The intro does that once.
- `**Tags:**` line is mandatory on every block.
- `**Resolves:**` line appears only on AD/DD blocks, and only when they
  resolve a specific FR (or small set of FRs).
- No placeholder text. No "TBD", no "details to follow". If you don't know
  enough to write it now, don't write the block.
- No cross-doc assumptions. Requirements stands on its own — it does not
  reference external planning docs. Every FR/NFR/AD/DD block is
  self-contained.
- Four separate ID sequences. Never merge FR and AD numbering.
