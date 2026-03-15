---
project: "PIPELINE-HOTFIX"
phase: 2
task: 1
title: "Create log-error Skill & Template"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 2
---

# Create log-error Skill & Template

## Objective

Create the `log-error` skill directory with `SKILL.md` (skill definition, workflow, entry format, and severity classification guide) and `templates/ERROR-LOG.md` (error log document template with YAML frontmatter). These two files give the Orchestrator a structured mechanism for logging pipeline execution errors to a per-project error log.

## Context

The orchestration system uses skills stored under `.github/skills/{skill-name}/` — each skill has a `SKILL.md` with YAML frontmatter (`name`, `description`) and a body describing when/how to use the skill, plus an optional `templates/` subdirectory with document templates. The `log-error` skill will be invoked by the Orchestrator whenever the pipeline returns `success: false`. It appends numbered, structured entries to an append-only error log file per project. No other files or agents are modified in this task.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `.github/skills/log-error/SKILL.md` | Skill definition with frontmatter, workflow, entry template, severity guide |
| CREATE | `.github/skills/log-error/templates/ERROR-LOG.md` | Error log document template with YAML frontmatter; empty body |

## Implementation Steps

1. **Create the directory** `.github/skills/log-error/templates/` (this implicitly creates `.github/skills/log-error/` as well).

2. **Create `.github/skills/log-error/SKILL.md`** with the exact frontmatter specified in the Contracts section below, followed by the body content described in steps 3–7.

3. **Write the "When to Use This Skill" section** explaining that the Orchestrator invokes this skill when `pipeline.js` returns `{ success: false, ... }` — this is near-mandatory, not optional.

4. **Write the "Workflow" section** with these numbered steps:
   - Step 1: Determine the error log file path: `{PROJECT-DIR}/{NAME}-ERROR-LOG.md` (e.g., `.github/projects/MYAPP/MYAPP-ERROR-LOG.md`)
   - Step 2: If the file does not exist — create it using the bundled template at `templates/ERROR-LOG.md`, fill the frontmatter fields (`project`, `created`, `last_updated`), then write the first entry as `## Error 1`
   - Step 3: If the file already exists — read the existing file, read `entry_count` from frontmatter to determine the next entry number, increment `entry_count`, update `last_updated`, and append the new entry section after the last `---` horizontal rule
   - Step 4: Entry numbering is sequential starting at 1
   - Step 5: **Append-only rule** — never modify or delete existing entries; only append new entries and update frontmatter counters

5. **Write the "Entry Template" section** containing the exact entry format specified in the Contracts section below (the heading, metadata table with all 7 fields, and the 4 subsections: Symptom, Pipeline Output, Root Cause, Workaround Applied).

6. **Write the "Severity Classification Guide" section** containing the severity table specified in the Contracts section below.

7. **Add a "Template" section** at the bottom with a relative link to the bundled template: `[ERROR-LOG.md](./templates/ERROR-LOG.md)`

8. **Create `.github/skills/log-error/templates/ERROR-LOG.md`** with ONLY the YAML frontmatter specified in the Contracts section below. The body below the frontmatter closing `---` should contain only a single heading line: `# {PROJECT-NAME} — Error Log`. No entry content — entries are appended by the Orchestrator using the skill at runtime.

## Contracts & Interfaces

### SKILL.md Frontmatter (exact)

```yaml
---
name: log-error
description: 'Log pipeline execution errors to a structured per-project error log. Use when the pipeline returns success: false, when an agent produces invalid output, or when manual intervention is needed. Appends numbered entries to an append-only error log file.'
---
```

### ERROR-LOG.md Template Frontmatter (exact)

```yaml
---
project: "{PROJECT-NAME}"
type: "error-log"
created: "{ISO-DATE}"
last_updated: "{ISO-DATE}"
entry_count: 0
---
```

After the closing `---`, the template body is:

```markdown
# {PROJECT-NAME} — Error Log
```

Nothing else. Entries are appended at runtime.

### Error Log Entry Template (exact format for each appended entry)

Each entry appended to the error log must use this exact structure:

```markdown
## Error {N}: {Brief Symptom Title}

| Field | Value |
|-------|-------|
| **Entry** | {N} |
| **Timestamp** | {ISO-8601} |
| **Pipeline Event** | {event name, e.g. `task_completed`} |
| **Pipeline Action** | {resolved action at failure, or `N/A`} |
| **Severity** | {`critical` | `high` | `medium` | `low`} |
| **Phase** | {phase index or `N/A`} |
| **Task** | {task index or `N/A`} |

### Symptom

{1-3 sentences: observable failure}

### Pipeline Output

```json
{Raw JSON from pipeline engine}
```

### Root Cause

{1-3 sentences, or "Under investigation."}

### Workaround Applied

{Recovery action, or "None — awaiting fix."}

---
```

### Entry Field Contract

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Entry | integer ≥ 1 | Yes | Sequential entry number |
| Timestamp | ISO-8601 string | Yes | When the error occurred |
| Pipeline Event | string | Yes | Event being processed at failure time |
| Pipeline Action | string \| `'N/A'` | Yes | Resolved action at failure, or `'N/A'` if pre-resolution |
| Severity | `'critical'` \| `'high'` \| `'medium'` \| `'low'` | Yes | Per severity classification guide |
| Phase | integer \| `'N/A'` | Yes | Current phase index |
| Task | integer \| `'N/A'` | Yes | Current task index |
| Symptom | markdown text | Yes | Observable failure description (1-3 sentences) |
| Pipeline Output | JSON code block | Yes | Raw `{ success: false, ... }` object |
| Root Cause | markdown text | Yes | Diagnosis or "Under investigation." |
| Workaround Applied | markdown text | Yes | Recovery action or "None — awaiting fix." |

### Severity Classification Guide (include this table in SKILL.md)

| Severity | Criteria | Examples |
|----------|----------|---------|
| `critical` | Pipeline cannot proceed; blocks all execution | Unmapped action, validation error, phase initialization failure |
| `high` | Pipeline produces incorrect state but doesn't crash | Wrong action returned, task stuck in wrong status |
| `medium` | Pipeline works around the issue with degraded behavior | Status synonym normalized instead of matching directly |
| `low` | Cosmetic or informational; no pipeline impact | Verbose error message, minor output formatting issue |

### Error Log File Path Convention

The error log file for a project lives at:

```
{PROJECT-DIR}/{NAME}-ERROR-LOG.md
```

Example: `.github/projects/RAINBOW-HELLO/RAINBOW-HELLO-ERROR-LOG.md`

### Append-Only Semantics

- New entries are appended after the last `---` horizontal rule in the document
- The frontmatter `entry_count` is incremented and `last_updated` is set to the current ISO-8601 timestamp on each append
- Existing entries are NEVER modified or deleted
- Entry numbering is sequential: read `entry_count` from frontmatter → next entry number is `entry_count + 1`

## Styles & Design Tokens

Not applicable — these are markdown skill/template files with no UI components.

## Test Requirements

- [ ] Verify `.github/skills/log-error/SKILL.md` is valid YAML frontmatter (parseable, `name` field equals `log-error`)
- [ ] Verify `.github/skills/log-error/templates/ERROR-LOG.md` is valid YAML frontmatter (parseable, has `project`, `type`, `created`, `last_updated`, `entry_count` fields)
- [ ] Verify SKILL.md body contains the workflow steps (when to invoke, file path convention, create-vs-append logic, entry numbering, append-only rule)
- [ ] Verify SKILL.md body contains the full entry template with all 7 metadata fields and 4 subsections
- [ ] Verify SKILL.md body contains the severity classification guide table with all 4 severity levels

## Acceptance Criteria

- [ ] `.github/skills/log-error/SKILL.md` exists with valid frontmatter containing `name: log-error` and the exact description string from the Contracts section
- [ ] SKILL.md body contains a workflow section with steps for: when to invoke, error log file path convention, create-vs-append logic, entry numbering, and append-only rule
- [ ] SKILL.md body contains the entry template with all 7 required fields (Entry, Timestamp, Pipeline Event, Pipeline Action, Severity, Phase, Task) and all 4 subsections (Symptom, Pipeline Output, Root Cause, Workaround Applied)
- [ ] SKILL.md body contains the severity classification guide table with `critical`, `high`, `medium`, and `low` levels
- [ ] SKILL.md body contains a "Template" section linking to `./templates/ERROR-LOG.md`
- [ ] `.github/skills/log-error/templates/ERROR-LOG.md` exists with valid frontmatter containing `project`, `type: "error-log"`, `created`, `last_updated`, and `entry_count: 0`
- [ ] ERROR-LOG.md body contains only the `# {PROJECT-NAME} — Error Log` heading (no entry content)
- [ ] No other files are created or modified

## Constraints

- Do NOT create any files outside `.github/skills/log-error/`
- Do NOT modify any existing files
- Do NOT add runtime scripts, JavaScript, or executable code — both files are pure Markdown
- Do NOT include actual error entries in `ERROR-LOG.md` — it is an empty template
- Do NOT reference external documents (Architecture, Design, PRD) in the skill or template content
- The `{PROJECT-NAME}`, `{ISO-DATE}`, `{N}`, and similar placeholders in the templates must remain as literal placeholder text — they are filled at runtime by the Orchestrator
