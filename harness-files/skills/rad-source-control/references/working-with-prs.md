## PR Mode

**1. Run:**
```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" git pr \
  --worktree-path "<worktree>" \
  --branch "<branch>" \
  --base-branch "<base-branch>" \
  --title "<project-name>" \
  [--body-file "<path>"]
```
`--body-file` is the path to a markdown file that becomes the PR description on GitHub. Pass it when a body file path is provided in the prompt; omit it otherwise (PR will have no description).

**2. Parse the envelope on stdout. Read fields from `data` and emit:**
````
## PR Result
```json
{ "pr_created": <data.pr_created>, "pr_url": "<data.pr_url-or-null>", "pr_number": <data.pr_number-or-null>, "pr_existed": <data.pr_existed>, "error": "<data.error-or-null>", "message": "<data.message>" }
```
````
