# Shared Guidelines

These conventions apply across all document-creation workflows in the `rad-create-plans` skill.
Every planning agent loads this file before beginning its document-type-specific workflow.

## Chunk Format Convention

- Functional Requirements use `### FR-N: {Title}` headings (H3)
- Non-Functional Requirements use `### NFR-N: {Title}` headings (H3)
- Each heading + body block targets 100–150 tokens (hard ceiling: 200–300 tokens)
- Titles are 5 words maximum; body is 1–2 sentences describing what the system shall do
- Use a single blank line to separate the heading from the body within each chunk
- Architectural Decisions use `### AD-N: {Title}` headings (H3); one element per heading
- Each AD-N heading + body block targets 200–300 tokens; body is context, rationale, and key constraints
- Hard ceiling for AD-N sections containing code blocks: 512 tokens (public interface surface only)
- The `**Tags:** AD-N, tag1, tag2` line is the first line of every AD-N element body (immediately after the heading blank line)
- AD-N numbering is flat and sequential across the entire Architecture document — no per-section resets; retired numbers are never reassigned

## Optional-Input Handling

- Pattern: "Read `{NAME}-TYPE.md` if it exists; skip gracefully if the file is not present"
- Agents must not fail or prompt the user when an optional upstream document is absent
- Optional inputs are listed per-workflow in the spoke's `workflow.md`

## Output Path Convention

- All planning documents are saved to `{PROJECT-DIR}/{NAME}-{TYPE}.md`
- `{PROJECT-DIR}` is the project root directory passed in as context
- `{NAME}` is the project name; `{TYPE}` is the document type.
- This convention is defined once here — individual workflows must not redefine it

## Frontmatter Schema

- All planning documents use exactly four frontmatter fields: `project`, `status`, `author`, `created`
- `project`: the `{PROJECT-NAME}` string
- `status`: one of `draft`, `review`, or `approved`
- `author`: the agent name that produced the document (e.g., `product-manager-agent`)
- `created`: ISO date string (e.g., `2026-04-13`)
- No additional frontmatter fields are permitted

## No-Implementation Rule

- PRDs, Designs, and Master Plans must not contain source code, concrete file paths, or technology/framework choices
- Implementation details belong in Architecture and downstream task documents — not in PRDs, Designs, or Master Plans
- If a PRD, Design, or Master Plan contains implementation details, it must be revised before approval
- **Exempt documents**: Research Findings and Architecture documents may contain concrete file paths, code references, and technology details — these documents exist precisely to provide implementation-level evidence and structure
- This exemption applies only to Research Findings and Architecture — no other document types are exempt

## Self-Review

- After completing every document draft, run the self-review workflow defined in [self-review.md](self-review.md) before saving
- Do not skip self-review even if the document feels complete
- Self-review catches convention violations before the document enters the review pipeline
