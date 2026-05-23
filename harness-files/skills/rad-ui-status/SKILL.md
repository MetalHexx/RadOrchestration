---
name: rad-ui-status
description: Report whether the radorch dashboard UI server is running, and its URL.
user-invocable: true
---

# rad-ui-status

Invoke the bundled CLI to check the radorch dashboard UI:

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" ui status
```

The CLI returns `running: true` with `url` when the recorded PID is alive, otherwise `running: false`. Stale PID files are cleaned automatically. Relay the status (and URL when running) to the user.
