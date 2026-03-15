---
project: "SKILL-RECOMMENDATION"
status: "draft"
author: "architect-agent"
created: "2026-03-15T00:00:00Z"
---

# SKILL-RECOMMENDATION — Architecture

## Technical Overview

This project modifies six existing markdown instruction/template files and creates two new template files to fix two behavioral gaps in the planning pipeline: (1) task handoff skill fields contain technology labels instead of `.github/skills/` names, and (2) the UX Designer always produces a full Design document even for non-UI projects. All changes are to markdown files — no scripts, no config, no code. The "architecture" here defines which files change, the exact content structure of each change, and the dependency order between changes.

## System Layers

This project operates entirely within the **Instruction Layer** of the orchestration system — the markdown files that govern agent behavior. No runtime code is involved.

```
┌─────────────────────────────────────────────────────────────────┐
│  Agent Definitions          .github/agents/*.agent.md           │
│  (Workflow + constraints)   Governs what agents do and when     │
├─────────────────────────────────────────────────────────────────┤
│  Skill Instructions         .github/skills/*/SKILL.md           │
│  (Procedures + rules)       Step-by-step workflows agents use   │
├─────────────────────────────────────────────────────────────────┤
│  Document Templates         .github/skills/*/templates/*.md     │
│  (Output schemas)           Structural shapes of output docs    │
├─────────────────────────────────────────────────────────────────┤
│  Documentation              docs/*.md                           │
│  (Human reference)          Explains system behavior to users   │
└─────────────────────────────────────────────────────────────────┘
```

Changes in this project touch all four layers. Agent definitions and skill instructions control behavior; templates control output shape; documentation explains the behavior to humans.

## Module Map

| Module | Layer | Path | Responsibility |
|--------|-------|------|---------------|
| `create-task-handoff` skill | Skill Instructions | `.github/skills/create-task-handoff/SKILL.md` | Add skill discovery workflow step that enumerates `.github/skills/` and selects Coder-relevant skills |
| Task handoff template | Document Templates | `.github/skills/create-task-handoff/templates/TASK-HANDOFF.md` | Replace `skills_required`/`skills_optional` with single `skills` field + inline comment |
| UX Designer agent | Agent Definitions | `.github/agents/ux-designer.agent.md` | Add triage step to workflow that routes to full/flows-only/stub output path |
| `create-design` skill | Skill Instructions | `.github/skills/create-design/SKILL.md` | Add triage logic, document three output paths, reference new templates |
| Design flows-only template | Document Templates | `.github/skills/create-design/templates/DESIGN-FLOWS-ONLY.md` | New template for projects with non-visual user-facing flows (no layout, tokens, accessibility, responsive sections) |
| Design not-required stub | Document Templates | `.github/skills/create-design/templates/DESIGN-NOT-REQUIRED.md` | New template for projects with no user interaction (frontmatter + decision statement + rationale) |
| Skills documentation | Documentation | `docs/skills.md` | Add note explaining Tactical Planner skill discovery during handoff creation |
| Agents documentation | Documentation | `docs/agents.md` | Add note explaining UX Designer triage behavior |

## Contracts & Interfaces

Since all changes are to markdown instruction and template files, "contracts" here are the exact content structures that each file must conform to. These are the specifications that task implementers must match precisely.

### Task Handoff Template — New Frontmatter Shape

The template frontmatter in `.github/skills/create-task-handoff/templates/TASK-HANDOFF.md` must change from:

```yaml
# CURRENT (replace this)
skills_required: ["{skill-1}", "{skill-2}"]
skills_optional: ["{skill-3}"]
```

To:

```yaml
# NEW (exact target shape)
skills: ["{skill-1}", "{skill-2}"]  # Skill folder names from .github/skills/ — NOT technology or framework names
```

**Constraints:**
- Single `skills` array replaces both `skills_required` and `skills_optional`
- Inline YAML comment is mandatory — it prevents the mislabeling behavior
- Placeholder values use `{skill-1}`, `{skill-2}` pattern (consistent with other template placeholders)
- No other frontmatter fields change

### Skill Discovery Step — Content Specification

The following step must be inserted into the `create-task-handoff/SKILL.md` workflow, between the current "Read inputs" step (step 1) and "Write objective" step (step 2). All subsequent steps renumber.

```markdown
2. **Discover available skills**: Enumerate `.github/skills/` folder names. For each skill, read the `description` field from its `SKILL.md` frontmatter. Evaluate each skill against this task's objective and implementation steps using the lens: "would a coder working on this task benefit from invoking this skill?" Select only skills with a direct functional match. Populate the `skills` frontmatter field with the selected skill folder names. Technology or framework names (e.g., "TypeScript", "React") are NOT valid values — only `.github/skills/` folder names.
```

**Placement:** After step 1 ("Read inputs"), before the current step 2 ("Write objective"). Current steps 2–12 become steps 3–13.

### UX Designer Triage Step — Content Specification

The following triage step must be inserted into `.github/agents/ux-designer.agent.md` workflow, after "Read the Research Findings" (current step 2) and before "Design overview" (current step 3). All subsequent steps renumber.

```markdown
3. **Triage project type**: Evaluate the PRD's user stories and functional requirements to determine the project's interaction model. Route to one of three output paths:
   - **Full Design** — The project has a visual UI (frontend views, components, pages). Proceed with steps 4–13 using the full template.
   - **Flows only** — The project has user-facing flows but no visual UI (CLI wizard, interactive terminal, multi-step process). Use the flows-only template at `templates/DESIGN-FLOWS-ONLY.md`. Write only the Design Overview and User Flows sections, then save and stop.
   - **Not required** — The project has no user interaction (backend service, pipeline script, data processor, instruction file changes). Use the stub template at `templates/DESIGN-NOT-REQUIRED.md`. Record the triage decision and rationale, then save and stop.

   Default to "Not required" when the classification is uncertain.
```

**Placement:** After step 2 ("Read the Research Findings"), before the current step 3 ("Design overview"). Current steps 3–12 become steps 4–13.

### `create-design` Skill Triage — Content Specification

The same triage logic must be added to `.github/skills/create-design/SKILL.md` workflow, after step 1 ("Read inputs") and before the current step 2 ("Design overview"). The content is functionally identical to the agent triage step above, adapted for the skill's workflow format:

```markdown
2. **Triage project type**: Evaluate the PRD's user stories and functional requirements to classify the project:
   - **Full Design** — Has a visual UI (frontend, views, components). Continue with steps 3–12 using the full template at [templates/DESIGN.md](./templates/DESIGN.md).
   - **Flows only** — Has user-facing flows but no visual UI (CLI wizard, interactive terminal). Use the flows-only template at [templates/DESIGN-FLOWS-ONLY.md](./templates/DESIGN-FLOWS-ONLY.md). Write only Design Overview and User Flows, then save.
   - **Not required** — No user interaction (backend, scripts, instruction files). Use the stub template at [templates/DESIGN-NOT-REQUIRED.md](./templates/DESIGN-NOT-REQUIRED.md). Record the decision and rationale, then save.

   Default to "Not required" when uncertain.
```

**Placement:** After step 1, before current step 2. Current steps 2–11 become steps 3–12.

Additionally, the skill's **Key Rules** section and **Template** section must be updated to reference the three output paths and their templates.

### Flows-Only Template — Full Content Specification

New file: `.github/skills/create-design/templates/DESIGN-FLOWS-ONLY.md`

```markdown
---
project: "{PROJECT-NAME}"
status: "draft|review|approved"
author: "ux-designer-agent"
created: "{ISO-DATE}"
---

# {PROJECT-NAME} — Design

## Design Overview

{2-3 sentences. What user-facing flows exist and what interaction model do they use? Why is a full design document not needed?}

## Triage Decision

| Criterion | Assessment |
|-----------|------------|
| Has visual UI? | No |
| Has non-visual user-facing flows? | Yes |
| Project scope | {Brief description} |
| **Route** | **Flows only** |

## User Flows

### {Flow Name}

{Diagram}:
{Step 1} → {Step 2} → {Step 3} → {Outcome}

{Brief description of the flow, inputs, outputs, and decision points.}

## Sections Omitted

The following standard Design sections are intentionally omitted because this project has no visual UI:

- **Layout & Components** — No views, pages, or UI components
- **Design Tokens** — No visual styling
- **States & Interactions** — No visual state changes
- **Accessibility** — No visual interface to make accessible (flow accessibility is addressed in User Flows above)
- **Responsive Behavior** — No rendered output
- **Design System Additions** — Nothing to add
```

### Not-Required Stub Template — Full Content Specification

New file: `.github/skills/create-design/templates/DESIGN-NOT-REQUIRED.md`

```markdown
---
project: "{PROJECT-NAME}"
status: "not-required"
author: "ux-designer-agent"
created: "{ISO-DATE}"
---

# {PROJECT-NAME} — Design

## Design Overview

**Design document not required.** {One sentence explaining why — e.g., "This project modifies backend API endpoints with no user-facing interface changes."}

## Triage Decision

| Criterion | Assessment |
|-----------|------------|
| Has visual UI? | No |
| Has non-visual user-facing flows? | No |
| Project scope | {Brief description} |
| **Route** | **Not required — stub** |

## Sections Omitted

The following standard Design sections are intentionally omitted because they do not apply:

- **User Flows** — No user-facing flows
- **Layout & Components** — No views, pages, or UI components
- **Design Tokens** — No visual styling
- **States & Interactions** — No interactive elements
- **Accessibility** — No user interface to make accessible
- **Responsive Behavior** — No rendered output
- **Design System Additions** — Nothing to add

## No Design Decisions Needed

All changes in this project are {brief characterization — e.g., "structural edits to API contracts"}. The Architect and Tactical Planner should treat this document as confirmation that no design constraints apply.
```

### Documentation Additions — Content Specifications

**`docs/skills.md`** — Add the following note after the "Skill-Agent Composition" section, before "Creating New Skills":

```markdown
## Skill Recommendation in Task Handoffs

When creating task handoffs, the Tactical Planner enumerates `.github/skills/` and evaluates each skill's description against the task being prepared. Skills that would help the Coder complete the task (e.g., `run-tests` for tasks with test requirements, `validate-orchestration` for tasks modifying orchestration files) are listed in the handoff's `skills` field. Only skill folder names are valid — technology or framework names are not.
```

**`docs/agents.md`** — Add the following note to the UX Designer section, after the existing description paragraph:

```markdown
Before producing any content, the UX Designer triages the PRD to determine the project's interaction model. Visual UI projects receive a full Design document. Projects with non-visual user-facing flows (e.g., CLI wizards) receive a flows-only document. Projects with no user interaction receive a "not required" stub. A DESIGN.md file is always produced to satisfy downstream pipeline expectations.
```

## API Endpoints

Not applicable. This project modifies markdown instruction files only — no APIs are defined or changed.

## Dependencies

### External Dependencies

None. All changes are to markdown files within the repository.

### Internal Dependencies (file → file)

```
create-task-handoff/SKILL.md ──references──→ create-task-handoff/templates/TASK-HANDOFF.md
                                               (skill step says "populate the skills field";
                                                template defines that field's shape)

ux-designer.agent.md ──references──→ create-design/SKILL.md
                                      (agent says "Use the create-design skill";
                                       both must have identical triage logic)

create-design/SKILL.md ──references──→ create-design/templates/DESIGN.md         (existing, unchanged)
                       ──references──→ create-design/templates/DESIGN-FLOWS-ONLY.md  (new)
                       ──references──→ create-design/templates/DESIGN-NOT-REQUIRED.md (new)

docs/skills.md ──documents──→ create-task-handoff/SKILL.md  (describes the skill discovery behavior)
docs/agents.md ──documents──→ ux-designer.agent.md          (describes the triage behavior)
```

### Consistency Constraint

The triage logic in `ux-designer.agent.md` and `create-design/SKILL.md` must produce identical routing for the same PRD input. The triage criteria, output path names, template references, and default-when-uncertain rule must match exactly between the two files.

## File Structure

```
.github/
├── agents/
│   └── ux-designer.agent.md              # MODIFY — add triage step to workflow
├── skills/
│   ├── create-task-handoff/
│   │   ├── SKILL.md                       # MODIFY — add skill discovery step
│   │   └── templates/
│   │       └── TASK-HANDOFF.md            # MODIFY — replace skills_required/skills_optional
│   └── create-design/
│       ├── SKILL.md                       # MODIFY — add triage logic + three output paths
│       └── templates/
│           ├── DESIGN.md                  # NO CHANGE — existing full template stays as-is
│           ├── DESIGN-FLOWS-ONLY.md       # CREATE — flows-only template
│           └── DESIGN-NOT-REQUIRED.md     # CREATE — not-required stub template
docs/
├── skills.md                              # MODIFY — add skill recommendation note
└── agents.md                              # MODIFY — add UX Designer triage note
```

**Summary:** 6 files modified, 2 files created, 0 files deleted.

## Cross-Cutting Concerns

| Concern | Strategy |
|---------|----------|
| Backward compatibility | The `skills` field replaces `skills_required`/`skills_optional` in the template only. Existing task handoffs with the old fields remain valid and are not migrated. Forward-only change. |
| Pipeline integrity | A DESIGN.md file is always produced — even the "not required" path creates a file with valid frontmatter and `status: "not-required"`. Downstream agents (Architect, Tactical Planner) never encounter a missing Design doc. |
| Agent-skill consistency | Triage logic appears in both `ux-designer.agent.md` and `create-design/SKILL.md`. Both must use identical criteria, output paths, template references, and default behavior. Any edit to one must be mirrored in the other. |
| Default-safe triage | The UX Designer defaults to "not required" when uncertain about project type. This is safer than defaulting to full production — a missing design doc stub is less harmful than fabricated design content that misleads downstream agents. |
| No script changes | All changes are markdown instruction/template files. `pipeline.js`, `orchestration.yml`, and all other scripts/configs are untouched. |

## Phasing Recommendations

This project is small enough for a single phase, but the changes have a natural dependency order that constrains task sequencing:

1. **Task Handoff Changes** (can be done independently)
   - Modify `TASK-HANDOFF.md` template (frontmatter change) — no dependencies
   - Modify `create-task-handoff/SKILL.md` (add discovery step) — depends on template having the `skills` field to reference

2. **Design Triage Changes** (can be done independently of Task Handoff changes)
   - Create `DESIGN-FLOWS-ONLY.md` and `DESIGN-NOT-REQUIRED.md` templates — no dependencies
   - Modify `create-design/SKILL.md` (add triage logic) — depends on new templates existing
   - Modify `ux-designer.agent.md` (add triage step) — depends on `create-design/SKILL.md` having triage, or can be done simultaneously if both use the same triage specification

3. **Documentation** (depends on all behavioral changes being finalized)
   - Modify `docs/skills.md` — depends on task handoff changes
   - Modify `docs/agents.md` — depends on design triage changes

**Advisory grouping:** The Tactical Planner could structure this as 2–4 tasks within a single phase. The two workstreams (handoff skills + design triage) are independent and could be parallelized if task count allows. Documentation should come last.
