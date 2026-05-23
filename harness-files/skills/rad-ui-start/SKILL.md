---
name: rad-ui-start
description: Start the radorch dashboard UI as a detached server and report the URL.
user-invocable: true
---

# rad-ui-start

Invoke the bundled CLI to launch the radorch dashboard UI:

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" ui start
```

The CLI emits a single JSON envelope on stdout. On success the envelope's `data.url` field contains the URL the user should open in a browser; report it directly to the user. On failure the envelope's `error.message` describes the cause (typical case: every port 3000-3010 is taken) — relay it verbatim.
