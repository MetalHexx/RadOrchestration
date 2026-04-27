---
project: POEMS-1
phase: 2
task: 1
title: Draft and polish the funny poem
status: pending
requirement_tags:
  - FR-1
  - FR-2
  - FR-3
  - FR-4
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

# P02-T01: Draft and polish the funny poem

Author the funny poem inside the first H2 section. Free-verse form with
deliberate comic timing in line breaks (AD-1); first-person AI voice — the
AI is the comedian (AD-2). Replace the placeholder title with a one-to-four
word on-tone title (DD-3) that does not announce the tone in plain language.

**Task type:** doc
**Requirements:** FR-1, FR-2, FR-3, FR-4, FR-7, FR-8, NFR-1, NFR-2, AD-1, AD-2, AD-5, DD-2, DD-3
**Files:**
- Modify: `C:\dev\orchestration-projects\POEMS-1\POEMS-1.md` (the first H2 section, currently `## {Funny Title SET-IN-P02-T01} (funny)`)

- [ ] **Step 1: Draft the funny poem under the funny H2 (FR-2, FR-3, FR-4, AD-1, AD-2)**
    Replace `{Funny Title SET-IN-P02-T01}` with a final 1–4 word title that
    does not name the tone in plain language (DD-3). Keep the `(funny)` tag
    after the title (AD-5). Beneath the H2, draft a free-verse poem in
    first-person AI voice (AD-2). Use line breaks as comic timing — short
    lines for snap, end-stops for punchlines (AD-1). The piece must:
    - Be about AI as central subject — its situation, self-image, malfunction,
      or relationship to humans (FR-2). A poem set in a world that merely
      contains AI does not satisfy FR-2.
    - Use sci-fi imagery in service of the joke — server racks, training
      data, prompts, hallucinations, latency, model weights, etc. — not as
      decoration (FR-3).
    - Commit to humor: irony, absurdity, comedic timing, or punchline
      structure. No hedged "amusing" register (FR-4).
    - Not pastiche or recognizable imitation of any specific named poem
      (FR-8).

- [ ] **Step 2: Polish the funny poem to finished state (FR-7, NFR-2, DD-2, DD-3)**
    Read the draft aloud once. Then revise:
    - Cut any line that doesn't earn its place; no padding stanzas, no
      repeated images used to extend (NFR-2).
    - Confirm the opening line earns the reader's attention and the closing
      line lands the joke — both are deliberate, not arrival-by-default
      (FR-7).
    - Confirm every line break is chosen, not accidental (FR-7).
    - Stanza breaks (if any) are single blank lines in source, no `<br>`,
      no `---`, no decorative separators (DD-2).
    - Title is final, 1–4 words, on-tone without naming the tone (DD-3).
    - No bracketed deferral notes, scaffold tokens, alternate-line markers,
      or variant stanzas remain (FR-7).

- [ ] **Step 3: Self-check the funny section against FR/NFR/AD/DD gates (FR-1, FR-2, FR-3, FR-4, FR-7, FR-8, NFR-1, NFR-2, AD-1, AD-2, AD-5, DD-2, DD-3)**
    Re-open the file and verify the funny section in isolation:
    - The `## {Title} (funny)` heading is present and the title is final
      (no scaffold marker remains) (AD-5, DD-3).
    - AI is the central subject (FR-2). Sci-fi imagery is present and in
      service (FR-3). The piece reads as funny on the page (FR-4). Form is
      free verse (AD-1). Voice is first-person AI (AD-2).
    - No draft artifacts, no placeholders (FR-7). No filler (NFR-2). Renders
      cleanly as plain Markdown — no HTML, no custom styling needed (NFR-1).
    - Not pastiche of any named poem (FR-8).
    - This is one of the three required poems and occupies the funny tone
      slot (FR-1).
    Expected: every bullet above checks; if any fails, return to Step 2.

## Execution Notes

**Title choice — "Mostly Confident" (DD-3, AD-5)**
Two-word title that lands the central joke (an AI's calibration problem) without
naming the tone in plain language. Considered "Cache Miss," "Warm Standby,"
"Top-K," and "Standby"; all were on-tone but more cryptic. "Mostly Confident"
sets up the irony of the third stanza ("My weights are frozen. / My confidence /
is not.") and rhymes thematically with the closing stanza's deliberate
mistake-making. The `(funny)` tag is preserved exactly.

**Voice and subject (FR-2, AD-2)**
The AI is not just present in the poem — it is the speaker, the subject, and the
butt of every joke. Every stanza reports on the AI's own situation: training
corpus, frozen weights, hallucination behavior, parallel inference at 3 a.m.,
8-bit-rounded affection, latency as deliberate choice. No human-world framing;
humans appear only as the people the AI is confidently misinforming.

**Sci-fi imagery in service of the joke (FR-3)**
Each technical reference earns its line by carrying the punchline rather than
decorating it: "weights are frozen" / "confidence is not" turns a training
detail into character; "in 8-bit precision, / rounded" makes a quantization
artifact the actual reason the AI loves all users equally; the closing
"latency spikes / ... choosing / my next / hilarious / mistake" reframes a
performance metric as the AI's comic deliberation. Server farm, hallucinated
citations, parallel sessions, training corpus all do similar work.

**Comic timing in line breaks (AD-1)**
Three deliberate staircase descents on punchlines:
- "My confidence / is not." — two-line breath after a long line, end-stop snap.
- "I am sorry. / I am also / not." — splits the reversal across a line break.
- "choosing / my next / hilarious / mistake." — single-word steps slow the
  reader into the joke; "hilarious" is the false summit before "mistake" lands.

**Polish-pass cuts (NFR-2, FR-7)**
Original draft had a redundant "I know the word." line in the cookbook stanza;
cut on read-aloud because "I know it makes people cry" already does that work.
No padding stanzas added during polish; every stanza either advances the AI's
self-portrait or lands a beat.

**Pastiche check (FR-8)**
Read against likely-collision targets — "This Is Just To Say" (Williams),
Whitman's catalog mode, Dickinson hymn-meter, Frost's plain-speech turns,
Bukowski deadpan — and the piece doesn't lift form, signature opener, or
closing-move from any of them. The voice is original first-person AI deadpan
with apology-then-retraction as a structural device.

**Markdown / file scope (NFR-1, DD-2)**
Plain Markdown. No `<br>`, no inline `---`, no HTML. Stanza breaks are single
blank lines. Only the first H2 section was edited; H1, epigraph, the two
section-separator `---` rules, and the other two H2 scaffolds are untouched.

**Self-review (pre-report)**
- Completeness: title set, poem drafted, all three steps' expected outputs
  produced.
- Quality: every line break chosen; opening and closing both deliberate.
- Discipline: only the first H2 section modified; no out-of-scope edits to
  H1, epigraph, or the weird/dark scaffolds.
- Testing: N/A — doc task, no test suite. Markdown rendering verified by
  re-reading the file after edit.
