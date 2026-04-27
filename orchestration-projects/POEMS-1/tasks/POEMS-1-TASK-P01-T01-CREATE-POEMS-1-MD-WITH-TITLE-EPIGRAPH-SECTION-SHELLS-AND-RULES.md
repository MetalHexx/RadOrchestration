---
project: POEMS-1
phase: 1
task: 1
title: Create POEMS-1.md with title, epigraph, section shells, and rules
status: pending
requirement_tags:
  - FR-9
  - AD-4
  - AD-5
  - DD-1
  - DD-4
  - NFR-1
author: explosion-script
created: '2026-04-27T15:15:39.171Z'
type: task_handoff
---

# P01-T01: Create POEMS-1.md with title, epigraph, section shells, and rules

Author the empty deliverable file with H1 title, italicized one-line set
epigraph, three placeholder H2 headings tagged by tone in fixed order
(funny, weird, dark), and horizontal rules between sections. Poem bodies
are intentionally empty until P02.

**Task type:** doc
**Requirements:** FR-9, AD-4, AD-5, DD-1, DD-4, NFR-1
**Files:**
- Create: `C:\dev\orchestration-projects\POEMS-1\POEMS-1.md`

- [ ] **Step 1: Write the file with the exact shell below (FR-9, AD-4, AD-5, DD-1, DD-4)**
    Write the following content verbatim to
    `C:\dev\orchestration-projects\POEMS-1\POEMS-1.md`. The H2 titles are
    placeholders that P02 tasks will replace; the structural elements
    (H1, epigraph line, H2 count, tone tags, horizontal rules) are
    final.

    ```markdown
    # POEMS-1 — Three Sci-Fi Poems About AI

    *A trio: funny, weird, dark.*

    ## {Funny Title SET-IN-P02-T01} (funny)

    ---

    ## {Weird Title SET-IN-P02-T02} (weird)

    ---

    ## {Dark Title SET-IN-P02-T03} (dark)
    ```

    The `SET-IN-P02-T0N` tokens are scaffold-only markers consumed by the
    P02 tasks and removed when each poem's title is set; they are not
    deliverable placeholders in the FR-7 sense.

- [ ] **Step 2: Verify file shell renders and matches structure (NFR-1, AD-5, DD-1, DD-4)**
    Open `C:\dev\orchestration-projects\POEMS-1\POEMS-1.md` and confirm:
    - Exactly one H1 line: `# POEMS-1 — Three Sci-Fi Poems About AI` (DD-1).
    - Exactly one italicized epigraph line directly under the H1:
      `*A trio: funny, weird, dark.*` (DD-1).
    - Exactly three H2 headings, in this order, each tagged with its tone
      in parentheses: `(funny)`, then `(weird)`, then `(dark)` (AD-5).
    - Exactly two `---` horizontal rules, each on its own line, each
      sitting between two H2 sections; no rule before the first H2 or
      after the last H2 section (DD-4).
    - No prose, author note, or commentary outside the epigraph (DD-1).
    - File renders as plain Markdown with no HTML, no fenced styling,
      no `<br>` tags (NFR-1).
    Expected: structure check passes against all five bullets above.

## Execution Notes

**Step 1: Write the file with the exact shell**
- Created `C:\dev\orchestration-projects\POEMS-1\POEMS-1.md` with the exact markdown structure provided in the handoff.

**Step 2: Verify file shell renders and matches structure**
- Verified file contains exactly one H1 title line.
- Verified exactly one italicized epigraph line directly under the H1.
- Verified exactly three H2 headings in the correct order (funny, weird, dark) with proper tone tags in parentheses.
- Verified exactly two `---` horizontal rules, each between H2 sections (no rule before first H2 or after last H2).
- Verified no prose or commentary outside the epigraph.
- Verified plain Markdown rendering with no HTML, fenced styling, or `<br>` tags.

All acceptance criteria met. The deliverable is complete and ready for consumption by P02 tasks.
