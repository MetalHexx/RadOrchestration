---
name: rad-source-control
description: 'Source control operations — commit code or open a PR. All inputs come from the spawn prompt.'
user-invocable: false
---

# Source Control

Scripts are in the `scripts/` folder alongside this SKILL.md. Use their absolute path when invoking them.

> **ESM/CJS note.** The bundled scripts use CommonJS (`require`). If the workspace's root `package.json` declares `"type": "module"`, invoking the scripts directly with `node` will fail with `ReferenceError: require is not defined in ES module scope`. Do **NOT** rewrite the canonical script — use direct `git` Bash invocations instead: `git add <files>` (never `git add -A`), `git commit -m "<message>"`, `git push origin <branch>`. Then emit the same `## Commit Result` JSON block from the resulting hash and push outcome.

---

## Commit Mode

**1. Build the commit message** from the spawn prompt. Derive the prefix from the task title or type (first match):

| Keywords | Prefix |
|----------|--------|
| feature, feat, new | `feat` |
| fix, bug, patch | `fix` |
| refactor, restructure, clean | `refactor` |
| test, testing, spec | `test` |
| doc, docs, documentation | `docs` |
| *(no match)* | `chore` |

Format: `{prefix}({taskId}): {title}`  
Optional body: blank line then 2–4 prose lines from the task description.

**2. Run:**
```
node <skill-dir>/scripts/git-commit.js --worktree-path "<worktree>" --message "<message>"
```

**3. Parse the JSON output from stdout and emit:**
````
## Commit Result
```json
{ "committed": <bool>, "pushed": <bool>, "commitHash": "<hash-or-null>", "error": "<msg-or-null>", "errorType": "<type-or-null>" }
```
````

---

## PR Mode

**1. Run:**
```
node <skill-dir>/scripts/gh-pr.js \
  --worktree-path "<worktree>" \
  --branch "<branch>" \
  --base-branch "<base-branch>" \
  --title "<project-name>" \
  [--body-file "<path>"]
```
`--body-file` is the path to a markdown file that becomes the PR description on GitHub. Pass it when a body file path is provided in the prompt; omit it otherwise (PR will have no description).

**2. Parse the JSON output from stdout and emit:**
````
## PR Result
```json
{ "pr_created": <bool>, "pr_url": "<url-or-null>", "pr_number": <number-or-null>, "pr_existed": <bool>, "error": "<key-or-null>", "message": "<summary>" }
```
````
