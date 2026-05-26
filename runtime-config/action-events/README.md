# action-events catalog

This folder is the shipped catalog of action and event definition files consumed by the pipeline engine at runtime. Each file follows the naming pattern `<kind>.<name>.md` where `<kind>` is either `action` or `event` and `<name>` is the snake_case identifier that uniquely identifies the entry within its kind.

Every file must open with a YAML frontmatter block containing `kind`, `name`, `title`, and `description`. Action files additionally require `category` (one of `agent-spawn`, `gate`, `terminal`, `source-control`) and `completion_event` (a string or `null`). Event files additionally require `signal_payload` (an object map of payload flag definitions, or `{}` for no flags).

The `custom/` subfolder holds project-level overlays that extend or annotate catalog entries without modifying the shipped files. See `custom/README.md` for the slot shapes and merge behavior.

This folder is read by the pipeline at load time — it is not consumed directly by agents. Do not place agent-facing instructions here.
