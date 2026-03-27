---
description: "Interactively create a git worktree with context-aware branch and path suggestions. Walks through branch name, worktree path, origin branch, and post-creation action using askQuestions, then runs git worktree add automatically."
argument-hint: "<branch name> <worktree path> <branch origin> <post-creation action: VS Code, Copilot CLI, Terminal>"
---

# Create Git Worktree

Guide the user through creating a git worktree for parallel development. Follow each step
precisely and in order. Do NOT skip ahead or combine steps.

---

## Step 1 — Gather Context (Silent)

Run these commands silently in the terminal. Do NOT narrate or display output.

1. `git rev-parse --show-toplevel` — store as **`repoRoot`** (absolute path, e.g. `C:\dev\my-app`)
2. `git branch --show-current` — store as **`currentBranch`**
3. Detect the default remote branch:
   - Try: `git symbolic-ref refs/remotes/origin/HEAD 2>$null` — extract the trailing segment
     (e.g. `main` from `refs/remotes/origin/main`)
   - If blank or error: run `git branch -r` and check whether `origin/main` or `origin/master`
     appears. Pick whichever exists; default to `main` if both or neither.
   - Store as **`defaultBranch`** (just the name, e.g. `main` — NOT `origin/main`)
4. From `repoRoot`:
   - **`repoName`** = last path segment (e.g. `my-app`)
   - **`repoParent`** = parent directory (e.g. `C:\dev`)
5. Detect the current OS by running:
   `if ($IsWindows) { 'windows' } elseif ($IsMacOS) { 'mac' } else { 'linux' }`
   Store as **`platform`** (`"windows"`, `"mac"`, or `"linux"`).

**Branch name suggestions**: Use words, file names, or any description from the current
conversation to form 2 meaningful suggestions. Follow common conventions:
- New feature → `feat/<noun-verb>` (e.g. `feat/create-user`, `feat/invoice-export`)
- Bug fix → `fix/<description>` (e.g. `fix/send-email`, `fix/login-redirect`)
- Chore / housekeeping → `chore/<description>`
- If no context is available use `feat/my-feature` and `fix/my-bug` as generic fallbacks.
- Give the user an option to name their own.

Store these as **`branchSuggestion1`** and **`branchSuggestion2`**.

---

## Step 2 — Question 1: Branch Name

Call `askQuestions` with **1 question**, substituting in your derived values:

```json
{
  "questions": [
    {
      "header": "branch_name",
      "question": "What should the new branch be named?",
      "options": [
        {
          "label": "{branchSuggestion1}",
          "recommended": true,
          "description": "Suggested based on your task context"
        },
        {
          "label": "{branchSuggestion2}",
          "description": "Alternative suggestion"
        },
        {
          "label": "Custom",
          "description": "Type your own branch name"
        }
      ],
      "allowFreeformInput": true
    }
  ]
}
```

Store the answer as **`branchName`**.

---

## Step 3 — Derive Worktree Path Suggestions

From `branchName`, derive **`branchSlug`**:
- Strip common prefixes: `feat/`, `feature/`, `fix/`, `hotfix/`, `chore/`, `docs/`, `refactor/`
- If the remaining string still contains `/`, take the last segment only
- Examples: `feat/create-user` → `create-user` | `fix/auth/token-refresh` → `token-refresh`
- If stripping leaves an empty string, use the full branch name as-is

Build the two path suggestions **using the platform's native path separator**:
- **`pathSuggestion1`**: `{repoParent}/{repoName}-worktrees/{branchSlug}`
  (e.g. `C:\dev\my-app-worktrees\create-user`)
- **`pathSuggestion2`**: `{repoParent}/worktrees/{branchSlug}`
  (e.g. `C:\dev\worktrees\create-user`)

---

## Step 4 — Question 2: Worktree Path

Call `askQuestions` with **1 question**, substituting in your derived values:

```json
{
  "questions": [
    {
      "header": "worktree_path",
      "question": "Where should the worktree folder be created?",
      "options": [
        {
          "label": "{pathSuggestion1}",
          "recommended": true,
          "description": "Dedicated sibling folder for this repo's worktrees"
        },
        {
          "label": "{pathSuggestion2}",
          "description": "Shared worktrees folder alongside all your repos"
        },
        {
          "label": "Custom",
          "description": "Type an absolute path"
        }
      ],
      "allowFreeformInput": true
    }
  ]
}
```

Store the answer as **`worktreePath`**.

---

## Step 5 — Question 3: Branch Origin

Call `askQuestions` with **1 question**, substituting `defaultBranch` and `currentBranch`:

```json
{
  "questions": [
    {
      "header": "branch_from",
      "question": "Which branch should the new worktree branch off from?",
      "options": [
        {
          "label": "origin/{defaultBranch}",
          "recommended": true,
          "description": "Default branch — clean, stable starting point"
        },
        {
          "label": "{currentBranch}",
          "description": "Your current branch — carry forward in-progress work"
        },
        {
          "label": "Custom",
          "description": "Type any branch name, tag, or commit ref"
        }
      ],
      "allowFreeformInput": true
    }
  ]
}
```

Store the answer as **`branchFrom`**.

---

## Step 6 — Question 4: Post-Creation Action

Call `askQuestions` with **1 question**:

```json
{
  "questions": [
    {
      "header": "post_action",
      "question": "After creating the worktree, what would you like to do?",
      "options": [
        {
          "label": "Open in new VS Code window",
          "recommended": true,
          "description": "Runs: code \"{worktreePath}\""
        },
        {
          "label": "Open Copilot CLI",
          "description": "Runs: copilot code \"{worktreePath}\""
        },
        {
          "label": "Open Claude Code",
          "description": "Runs: claude in the worktree directory (interactive session)"
        },
        {
          "label": "Open terminal at worktree",
          "description": "Changes the active terminal's working directory to the worktree"
        },
        {
          "label": "Do nothing",
          "description": "Just create it — I'll navigate there myself"
        }
      ],
      "allowFreeformInput": false
    }
  ]
}
```

Store the answer as **`postAction`**.

---

## Step 7 — Create the Worktree

Run the following command in the terminal:

```
git worktree add -b "{branchName}" "{worktreePath}" "{branchFrom}"
```

**On success**, display this confirmation (keep consistent column width):

```
──────────────────────────────────────────────
  Worktree created
  Path:     {worktreePath}
  Branch:   {branchName}
  From:     {branchFrom}
──────────────────────────────────────────────
```

**On failure**, surface the git error clearly and suggest a targeted fix:

| Symptom | Likely cause | Suggested fix |
|---|---|---|
| `already exists` in path | Worktree folder already exists | Choose a different path, or delete/rename the existing folder |
| `already exists` for branch | Branch name is taken | Choose a different branch name, or use `git worktree add "{path}" "{existingBranch}"` to check out the existing branch |
| `invalid reference` | `branchFrom` not found | Verify the origin/branch exists with `git branch -r`; run `git fetch` if needed |
| Other | Unknown | Show the raw git error and suggest running `git worktree list` to inspect current state |

Do NOT proceed to Step 8 if Step 7 fails.

---

## Step 8 — Post-Creation Action

Execute the action chosen in Step 6:

- **"Open in new VS Code window"**
  Run: `code "{worktreePath}"`
  Then inform the user: *"VS Code is now opening `{worktreePath}` in a new window. The worktree branch is `{branchName}`."*

- **"Open Copilot CLI"**
  Open an external terminal window and run `copilot code` in the worktree directory.
  Use the command matching `platform`:
  - **Windows**: `Start-Process powershell -ArgumentList @("-NoExit", "-Command", "cd '{worktreePath}'; copilot code '{worktreePath}'")`
  - **macOS**: `osascript -e 'tell application "Terminal" to do script "cd \"{worktreePath}\" && copilot code \"{worktreePath}\""'`
  - **Linux**: `gnome-terminal -- bash -c "cd '{worktreePath}' && copilot code '{worktreePath}'; exec bash"`
  Then inform the user: *"Copilot CLI is now active in `{worktreePath}`. The worktree branch is `{branchName}`."*

- **"Open Claude Code"**
  Open an external terminal window and run `claude` in the worktree directory.
  Use the command matching `platform`:
  - **Windows**: `Start-Process powershell -ArgumentList @("-NoExit", "-Command", "cd '{worktreePath}'; claude")`
  - **macOS**: `osascript -e 'tell application "Terminal" to do script "cd \"{worktreePath}\" && claude"'`
  - **Linux**: `gnome-terminal -- bash -c "cd '{worktreePath}' && claude; exec bash"`
  Then inform the user: *"Claude Code is now active in `{worktreePath}`. The worktree branch is `{branchName}`."*

- **"Open terminal at worktree"**
  Open an external terminal window at the worktree path.
  Use the command matching `platform`:
  - **Windows**: `Start-Process powershell -ArgumentList @("-NoExit", "-Command", "cd '{worktreePath}'")`
  - **macOS**: `osascript -e 'tell application "Terminal" to do script "cd \"{worktreePath}\""'`
  - **Linux**: `gnome-terminal -- bash -c "cd '{worktreePath}'; exec bash"`
  Then inform the user: *"Terminal is now at `{worktreePath}`. The worktree is on branch `{branchName}`."*

- **"Do nothing"**
  Then Inform the user: *"Worktree creation complete. The worktree is at `{worktreePath}` on branch `{branchName}`. You can navigate there and start working whenever you're ready."*
