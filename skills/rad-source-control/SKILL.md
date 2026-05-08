---
name: rad-source-control
description: 'Source control operations — commit code or open a PR. All inputs come from the spawn prompt.'
user-invocable: false
---

# Source Control

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

**2. Stage the files listed in the spawn prompt using direct `git` invocations:**
```bash
cd <worktree-path>
git add <file1> <file2> ... # exact filenames from prompt, never git add -A
```

**3. Commit and push:**
```bash
git commit -m "<message>"
git push origin <branch>
```
The pre-commit hook runs automatically during commit.

**4. Capture the commit hash and push outcome, then emit:**
````
## Commit Result
```json
{ "committed": <bool>, "pushed": <bool>, "commitHash": "<hash-or-null>", "error": "<msg-or-null>", "errorType": "<type-or-null>" }
```
````

---

## PR Mode

**1. Build the PR title and body** from the spawn prompt.

**2. Create the PR using `gh` (GitHub CLI):**
```bash
cd <worktree-path>
gh pr create \
  --title "<title>" \
  --body "<body>" \
  --head "<branch>" \
  --base "<base-branch>"
```
If no body is provided in the prompt, omit the `--body` flag.

**3. Parse the output and emit:**
````
## PR Result
```json
{ "pr_created": <bool>, "pr_url": "<url-or-null>", "pr_number": <number-or-null>, "pr_existed": <bool>, "error": "<key-or-null>", "message": "<summary>" }
```
````
