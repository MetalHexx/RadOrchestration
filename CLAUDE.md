# Repository Guidance

This repository ships an orchestration system that drives a planner → coder → reviewer pipeline through a deterministic Node engine. The system's runtime artifacts (agents, skills, scripts) live under `.claude/`; the user-facing pipeline entrypoint is `.claude/skills/rad-orchestration/scripts/main.ts` (compiled to `pipeline.js`). Subagents discover behavior through bundled skills under `.claude/skills/rad-*/`.

## Reserved Namespace: rad-*

Skills shipped by the orchestration system carry the `rad-` prefix on both folder name and frontmatter `name`. The prefix is a **documentation-only reserved namespace** — the system does not hard-enforce uniqueness against downstream authors, but the planner-spawn manifest filter (`list-repo-skills.mjs`) deliberately excludes any `rad-*` skill from the manifest. Authoring a `rad-something` skill in your own repo will therefore make it invisible to the planner.

See `.claude/skills/rad-create-skill/SKILL.md` for the matching authoring convention.
