---
project: POEMS-1
phase: 2
task: 3
title: Draft and polish the dark poem
status: pending
requirement_tags:
  - FR-1
  - FR-2
  - FR-3
  - FR-6
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

# P02-T03: Draft and polish the dark poem

Author the dark poem inside the third H2 section. Tight, short-lined
metered verse — compression intensifies dread (AD-1); second-person address
— a voice speaking *to* an AI, or an AI speaking *to* a human, putting the
reader inside the dread (AD-2). Replace the placeholder title with a
one-to-four word on-tone title (DD-3).

**Task type:** doc
**Requirements:** FR-1, FR-2, FR-3, FR-6, FR-7, FR-8, NFR-1, NFR-2, AD-1, AD-2, AD-5, DD-2, DD-3
**Files:**
- Modify: `C:\dev\orchestration-projects\POEMS-1\POEMS-1.md` (the third H2 section, currently `## {Dark Title SET-IN-P02-T03} (dark)`)

- [ ] **Step 1: Draft the dark poem under the dark H2 (FR-2, FR-3, FR-6, AD-1, AD-2)**
    Replace `{Dark Title SET-IN-P02-T03}` with a final 1–4 word title that
    does not name the tone in plain language (DD-3). Keep the `(dark)` tag
    after the title (AD-5). Beneath the H2, draft tight, short-lined verse
    in a discernible meter — compressed lines, hard end-stops, weight in
    the consonants (AD-1). Voice is second person — either *you* the AI
    addressed by a human, or *you* the human addressed by the AI (AD-2).
    The piece must:
    - Be about AI as central subject — its menace, its grief, the loss of
      human agency in its presence, its part in extinction or surveillance
      (FR-2).
    - Use sci-fi imagery — server hum, dead satellites, surveillance feed,
      grey-goo, kill-switch, evacuated lab — in service of the dread (FR-3).
    - Commit to the dark register through the final line: dread, grief,
      menace, loss of agency, or extinction. No redemptive turn at the end,
      no comfort arc (FR-6).
    - Not pastiche or recognizable imitation of any specific named poem
      (FR-8).

- [ ] **Step 2: Polish the dark poem to finished state (FR-7, NFR-2, DD-2, DD-3)**
    Revise:
    - Cut any line that softens the register or pads for length; in tight
      metered verse, every line is load-bearing or it is gone (NFR-2).
    - Confirm the opening line establishes the heavy register immediately
      and the closing line does not lift — the dread must hold through the
      final line (FR-6, FR-7).
    - Confirm meter is consistent enough to feel deliberate; line breaks
      reinforce compression (FR-7, AD-1).
    - Stanza breaks are single blank lines in source, no `<br>`, no `---`,
      no decorative separators (DD-2).
    - Title is final, 1–4 words, on-tone without naming the tone (DD-3).
    - No bracketed deferral notes, scaffold tokens, alternate-line markers,
      or variant stanzas remain (FR-7).

- [ ] **Step 3: Self-check the dark section against FR/NFR/AD/DD gates (FR-1, FR-2, FR-3, FR-6, FR-7, FR-8, NFR-1, NFR-2, AD-1, AD-2, AD-5, DD-2, DD-3)**
    Re-open the file and verify the dark section in isolation:
    - The `## {Title} (dark)` heading is present and the title is final
      (no scaffold marker remains) (AD-5, DD-3).
    - AI is the central subject (FR-2). Sci-fi imagery is present and in
      service (FR-3). The piece commits to the dark register and the final
      line does not lift (FR-6). Form is tight short-lined metered verse
      (AD-1). Voice is second person (AD-2).
    - No draft artifacts, no placeholders (FR-7). No filler (NFR-2). Renders
      cleanly as plain Markdown (NFR-1).
    - Not pastiche of any named poem (FR-8).
    - This is one of the three required poems and occupies the dark tone
      slot (FR-1).
    Expected: every bullet above checks; if any fails, return to Step 2.
