---
name: create-brainstorming
description: 'Brainstorm and refine project ideas through collaborative ideation. Use when exploring problem spaces, validating concepts, building consensus on what to build, or creating the initial project idea document. Produces a structured brainstorming document with validated ideas, scope boundaries, and problem statements that feed into Research and PRD creation.'
---

# Create Brainstorming Document

Guide a collaborative brainstorming session and produce a structured BRAINSTORMING.md document. This is the first document in a project — it captures the refined, consensus-driven project idea that feeds into Research and PRD creation.

## When to Use This Skill

- When a user wants to brainstorm a new project idea before starting the orchestration pipeline
- When the Brainstormer Agent needs to create or update a BRAINSTORMING.md document
- When exploring a problem space and converging on a concrete project concept

## Inputs Required

| Input | Source | Description |
|-------|--------|-------------|
| Conversation context | User dialogue | Ideas, problems, goals discussed with the human |
| Project name | User-provided | The `SCREAMING-CASE` project name for folder/file naming |
| Base path | `orchestration.yml` | `projects.base_path` (default: `.github/projects`) |

## Workflow

1. **Collaborate with the human**: Explore the problem space through active dialogue — suggest ideas, ask clarifying questions, challenge assumptions
2. **Build consensus**: Only capture ideas the human agrees are worth pursuing. Ask which directions to keep and which to drop
3. **Create project folder** (if it doesn't exist): Create `{base_path}/{PROJECT-NAME}/` — the minimal project directory. Do NOT create subfolders (`phases/`, `tasks/`, `reports/`) — the Tactical Planner does that during project initialization
4. **Structure the document**: Organize validated ideas using the bundled template at [templates/BRAINSTORMING.md](./templates/BRAINSTORMING.md)
5. **Write the BRAINSTORMING.md**: Save to `{PROJECT-DIR}/{NAME}-BRAINSTORMING.md`
6. **Iterate**: As the conversation continues, update the document — add new validated ideas, refine existing ones, remove superseded concepts
7. **Finalize**: When brainstorming concludes, ensure the document has a clear problem statement, validated ideas with rationale, scope boundaries, and enough context for the Research Agent to begin

## Key Rules

- **Consensus before writing**: Don't dump every idea — only write ideas that have been validated through dialogue
- **Living document**: Update ideas as they evolve. Remove stale concepts. The document should always reflect the current state of thinking
- **Structured but not rigid**: Use the template sections as guides, but adapt to what emerged in conversation. Not every section needs to be filled
- **Active collaboration, not passive scribing**: The agent should suggest, challenge, and refine — not just record
- **Minimal folder creation**: Only create the project folder and the BRAINSTORMING.md file. No state.json, no STATUS.md, no subfolders
- **Project name convention**: Use `SCREAMING-CASE` for the project name (e.g., `MY-PROJECT`)

## Template

Use the bundled template: [BRAINSTORMING.md](./templates/BRAINSTORMING.md)
