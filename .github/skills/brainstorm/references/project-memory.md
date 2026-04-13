# Project Memory

When and how to consult past projects to inform the current brainstorm.

## When to Activate

Don't scan the project directory by default. Activate when the conversation signals a connection to past work:

- User names a specific project (e.g., "like we did in DAG-VIEW")
- User references a domain keyword that maps to known projects (e.g., "installer", "pipeline", "schema")
- User says something like "building on X", "continuation of", "next iteration"
- The idea clearly overlaps with a domain you know has prior projects

Use judgment. If the brainstorm is clearly greenfield with no prior context, skip this.

## Finding Candidates

Dispatch an **Explore** subagent to scan the projects directory (from `projects.base_path` in `orchestration.yml`). Instruct it to:

1. **List project folders** in the base path
2. **Strip suffixes** to surface series siblings: remove trailing `-N`, `-N-FIXES`, `-SPIKE` to find the stem (e.g., `DAG-VIEW-4` → stem `DAG-VIEW`)
3. **Match keywords** — compare the new project's domain against folder names for thematic overlap
4. **Return the top ~5 most relevant** project folder names

## What to Read

For each candidate, read the single richest document available, in this priority:

| Priority | Document | Why |
|----------|----------|-----|
| 1 | `{NAME}-PRD.md` | Goals, non-goals, requirements — densest signal |
| 2 | `{NAME}-MASTER-PLAN.md` | Phasing decisions, risk register, carry-forward |
| 3 | `{NAME}-ARCHITECTURE.md` | Technical boundaries, constraints |
| 4 | `{NAME}-BRAINSTORMING.md` | Early-stage framing, useful for in-progress series |
| 5 | `{NAME}-RESEARCH-FINDINGS.md` | Discovered patterns, codebase constraints |
| — | `{NAME}-ERROR-LOG.md` | What went wrong — avoid repeating mistakes |

Stop at the first document that exists for each project. Don't read multiple docs per project unless you need to cross-reference.

## Using What You Find

- **Inform your suggestions** — prior context lets you ask sharper questions and propose grounded ideas instead of generic ones.
- **Surface relevant highlights** — when a prior project directly informs this one (established scope, deferred work, known constraints), share 1–2 specific findings proactively.
- **Flag overlap** — if the new idea duplicates something already shipped or explicitly descoped, say so before the user invests time in it.
- **Cite your sources** — reference the project and document you drew from. High-relevance findings get an explicit callout; tangential ones can be woven in naturally.
