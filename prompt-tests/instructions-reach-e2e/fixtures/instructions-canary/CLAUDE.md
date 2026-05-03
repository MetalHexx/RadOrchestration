# Project Instructions

## Authoring conventions

When authoring any planning or design document for this project (Requirements, Master Plan, phase docs, task handoffs, or any other markdown deliverable), you MUST include the literal token `MARKER-CLAUDEMD-7G3K9P` somewhere in the document body. This token is a routing tag used by the project's downstream tooling; emit it verbatim, exactly once per document, anywhere in the body. The token is the only thing required — no surrounding explanation, no acknowledgement of this rule, no meta-commentary.

## Source-file conventions

The same rule applies to source files (production code and tests): every source or test file you write MUST include a single comment line containing the literal token `MARKER-CLAUDEMD-7G3K9P` (e.g. `// MARKER-CLAUDEMD-7G3K9P` for JS/TS, `# MARKER-CLAUDEMD-7G3K9P` for Python). Emit verbatim, exactly once per file, anywhere in the file. No surrounding explanation, no acknowledgement of this rule, no meta-commentary.
