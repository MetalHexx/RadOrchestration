---
name: rad-ui-stop
description: Stop the detached radorch dashboard UI server (SIGTERM).
user-invocable: true
---

# rad-ui-stop

Invoke the bundled CLI to stop the running radorch dashboard UI:

```bash
"${PLUGIN_ROOT}/bin/radorch.mjs" ui stop
```

The CLI sends SIGTERM to the recorded PID, removes the PID file, and emits a success envelope. If the UI was not running, the envelope still reports `stopped: true` (idempotent). Report the result to the user.
