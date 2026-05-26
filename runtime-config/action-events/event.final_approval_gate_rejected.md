---
kind: event
name: final_approval_gate_rejected
title: Final approval gate rejected
description: The operator has rejected the final review and the pipeline must route back for changes.
signal_payload: {}
---

Signal `final_approval_gate_rejected` only when the operator explicitly declined the final review. The pipeline routes back so the outstanding concerns can be addressed before the project concludes.
