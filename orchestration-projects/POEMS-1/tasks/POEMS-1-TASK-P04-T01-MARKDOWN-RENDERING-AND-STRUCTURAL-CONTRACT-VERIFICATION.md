---
project: POEMS-1
phase: 4
task: 1
title: Markdown rendering and structural contract verification
status: pending
requirement_tags:
  - FR-9
  - NFR-1
  - AD-4
  - AD-5
  - DD-1
  - DD-2
  - DD-4
author: explosion-script
created: '2026-04-27T15:15:39.171Z'
type: task_handoff
---

# P04-T01: Markdown rendering and structural contract verification

Verify the deliverable file at the document level: file location, file
extension, H1 + epigraph shape, H2 count and tone tags, horizontal-rule
placement, stanza-break formatting, and clean plain-Markdown rendering
with no HTML or custom styling required.

**Task type:** doc
**Requirements:** FR-9, NFR-1, AD-4, AD-5, DD-1, DD-2, DD-4
**Files:**
- Modify: `C:\dev\orchestration-projects\POEMS-1\POEMS-1.md` (only if a structural defect is found; otherwise read-only)

- [ ] **Step 1: Verify file location and singularity (FR-9, AD-4)**
    Confirm the deliverable file exists at exactly
    `C:\dev\orchestration-projects\POEMS-1\POEMS-1.md`. Confirm there are
    no auxiliary text files, no per-poem split files, and no non-text
    companion assets in the project directory beyond the requirements,
    brainstorming, and master plan documents themselves (FR-9, AD-4).
    Expected: exactly one deliverable file at the named path; no
    companion assets.

- [ ] **Step 2: Verify document-shape contract (DD-1, AD-5, DD-4)**
    Open the file and confirm:
    - First non-blank line is the H1: `# POEMS-1 — Three Sci-Fi Poems
      About AI` (DD-1).
    - Next non-blank line is the italicized one-line epigraph naming the
      trio as funny / weird / dark; no prose intro or author note follows
      it (DD-1).
    - Exactly three H2 headings appear, in this order: `(funny)`, then
      `(weird)`, then `(dark)`; each title is 1–4 words and no scaffold
      `SET-IN-P02` markers remain (AD-5).
    - Exactly two `---` horizontal rules, each on its own line, each
      between adjacent H2 sections; no rule before the first H2 or after
      the last poem's final line (DD-4).
    Expected: every bullet checks. If any fails, fix in place and re-run
    this step.

- [ ] **Step 3: Verify stanza-break formatting and clean Markdown rendering (NFR-1, DD-2)**
    Scan the file for non-conforming separators or rendering hazards:
    - Stanza breaks within a poem are single blank lines only — no `<br>`,
      no `---` inside a poem (the only `---` rules are the two between
      poem sections), no decorative separator characters (DD-2).
    - No HTML tags anywhere in the file (NFR-1).
    - No fenced code blocks wrapping poem text (a fenced block is allowed
      only if a poem requires preserved leading-space indentation that
      standard Markdown cannot carry — confirm no such block exists
      gratuitously) (DD-2, NFR-1).
    - No reliance on custom CSS or rendering extensions; the file would
      read correctly in any standard Markdown viewer (NFR-1).
    Expected: every bullet checks. If any fails, fix in place and re-run
    this step.
