---
project: "{PROJECT-NAME}"
author: "brainstormer-agent"
created: "{ISO-DATE}"
---

# {PROJECT-NAME} — Brainstorming

## Related Projects

<!--
  Optional. Include when related or predecessor projects exist.
  Link to the richest available doc (Requirements > Master Plan > Brainstorming).
-->

- [{RELATED-PROJECT}](../{RELATED-PROJECT}/{RELATED-PROJECT}-REQUIREMENTS.md) — {one-line: what it established or why it's relevant}

## Visual Artifacts

<!--
  Optional. Include when visuals or wireframes were generated this session.
  Link every HTML artifact in the project root with a relative path. Remove if none.
-->

- [{Title}](./{PROJECT-NAME}-BRAINSTORM.html) — visual summary of the brainstorm
- [{Title}](./{PROJECT-NAME}-WIREFRAME-{SLUG}.html) — {what this wireframe shows}

## Series Context

<!--
  Optional. Include only for projects that are part of a numbered series.
  Remove this section entirely for standalone projects.
-->

| Field | Value |
|-------|-------|
| Series | `{STEM}` |
| Position | {N} of {total or "ongoing"} |
| Previous | [{STEM}-{N-1}](../{STEM}-{N-1}/{STEM}-{N-1}-BRAINSTORMING.md) |
| Next | [{STEM}-{N+1}](../{STEM}-{N+1}/{STEM}-{N+1}-BRAINSTORMING.md) or *not yet planned* |

## Problem Space

{What problem are we solving? What pain points exist? What opportunity are we exploring? 2-4 sentences.}

## Repo Targets (proposed)

<!--
  Mandatory. Every brainstorm carries a proposed working repo set.
  Repos are registry names (see /rad-repo). The (proposed) qualifier marks
  this as a working hypothesis the planner may refine downstream.
-->

**Repos involved**: `{repo-a}`, `{repo-b}`
**Repo-Group** (if applicable): `{repo-group}`
**Rationale**: {Why each repo is in the set — what part of the work lands where.}

*Note: planner may refine this set during requirements / master-plan work based
on what surfaces in scoping.*

## Validated Goals

{Only goals discussed and agreed upon. Each goal has a description, rationale, and key considerations.}

### Goal 1: {Title}

**Description**: {What is this goal?}

**Rationale**: {Why is this worth pursuing?}

**Key considerations**: {Constraints, risks, or dependencies}

### Goal 2: {Title}

**Description**: {What is this goal?}

**Rationale**: {Why is this worth pursuing?}

**Key considerations**: {Constraints, risks, or dependencies}

## Scope Boundaries

### In Scope
- {What this project WILL cover}

### Out of Scope
- {What this project will NOT cover}

## Series Dependencies

<!--
  Optional. Include only for series projects.
  Remove this section entirely for standalone projects.
-->

### Receives From {STEM}-{N-1}
- {What this project assumes is already built/shipped}

### Delivers To {STEM}-{N+1}
- {What this project will produce that the next one depends on}

## Key Constraints

- {Technical, timeline, resource, or other constraints that shape the solution}

<!--
  Optional. You should try to align with the user if you have 
  open questions rather than scribing them silently.
-->
## Open Questions

- {Unresolved questions for downstream processes to investigate}
