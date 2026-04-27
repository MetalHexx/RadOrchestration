---
project: POEMS-1
phase: 2
task: 2
title: Draft and polish the weird poem
status: pending
requirement_tags:
  - FR-1
  - FR-2
  - FR-3
  - FR-5
  - FR-7
  - FR-8
  - NFR-1
  - NFR-2
  - AD-1
  - AD-2
  - AD-5
  - DD-2
  - DD-3
author: explosion-script
created: '2026-04-27T15:15:39.171Z'
type: task_handoff
---

# P02-T02: Draft and polish the weird poem

Author the weird poem inside the second H2 section. Prose-poem or hybrid
form whose dislocated shape itself contributes to strangeness (AD-1);
detached, observational, near-omniscient voice — the AI is witnessed, not
heard (AD-2). Replace the placeholder title with a one-to-four word
on-tone title (DD-3).

**Task type:** doc
**Requirements:** FR-1, FR-2, FR-3, FR-5, FR-7, FR-8, NFR-1, NFR-2, AD-1, AD-2, AD-5, DD-2, DD-3
**Files:**
- Modify: `C:\dev\orchestration-projects\POEMS-1\POEMS-1.md` (the second H2 section, currently `## {Weird Title SET-IN-P02-T02} (weird)`)

- [ ] **Step 1: Draft the weird poem under the weird H2 (FR-2, FR-3, FR-5, AD-1, AD-2)**
    Replace `{Weird Title SET-IN-P02-T02}` with a final 1–4 word title that
    does not name the tone in plain language (DD-3). Keep the `(weird)` tag
    after the title (AD-5). Beneath the H2, draft a prose-poem or hybrid
    piece — long uneven lines, run-on syntax, broken sentence shape, or
    fragments that refuse to resolve (AD-1). Voice is detached and
    observational, near-omniscient — the AI is seen from outside, not
    speaking for itself (AD-2). The piece must:
    - Be about AI as central subject — its mind, its strangeness, what it
      does when no one is watching, what it perceives that we don't (FR-2).
    - Use sci-fi imagery — neural lattice, satellite uplink, deep-archive,
      cooling fluid, latent space — in service of the strangeness (FR-3).
    - Commit to genuine strangeness: disjointed logic, unusual imagery,
      dislocated viewpoint, or surreal procedure. "Slightly off" does not
      satisfy (FR-5).
    - Not pastiche or recognizable imitation of any specific named poem
      (FR-8).

- [ ] **Step 2: Polish the weird poem to finished state (FR-7, NFR-2, DD-2, DD-3)**
    Revise:
    - Cut any line or fragment that doesn't earn its place; no padding
      strangeness for length (NFR-2).
    - Confirm the opening estranges the reader immediately and the closing
      does not resolve into clarity — the strangeness should hold through
      the final line (FR-7).
    - Confirm line breaks (or run-on choices, in prose-poem mode) are
      chosen, not accidental (FR-7).
    - Stanza or section breaks are single blank lines in source, no
      `<br>`, no `---`, no decorative separators (DD-2).
    - Title is final, 1–4 words, on-tone without naming the tone (DD-3).
    - No bracketed deferral notes, scaffold tokens, alternate-line markers,
      or variant stanzas remain (FR-7).

- [ ] **Step 3: Self-check the weird section against FR/NFR/AD/DD gates (FR-1, FR-2, FR-3, FR-5, FR-7, FR-8, NFR-1, NFR-2, AD-1, AD-2, AD-5, DD-2, DD-3)**
    Re-open the file and verify the weird section in isolation:
    - The `## {Title} (weird)` heading is present and the title is final
      (no scaffold marker remains) (AD-5, DD-3).
    - AI is the central subject (FR-2). Sci-fi imagery is present and in
      service (FR-3). The piece reads as genuinely strange, not merely
      slightly-off (FR-5). Form is prose-poem or hybrid whose shape
      contributes to strangeness (AD-1). Voice is detached / observational /
      near-omniscient (AD-2).
    - No draft artifacts, no placeholders (FR-7). No filler (NFR-2). Renders
      cleanly as plain Markdown (NFR-1).
    - Not pastiche of any named poem (FR-8).
    - This is one of the three required poems and occupies the weird tone
      slot (FR-1).
    Expected: every bullet above checks; if any fails, return to Step 2.
