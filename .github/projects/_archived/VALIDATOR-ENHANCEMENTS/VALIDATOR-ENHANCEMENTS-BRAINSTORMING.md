---
project: "VALIDATOR-ENHANCEMENTS"
author: "brainstormer-agent"
created: "2026-03-08T00:00:00Z"
---

# VALIDATOR-ENHANCEMENTS — Brainstorming

## Problem Space

The current orchestration validator checks frontmatter correctness, tool validity, and cross-references between agents, skills, and config — but it has no awareness of whether files actually conform to the structural shape their templates define. An agent with perfect frontmatter and an empty body passes validation. Similarly, there is no guardrail to prevent context-window-bloating files from accumulating undetected. As the orchestration system grows and more teams use it, both gaps become increasingly costly.

## Validated Ideas

### Idea 1: Dynamic template shape validation

**Description**: Scrape the required `##` heading sections from each template file at runtime and enforce that the corresponding file types contain those same headings. The template files (e.g. `create-agent/templates/agent.md`) become the canonical source of truth for required structure — if the team updates a template, the check updates automatically with no code changes needed.

**Rationale**: Hard-coding section names in the validator or in `orchestration.yml` creates a two-place maintenance problem. Driving the check from the actual template files means the check and the template are always in sync. Teams can evolve their templates freely and the validator follows.

**Key considerations**:
- The validator needs to know which template path maps to which file type. This mapping lives in `orchestration.yml` under a new `validation.template_sources` block, since it can't be auto-discovered.
- Only `##` level headings should be treated as required section markers (not `###` or deeper, which are detail-level).
- A convention is needed to distinguish truly required headings from optional ones. Proposed: a `<!-- required -->` HTML comment on the heading line in the template. Headings without the comment are informational and not enforced.
- Produce a **warning** (not a failure) for instructions and prompts, which are more freeform. Produce a **failure** for agents and skills, where the template structure is well-defined and meaningful.

### Idea 2: File token length limits

**Description**: Add a configurable maximum length check for all validated file types, measured in characters as a practical proxy for token count. Files exceeding the limit produce a warning. The limit and tokenization mode are configurable in `orchestration.yml`.

**Rationale**: Oversized agent/skill/instruction files silently inflate context windows during pipeline execution, degrading agent performance and increasing cost. A length guardrail makes this visible before it causes problems. Characters are used rather than lines because line count is an inaccurate proxy — a line of code and a line of prose tokenize very differently.

**Key considerations**:
- Unit is characters, not lines. Approximately 4 chars/token for prose (documented in config as an approximation).
- An optional `gpt-tokenizer` npm dependency could provide exact token counts if added; the config `tokenizer` field would switch between `approximate` (no dependency) and `exact` (requires package). Start with `approximate`.
- A single global default limit covers all file types, with per-type overrides for files that are legitimately longer (e.g. skills vs. instructions).
- Limit produces a **warning**, not a hard failure — the file is still valid, just flagged for review.

## Scope Boundaries

### In Scope
- Adding `validation.template_sources` mapping to `orchestration.yml`
- Adding `validation.file_limits` (global default + per-type overrides) to `orchestration.yml`
- Updating `config.js` check to validate the new `validation` config block
- Updating `agents.js` and `skills.js` to check required headings against scraped template headings
- Updating all check modules to emit length warnings when file character count exceeds configured limit
- Updating `orchestration.yml` config schema and README documentation

### Out of Scope
- Actual token counting via `gpt-tokenizer` or any npm dependency (use character approximation only for now)
- Enforcing heading order, not just heading presence
- Checking content within sections (non-empty section bodies)
- Validating project documents under `.github/projects/` — only orchestration system files

## Key Constraints

- The validator has zero npm runtime dependencies today — the character-based length check must stay dependency-free
- Template scraping runs at validation time and must handle missing template files gracefully (warn, don't crash)
- The `<!-- required -->` marker convention must be documented and added to existing templates as part of this work
- Checks must remain backward-compatible — if `validation` block is absent from `orchestration.yml`, all new checks are skipped silently

## Open Questions

- Should the `<!-- required -->` marker be on the heading line itself or on a comment line immediately below? Inline is simpler to parse.
- What is the right default character limit? Agent files in this repo currently run ~2000–4000 chars. A limit of 8000 chars (~2000 tokens) seems like a reasonable starting ceiling for warnings.
- Should the template sources mapping be required config or optional? If optional and absent, the section check is simply skipped — this seems right for backward compatibility.

## Summary

Two targeted enhancements to the orchestration validator: (1) dynamically scrape required `##` headings from template files and enforce their presence in corresponding agent/skill files, using the template as the single source of truth; (2) add configurable character-length limits per file type to catch context-bloating files early. Both features are driven by a new `validation` block in `orchestration.yml`, keeping rules declarative and out of code. The validator remains dependency-free, all new checks degrade gracefully when config is absent, and the template-scraping approach eliminates the two-place maintenance problem of the alternative approaches.
