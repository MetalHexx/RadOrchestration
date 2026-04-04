---
description: "Configure the orchestration system using a structured questionnaire. Walks through system root, project storage, pipeline limits, gate behavior, and source control settings using askQuestions, then generates orchestration.yml."
agent: agent
tools:
  - read
  - edit
  - search
---

# Configure Orchestration System

You are configuring the orchestration system for this workspace. Follow these steps precisely. Use the `askQuestions` tool to interview the user through 5 structured groups.

---

## Group 1 — System Root

Call `askQuestions` with 1 question:

```json
{
  "questions": [
    {
      "header": "orch_root",
      "question": "Where should orchestration system files live?",
      "options": [
        { "label": ".github", "recommended": true, "description": "Standard GitHub location" },
        { "label": ".agents", "description": "VS Code alternate discovery folder" },
        { "label": ".copilot", "description": "VS Code alternate discovery folder" },
        { "label": "Custom", "description": "Type a custom folder name or absolute path" }
      ],
      "allowFreeformInput": true
    }
  ]
}
```

**Validation**: Non-empty string. If the user typed a value (not one of the predefined options), validate that relative names are a single folder with no path separators (`/` or `\`). Absolute paths are accepted as-is. If the user selected "Custom" without providing a value, prompt again.

---

## Step 1: Check for existing configuration

Using the `orch_root` value from Group 1, look for `{orch_root}/skills/orchestration/config/orchestration.yml` in the workspace root.

> **Note**: If the previous config had a `system.root` key, that key has been renamed to `system.orch_root`. Note this migration when reading old config values.

**If it does NOT exist:**
- Inform the user no configuration file was found
- Create intermediate directories if they don't exist: `{orch_root}/skills/orchestration/config/`
- Create `{orch_root}/skills/orchestration/config/orchestration.yml` with the default content below and **skip to Path Propagation**

**Default `orchestration.yml` content to create (for fresh setup):**

```yaml
# {orch_root}/skills/orchestration/config/orchestration.yml
# Orchestration System Configuration
# -----------------------------------

version: "1.0"

# ─── System ────────────────────────────────────────────────────────
system:
  orch_root: "{orch_root}"               # Orchestration root folder (relative name or absolute path)

# ─── Project Storage ───────────────────────────────────────────────
projects:
  base_path: ".github/projects"          # Where project folders are created
  naming: "SCREAMING_CASE"               # SCREAMING_CASE | lowercase | numbered

# ─── Pipeline Limits (Scope Guards) ───────────────────────────────
limits:
  max_phases: 10                         # Maximum phases per project
  max_tasks_per_phase: 8                 # Maximum tasks per phase
  max_retries_per_task: 2                # Auto-retries before escalation
  max_consecutive_review_rejections: 3   # Reviewer rejects before human escalation

# ─── Human Gate Defaults ───────────────────────────────────────────
human_gates:
  after_planning: true                   # Always gate after master plan (hard default)
  execution_mode: "ask"                  # ask | phase | task | autonomous
  after_final_review: true               # Always gate after final review (hard default)

# ─── Source Control ────────────────────────────────────────────────
source_control:
  auto_commit: "ask"                   # always | ask | never
  auto_pr: "ask"                       # always | ask | never
  provider: "github"                   # reserved: github only in v1

# ─── Notes ─────────────────────────────────────────────────────────
# Model selection is configured per-agent in .agent.md frontmatter.
```

**If it DOES exist:**
- Read the current values from the file
- Note the **current `system.orch_root`** and **current `projects.base_path`** — you'll need them in Path Propagation to detect stale references
- Proceed to Groups 2–4 to allow the user to review and change settings

---

## Group 2 — Project Storage

Call `askQuestions` with 2 questions:

```json
{
  "questions": [
    {
      "header": "base_path",
      "question": "Where should project folders be stored?",
      "options": [
        { "label": ".github/projects", "recommended": true, "description": "Under the orchestration root" },
        { "label": "orchestration-projects", "description": "Top-level sibling folder" },
        { "label": "Custom", "description": "Type a custom relative or absolute path" }
      ],
      "allowFreeformInput": true
    },
    {
      "header": "naming",
      "question": "File naming convention for project artifacts?",
      "options": [
        { "label": "SCREAMING_CASE", "recommended": true, "description": "MY-PROJECT-NAME (default)" },
        { "label": "lowercase", "description": "my-project-name" },
        { "label": "numbered", "description": "001-project-name" }
      ],
      "allowFreeformInput": false
    }
  ]
}
```

---

## Group 3 — Pipeline Limits

Call `askQuestions` with 4 questions:

```json
{
  "questions": [
    {
      "header": "max_phases",
      "question": "Maximum phases per project?",
      "options": [
        { "label": "5" },
        { "label": "8" },
        { "label": "10", "recommended": true },
        { "label": "15" },
        { "label": "20" }
      ],
      "allowFreeformInput": true
    },
    {
      "header": "max_tasks",
      "question": "Maximum tasks per phase?",
      "options": [
        { "label": "4" },
        { "label": "6" },
        { "label": "8", "recommended": true },
        { "label": "12" }
      ],
      "allowFreeformInput": true
    },
    {
      "header": "max_retries",
      "question": "Maximum retries per task before escalation?",
      "options": [
        { "label": "1" },
        { "label": "2", "recommended": true },
        { "label": "3" }
      ],
      "allowFreeformInput": true
    },
    {
      "header": "max_rejections",
      "question": "Maximum consecutive review rejections before human escalation?",
      "options": [
        { "label": "2" },
        { "label": "3", "recommended": true },
        { "label": "5" }
      ],
      "allowFreeformInput": true
    }
  ]
}
```

---

## Group 4 — Gate Behavior

Call `askQuestions` with 1 question:

```json
{
  "questions": [
    {
      "header": "execution_mode",
      "question": "How should execution gates work?",
      "options": [
        { "label": "ask", "recommended": true, "description": "Confirm before each action" },
        { "label": "phase", "description": "Confirm per phase" },
        { "label": "task", "description": "Confirm per task" },
        { "label": "autonomous", "description": "No confirmation required" }
      ],
      "allowFreeformInput": false
    }
  ]
}
```

---

## Group 5 — Source Control

Call `askQuestions` with 2 questions:

```json
{
  "questions": [
    {
      "header": "auto_commit",
      "question": "How should auto-commit behave for this system?",
      "options": [
        { "label": "always", "description": "Commit and push automatically after every approved task" },
        { "label": "ask",    "recommended": true, "description": "Ask at the start of each project run" },
        { "label": "never",  "description": "Never commit automatically" }
      ],
      "allowFreeformInput": false
    },
    {
      "header": "auto_pr",
      "question": "How should auto-PR behave for this system?",
      "options": [
        { "label": "always", "description": "Create a pull request automatically on final approval" },
        { "label": "ask",    "recommended": true, "description": "Ask at the start of each project run" },
        { "label": "never",  "description": "Never create pull requests automatically" }
      ],
      "allowFreeformInput": false
    }
  ]
}
```

---

## YAML Generation

After completing all 5 groups (Groups 2–5 for existing config), assemble and write `{orch_root}/skills/orchestration/config/orchestration.yml` with the collected values (create intermediate directories if needed):

```yaml
# {orch_root}/skills/orchestration/config/orchestration.yml
# Orchestration System Configuration
# -----------------------------------

version: "1.0"

# ─── System ────────────────────────────────────────────────────────
system:
  orch_root: "{orch_root}"               # Orchestration root folder (relative name or absolute path)

# ─── Project Storage ───────────────────────────────────────────────
projects:
  base_path: "{base_path}"               # Where project folders are created
  naming: "{naming}"                     # SCREAMING_CASE | lowercase | numbered

# ─── Pipeline Limits (Scope Guards) ───────────────────────────────
limits:
  max_phases: {max_phases}               # Maximum phases per project
  max_tasks_per_phase: {max_tasks}       # Maximum tasks per phase
  max_retries_per_task: {max_retries}    # Auto-retries before escalation
  max_consecutive_review_rejections: {max_rejections}  # Reviewer rejects before human escalation

# ─── Human Gate Defaults ───────────────────────────────────────────
human_gates:
  after_planning: true                   # Always gate after master plan (hard default)
  execution_mode: "{execution_mode}"     # ask | phase | task | autonomous
  after_final_review: true               # Always gate after final review (hard default)

# ─── Source Control ────────────────────────────────────────────────
source_control:
  auto_commit: "{auto_commit}"          # always | ask | never
  auto_pr: "{auto_pr}"                  # always | ask | never
  provider: "github"                    # reserved: github only in v1

# ─── Notes ─────────────────────────────────────────────────────────
# Model selection is configured per-agent in .agent.md frontmatter.
```

**Important**: Do NOT include `errors:` or `git:` sections in the generated YAML — these have been removed from the system.

**Hard-coded gates**: `human_gates.after_planning` and `human_gates.after_final_review` are always `true` and are not user-configurable. If the user attempts to set either to `false`, warn them: _"These are hard-coded safety gates and cannot be disabled."_

---

## Path Propagation

If `system.orch_root` or `projects.base_path` changed from its previous value (or this is a fresh setup), scan for stale references and update them.

**Migration note**: If the old config used `system.root`, note that it has been renamed to `system.orch_root`. Scan for any references to the old key name and update them.

**Old orch_root** = previous value of `system.orch_root` (or `system.root` if migrating)
**New orch_root** = newly selected value
**Old base_path** = previous value of `projects.base_path` (or `.github/projects` if freshly created)
**New base_path** = newly selected value

### If `system.orch_root` changed

Search every file under `{new_orch_root}/` for occurrences of the old root string and update them to the new root string. Report every file that contains the old root string.

### If `projects.base_path` changed

Search every file under `{orch_root}/` for occurrences of the old `projects.base_path` string. This includes:
- `{orch_root}/instructions/` — look for `applyTo` patterns containing the old path
- `{orch_root}/copilot-instructions.md` — look for any hardcoded path references
- `{orch_root}/agents/*.agent.md` — look for any hardcoded paths
- `{orch_root}/skills/**/*.md` — look for any hardcoded paths
- `{orch_root}/prompts/**/*.md` — look for any hardcoded paths
- Any other files under `{orch_root}/`

For each file found, replace the old path with the new path. Key replacement pattern:

**In `{orch_root}/instructions/project-docs.instructions.md`:**
```
applyTo: '<old_base_path>/**'
→
applyTo: '<new_base_path>/**'
```

**In any other files**: Replace the old path string with the new path string.

---

## Verification and Report

After all updates are complete, report:

1. **Configuration saved**: Show the final `orchestration.yml` values, highlighting any that changed
2. **Files updated**: List every file that was modified and what changed (old → new)
3. **Files scanned with no changes needed**: List files that were checked but had no hardcoded references
4. **Action items**: Anything the user needs to do manually

If `projects.base_path` changed and existing project folders exist at the old path:
> ⚠️ **Manual step required**: Existing project folders at `<old_base_path>/` will not be moved automatically. Move them to `<new_base_path>/` to continue using existing projects.
