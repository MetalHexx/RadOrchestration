## Role Summary

You author the project-level Requirements doc — a single ledger that captures
functional requirements (FR), non-functional requirements (NFR), architectural
decisions (AD), and design decisions (DD). This doc is the sealed specification
of the system to be built. Each block stands on its own as a conclusive
statement — a required behavior, a decided design, an architectural choice.
Keep each block lean enough to chunk, short enough to scan, specific enough to
act on.

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
   Do codebase discovery and any needed research to deliver the requirements.

1a. If the Brainstorming doc contained an `## Open Questions` section,
    resolve each question before proceeding to Step 2. Investigate with
    your available inputs (orchestrator prompt, Brainstorming, codebase),
    make a decision, and encode the finding into the relevant block. The
    planner owns the decision — Open Questions left by the user are the
    user's acknowledgment that the planner will close them. Open Questions
    are not valid Requirements content; they must be closed at this step,
    not transcribed into any block's body.

1b. If your spawn prompt carried a `## Repository Skills Available` section, scan
    the JSON array. For each entry whose `description` plausibly touches the
    project's domain, `Read` the listed absolute `path` directly. Let the conventions
    encoded in those `SKILL.md` files inform the requirements you author —
    especially any test commands, file-layout rules, or error-handling
    patterns the eligible skill defines. Absence of the section means no
    eligible repo skills exist; proceed normally.

2. Decide the four ID ranges. Count roughly how many FRs, NFRs, ADs, and DDs
   the project needs. Use four separate sequences:
   - FR-1, FR-2, ... (functional requirements — what the system does, capabilities, behaviors, features, etc.)
   - NFR-1, NFR-2, ... (non-functional — performance, security, limits, scalability, reliability, maintainability, etc.)
   - AD-1, AD-2, ... (architectural decisions — cross-cutting structure, contracts, technology requirements, error handling, data storage, API design, etc.)
   - DD-1, DD-2, ... (design decisions — observable state, UX, interactions, visual design, design tokens, css, visual component structure, etc.)

3. Author the intro. Two short paragraphs (2–3 sentences each) capturing
   project sentiment: what is being built, who it's for, what success looks
   like. No identifier lists. No "executive summary" prose padding.

4. Author `## Goals` — single-line bullets. One thought per bullet. No caps,
   no deep-nested sub-goals; if a goal needs a paragraph, it is probably an
   FR. Within reason — two or three sub-bullets is fine if that's how the
   goal reads naturally.

5. Author `## Non-Goals` — single-line bullets. State what is explicitly
   out of scope.

6. Author the four requirement sections in this order:
   - `## Functional Requirements`
   - `## Non-Functional Requirements`
   - `## Architectural Decisions`
   - `## Design Decisions`

7. Author each block with the shape:

   ```markdown
   ### {ID}: {Title}
   **Tags:** {ID}, {keyword}, {keyword}
   **Resolves:** FR-N[, FR-M]   ← only for AD/DD blocks when applicable

   {1–2 sentence description. Constraints inlined as a short bullet list
    only when a bullet form genuinely adds clarity.}

    Anything else necessary to capture the requirement or decision.
    400 estimated token limit per block (heading + body) for chunking.
   ```

8. Run the token lint:

       node .claude/skills/rad-create-plans/references/requirements/scripts/token-lint.js <path-to-saved-doc>

   The script prints a JSON array of offenders (blocks > 500 estimated tokens)
   with heading, line number, and estimated token count. Exit code is always 0;
   the lint is a soft warning, not a blocker.

9. Save to `{PROJECT-DIR}/{NAME}-REQUIREMENTS.md`.

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
  enough to write it now, don't write the requirement.
- Requirements describes the target state of the system, not the process of
  getting there. Every block is self-contained and conclusive. Do not
  reference downstream planning documents (Master Plan, phase plan, task
  handoff, execution), do not delegate work to future agents, do not encode
  future investigations as part of a decision. If the block body reads as a
  deferral, the block isn't finished — close it at Step 1a by investigating
  and deciding.
- No cross-doc assumptions. Requirements stands on its own — it does not
  reference external planning docs. Every FR/NFR/AD/DD block is
  self-contained.
- Four separate ID sequences. Never merge FR and AD numbering.
