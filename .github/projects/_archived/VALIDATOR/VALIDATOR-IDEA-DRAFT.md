# VALIDATOR — Idea Draft

## Concept
A Node.js CLI tool that validates `.github/` orchestration files. It checks:
- Agent `.agent.md` frontmatter (required fields, valid values, tool permissions)
- Skill structure (SKILL.md presence, correct format, required sections)
- Cross-references between agents, skills, and config (e.g., agents reference valid skills, skills reference valid templates)
- `orchestration.yml` config integrity (valid YAML, required fields, value constraints)
- Instruction files (`.instructions.md`) — correct frontmatter, valid applyTo globs
- Schema completeness (templates referenced actually exist)

## Output
Colored pass/fail report to the terminal. Uses ANSI colors for readability:
- Green ✅ for passing checks
- Red ❌ for failures
- Yellow ⚠️ for warnings
- Summary with total pass/fail/warn counts

## Technical Notes
- Pure Node.js — no external dependencies beyond what's needed (minimized deps)
- CLI entry point (e.g., `node validate-orchestration.js` or a bin script)
- Should be runnable from the workspace root
- Exit code 0 for all pass, 1 for any failure
- Consider grouping checks by category (agents, skills, config, cross-refs)

## Scope
- This is a developer tool for the orchestration system itself
- Validates the `.github/` directory structure against the orchestration conventions
- Should be self-contained and easy to run
