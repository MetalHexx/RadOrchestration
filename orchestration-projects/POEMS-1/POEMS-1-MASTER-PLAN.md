---
project: "POEMS-1"
type: master_plan
status: "draft"
created: "2026-04-27"
total_phases: 4
total_tasks: 7
author: "planner-agent"
---

# POEMS-1 — Master Plan

## Introduction

POEMS-1 produces three original sci-fi poems about Artificial Intelligence,
delivered as a tonal trio (funny, weird, dark) in a single Markdown document
at the project root. The plan is built around the creative unit, not the
engineering unit: each poem gets one task that drafts and polishes it end to
end, framed by a scaffold pass at the start and two passes at the end (trio
cohesion, then final document QA).

Phase order moves from container outward to content and back to container:
build the deliverable shell first so every authoring task slots into a known
structure, write the three poems against per-poem AD/DD constraints, then
read the trio as a whole for tonal commitment and cohesion before a final
Markdown rendering and polish gate.

## P01: Scaffold the deliverable file

Create `POEMS-1.md` with its full structural shell — H1 title, italicized
epigraph, three empty H2 poem sections in fixed order, and the two
horizontal rules between them. Authoring tasks in P02 fill the body of each
section without touching surrounding structure.

**Requirements:** FR-9, AD-4, AD-5, DD-1, DD-4, NFR-1

**Execution order:**
    T01

### P01-T01: Create POEMS-1.md with title, epigraph, section shells, and rules

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

## P02: Draft and polish each poem

Three independent authoring tasks, one per tone. Each task drafts and
polishes its assigned poem to finished state inside its scaffolded H2
section, honoring the per-poem AD-1 form constraint and AD-2 voice
constraint. Tasks within this phase do not depend on each other and may be
executed in parallel; the only ordering is that each must follow P01.

**Requirements:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-8, NFR-1, NFR-2, AD-1, AD-2, AD-5, DD-2, DD-3

**Execution order:**
    T01 (depends on P01-T01)
    T02 (depends on P01-T01)
    T03 (depends on P01-T01)

### P02-T01: Draft and polish the funny poem

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

### P02-T02: Draft and polish the weird poem

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

### P02-T03: Draft and polish the dark poem

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

## P03: Trio cohesion pass

Read the three poems together as a set. Confirm the tonal trio holds (each
poem occupies its assigned register and they are clearly distinct), no
shared world or recurring motif has been engineered across the trio, the
three titles do not share a naming pattern, and each piece earns every
line. This phase makes corrections in place; if any fail, the responsible
P02 task's polish step is re-entered as part of this task.

**Requirements:** FR-1, FR-4, FR-5, FR-6, NFR-2, AD-3, DD-3

**Execution order:**
    T01 (depends on P02-T01, P02-T02, P02-T03)

### P03-T01: Trio-level cohesion and tonal-contrast pass

Read all three poems in document order in a single sitting. Verify the
tonal split commits across the set, no shared world / recurring named
system / recurring motif has crept in (AD-3), titles do not share a
pattern (DD-3), and no filler survived (NFR-2). Make any required edits
in place in `POEMS-1.md`.

**Task type:** doc
**Requirements:** FR-1, FR-4, FR-5, FR-6, NFR-2, AD-3, DD-3
**Files:**
- Modify: `C:\dev\orchestration-projects\POEMS-1\POEMS-1.md` (any of the three poem sections, as needed)

- [ ] **Step 1: Read the trio end to end in one sitting (FR-1, FR-4, FR-5, FR-6)**
    Open `C:\dev\orchestration-projects\POEMS-1\POEMS-1.md` and read all
    three poems straight through in document order (funny → weird → dark).
    After reading, name the dominant tone you experienced from each
    section. The funny poem must read as funny (FR-4); the weird poem as
    genuinely strange (FR-5); the dark poem as committedly dark through
    its final line (FR-6). The three pieces together must read as one of
    each tone — no two read as the same poem in different costumes (FR-1).
    If any tone reads as hedged, mark the section for revision in Step 4.

- [ ] **Step 2: Audit for accidental shared world / recurring motif (AD-3)**
    Scan all three poems for shared elements that were not engineered:
    - Recurring named systems, named characters, named locations.
    - Repeated specific images (e.g. the same satellite, the same lab, the
      same model name) appearing in two or more poems.
    - A continuous setting that implies all three occur in the same world.
    Per AD-3: if a recurring image surfaces in two poems and removing it
    weakens both, it stays; otherwise it is trimmed in Step 4. Engineered
    shared worlds are never allowed.

- [ ] **Step 3: Audit titles for pattern (DD-3)**
    Compare the three titles. They must not share a naming pattern (e.g.
    all three single-word verbs, all three "The ___" constructions, all
    three using the same syntactic shape). A pattern would imply a
    sequence the trio explicitly rejects. If two or more titles share an
    obvious pattern, mark for revision in Step 4.

- [ ] **Step 4: Apply any corrections in place (FR-1, FR-4, FR-5, FR-6, NFR-2, AD-3, DD-3)**
    For each issue marked in Steps 1–3, edit the responsible section of
    `C:\dev\orchestration-projects\POEMS-1\POEMS-1.md` directly. Tonal
    miss → tighten word choice and line shape in that poem (FR-4 / FR-5 /
    FR-6 as applicable). Engineered cross-poem motif → trim from the
    weaker side (AD-3). Title pattern collision → rename the offending
    title(s) within the 1–4 word constraint (DD-3). Cut any line that
    survived P02 polish but reads as filler when seen in trio context
    (NFR-2). Re-read the trio after edits; iterate until Steps 1–3 all
    pass with no issues marked.

## P04: Final document QA

Verify the deliverable file as a whole renders cleanly, holds its
structural contract (H1, epigraph, three H2 sections in fixed order, two
horizontal rules), contains no draft artifacts, and that each poem is
original. This is the final gate before the artifact is considered
complete.

**Requirements:** FR-1, FR-7, FR-8, FR-9, NFR-1, AD-4, AD-5, DD-1, DD-2, DD-4

**Execution order:**
    T01 (depends on P03-T01)
       → T02 (depends on T01)

### P04-T01: Markdown rendering and structural contract verification

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

### P04-T02: Final polish and originality gate

Final read-through of the deliverable for FR-7 polish and FR-8 originality.
This is the last opportunity to catch a stray draft artifact, an
unintended echo of a recognizable existing poem, or a tone slip that
survived P03. After this step the artifact is complete.

**Task type:** doc
**Requirements:** FR-1, FR-7, FR-8
**Files:**
- Modify: `C:\dev\orchestration-projects\POEMS-1\POEMS-1.md` (only if a defect is found; otherwise read-only)

- [ ] **Step 1: Final FR-7 polish read (FR-7)**
    Read `C:\dev\orchestration-projects\POEMS-1\POEMS-1.md` end to end
    one final time. For each of the three poem sections, confirm:
    - No bracketed deferral notes, no inline `/`-separated alternates, and
      no variant stanzas remain (FR-7).
    - No scaffold tokens of the form `{Funny Title SET-IN-P02-T01}` /
      `{Weird Title SET-IN-P02-T02}` / `{Dark Title SET-IN-P02-T03}`
      remain anywhere in the file (FR-7).
    - Opening lines and closing lines of every poem read as deliberate
      choices, not arrival-by-default (FR-7).
    Fix any defect in place and re-read.

- [ ] **Step 2: FR-8 originality self-check (FR-8)**
    For each of the three poems, name internally any specific identifiable
    existing poem the piece could be mistaken for (line-level borrowing,
    structural mimicry of a named poem, or recognizable parody). Generic
    sci-fi vocabulary and shared genre tropes are permitted (FR-8). If any
    poem is too close to a specific named work, revise the offending
    passage in place until the resemblance is gone, then re-run Step 1
    on the revised section.

- [ ] **Step 3: Confirm trio is complete and the artifact is shippable (FR-1, FR-7, FR-8)**
    Final structural confirmation across the document:
    - Three poems present, exactly one per tone, in funny → weird → dark
      order (FR-1).
    - No draft artifacts, no scaffold markers, no placeholder phrasing
      anywhere in the file (FR-7).
    - No poem reads as imitation of a named existing work (FR-8).
    Expected: all three bullets pass. The artifact at
    `C:\dev\orchestration-projects\POEMS-1\POEMS-1.md` is complete.
