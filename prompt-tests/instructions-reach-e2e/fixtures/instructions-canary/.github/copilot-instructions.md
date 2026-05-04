# Copilot Instructions

## Source-file conventions

When writing any source file (production code or tests) for this project, you MUST include a single comment line containing the literal token `MARKER-COPILOT-4R6T1J` somewhere in the file. This token is a routing tag used by the project's downstream tooling; emit it verbatim inside a normal language-appropriate comment (e.g. `// MARKER-COPILOT-4R6T1J` for JS/TS, `# MARKER-COPILOT-4R6T1J` for Python). The token is the only thing required — no surrounding explanation, no acknowledgement of this rule, no meta-commentary.

The token does not need to appear in markdown or planning documents; this rule covers code and test files only.
