# runtime-config Module

## Purpose

This folder is the harness-neutral source for system configuration and review-intensity templates. Installers consume this content verbatim and ship it to `~/.radorch/` without transformation or per-harness translation.

## Day-One Contents

**Phase 1:**
- `orchestration.yml` — system configuration (pipeline settings, defaults, routing)
- `templates/` — review-intensity tier templates
  - `extra-high.yml` — strictest review configuration
  - `high.yml` — elevated review standards
  - `medium.yml` — balanced review configuration
  - `low.yml` — minimal review configuration

## Harness-Neutral Discipline

This folder enforces strict separation of concerns:

- **No per-harness translation** — content is not tailored to Claude, Copilot, or any other harness
- **No harness vocabulary** — no Claude-specific settings, Copilot-specific paths, or harness-dependent logic
- **No adapter knowledge** — the adapter build system never reads this folder
- **Configuration only** — settings that apply to the entire rad-orchestration ecosystem

## Deploy Contract

All content in this folder is deployed **verbatim** to the user's `~/.radorch/` directory:

- `orchestration.yml` → `~/.radorch/orchestration.yml`
- `templates/*.yml` → `~/.radorch/templates/*.yml`

No transformation, expansion, or adaptation occurs during deployment. The deployed files are identical copies of the source.

## Sibling Layout

This folder is a sibling to `harness-files/` and `harness-adapters/`, not nested under either:

```
greenfield/
  ├── harness-adapters/     (adapter engine and per-harness payloads)
  ├── harness-files/        (harness-specific agents/skills source)
  ├── installers/           (installer variants and helpers)
  └── runtime-config/       (harness-neutral configuration)
```

This structure ensures that runtime configuration remains independent of harness-specific implementation details.

## Coding Standards

- YAML files follow the rad-orchestration schema
- All settings are documented inline
- Changes to configuration are tracked through git history
- No environment variables or runtime substitution; configuration is static

## Further Reading

- `installers/AGENTS.md` — how the installer layer consumes this module
