# DAG Process Editor — Series Overview

This document describes the DAG-PROCESS-EDITOR project series: a visual pipeline template editor built into the orchestration UI. It is the authoritative reference for the series and is cross-linked from each project's brainstorming document.

## What This Builds

A visual, ReactFlow-based editor for pipeline templates (`full.yml`, `quick.yml`, and any custom variants). Templates are YAML DAG definitions that describe the orchestration pipeline — which steps run, in what order, with what gates and loops. Today these are hand-edited YAML files. The editor makes them visual, discoverable, and safe to modify.

The editor lives at `/process-editor` and has two modes:
- **Global templates** — edit, create, and clone templates from `.github/skills/orchestration/templates/`
- **Project templates** — view and edit the `template.yml` for any individual project (locked once planning begins)

## Editor Layout

Three zones:

```
┌─────────────────┬──────────────────────────────┬─────────────────┐
│   Left Panel    │        Canvas (ReactFlow)      │   Right Panel   │
│                 │                                │                 │
│  Global / Proj  │   Nodes + edges rendered       │  [Toolbox]      │
│  template list  │   from template YAML.          │  5 node kinds   │
│                 │   Pan, zoom, select,           │                 │
│  Toggle between │   draw edges, drag nodes.      │  [Properties]   │
│  global and     │                                │  Selected node  │
│  project modes  │   Subflow containers for       │  fields, or     │
│                 │   loop node kinds.             │  template meta  │
└─────────────────┴──────────────────────────────┴─────────────────┘
```

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Graph library | `@xyflow/react` (ReactFlow) | React-native, hooks-based, supports custom node types, drag-from-external toolbox, MIT core |
| Layout engine | dagre | Simpler than elkjs, sufficient for top-to-bottom pipeline graphs and subflow layout |
| Loop nodes | ReactFlow subflow/group nodes | `for_each_phase` and `for_each_task` contain nested `body` nodes — rendered as bordered containers |
| YAML serialization | Bidirectional serializer utility | Parse YAML → ReactFlow state on load; ReactFlow state → YAML on save |
| YAML comments | Dropped on save | Accepted tradeoff — the editor owns the file after first write |
| Node positions | Not persisted to YAML | Layout is always recomputed on load from dagre; x/y are session-only |
| SSR | `dynamic` import with `ssr: false` | ReactFlow is client-only; required for Next.js |
| Global template location | `.github/skills/orchestration/templates/*.yml` | Existing location; the UI writes directly via API |
| Project template lock | Derived from `state.json` `pipeline.current_tier` | Lock on save enforced server-side too |
| Validation | Client-side, continuous, warn-but-allow | Inline errors on nodes + banner; save is never blocked |

## Node Kinds

All five template node kinds are supported in the editor:

| Kind | Icon | Notes |
|------|------|-------|
| `step` | FileText | Has `action`, `events`, `context`, `doc_output_field` |
| `gate` | Lock | Has `mode_ref`, `action_if_needed`, `approved_event`, `auto_approve_modes` |
| `conditional` | GitBranch | Has `condition` (config_ref, operator, value) and `branches` |
| `for_each_phase` | Layers | Loop container — body nodes rendered as subflow children |
| `for_each_task` | LayoutGrid | Loop container — body nodes rendered as subflow children |

`depends_on` is managed by drawing edges on the canvas — not by editing form fields.

## Project Series

| Project | Name | Focus | Brainstorming |
|---------|------|-------|---------------|
| 1 | DAG-PROCESS-EDITOR-1 | Foundation — ReactFlow install, YAML↔graph serializer, global template API routes, PoC canvas | [BRAINSTORMING](c:\dev\orchestration-projects\DAG-PROCESS-EDITOR-1\DAG-PROCESS-EDITOR-1-BRAINSTORMING.md) |
| 2 | DAG-PROCESS-EDITOR-2 | Canvas + Left Panel — `/process-editor` route, 3-zone layout, left panel toggle, custom node renderers, dagre auto-layout | [BRAINSTORMING](c:\dev\orchestration-projects\DAG-PROCESS-EDITOR-2\DAG-PROCESS-EDITOR-2-BRAINSTORMING.md) |
| 3 | DAG-PROCESS-EDITOR-3 | Authoring — toolbox, properties form, draw/delete edges, Save / Save As / New template | [BRAINSTORMING](c:\dev\orchestration-projects\DAG-PROCESS-EDITOR-3\DAG-PROCESS-EDITOR-3-BRAINSTORMING.md) |
| 4 | DAG-PROCESS-EDITOR-4 | Validation + Project Integration — inline validation, project template API, lock enforcement, project page link, edge case polish | [BRAINSTORMING](c:\dev\orchestration-projects\DAG-PROCESS-EDITOR-4\DAG-PROCESS-EDITOR-4-BRAINSTORMING.md) |

Projects run sequentially — each depends on the previous.

## Resolved Design Decisions

- **YAML comments**: Dropped on first save. No warning comment injected.
- **Subflow layout**: Automatic via dagre — no manual child positioning required.
- **Global templates writable**: `full.yml` and `quick.yml` are directly editable (no read-only protection on built-ins).
- **Template ID uniqueness**: Enforced within global templates only. Project templates may reuse global IDs.
- **Project lock trigger**: Any `pipeline.current_tier` beyond the initial pre-planning state locks the template.
- **Edit during run**: Blocked. Once planning starts, the project template is read-only in the editor.
- **`default_template` config sync**: Out of scope for this series.
