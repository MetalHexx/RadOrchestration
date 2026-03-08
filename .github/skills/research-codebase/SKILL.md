---
name: research-codebase
description: 'Research and analyze the codebase, documentation, and external sources to gather context for a new project or feature. Use when exploring existing code, analyzing technology stack, discovering code patterns, finding relevant modules, researching APIs, or gathering technical context before creating a PRD or Architecture. Produces a structured research findings document with codebase analysis, patterns, constraints, and recommendations.'
---

# Research Codebase

Explore the codebase, documentation, and external sources to gather technical context. The research findings feed into the PRD (what to build) and Architecture (how to build it).

## When to Use This Skill

- At the start of a new project before creating a PRD
- When the Orchestrator spawns the Research Agent to gather context
- When you need to understand existing code, patterns, and constraints before planning

## Inputs Required

| Input | Source | Description |
|-------|--------|-------------|
| Brainstorming document *(optional)* | `{NAME}-BRAINSTORMING.md` | Project idea and scope — defines research direction. Only exists if the human used `@Brainstormer`. |
| Human's project idea | Orchestrator prompt | If no brainstorming doc exists, the Orchestrator provides the idea directly |

## Workflow

1. **Read the Brainstorming document** (if it exists) or the human's project idea: Understand what needs to be researched
2. **Analyze the codebase**: Find files, modules, and patterns relevant to the project
   - Search for relevant file names, function names, and patterns
   - Read key files to understand existing architecture
   - Map the technology stack (languages, frameworks, versions)
3. **Document existing patterns**: Record conventions the project follows (naming, file structure, coding style)
4. **Find relevant modules**: Identify existing code that the project will interact with or extend
5. **Research external sources**: If the idea references external APIs, libraries, or standards — research them
6. **Discover constraints**: Note technical limitations, compatibility requirements, or dependencies
7. **Form recommendations**: Based on findings, note what the PM and Architect should consider
8. **Write the Research Findings**: Use the bundled template at [templates/RESEARCH-FINDINGS.md](./templates/RESEARCH-FINDINGS.md)
9. **Save**: Write to `{PROJECT-DIR}/{NAME}-RESEARCH-FINDINGS.md`

## Key Rules

- **Concrete file paths**: Always point to actual files, not vague "the auth module"
- **Patterns over opinions**: Report what IS, not what should be — the PM and Architect decide
- **Concise**: Tables and bullets — no narrative. This feeds into other agents
- **Scope to the idea**: Don't analyze the entire codebase — focus on what's relevant to the project

## Template

Use the bundled template: [RESEARCH-FINDINGS.md](./templates/RESEARCH-FINDINGS.md)
