---
project: "POEMS-1"
type: requirements
status: "draft"
approved_at: null
created: "2026-04-27"
requirement_count: 20
author: "planner-agent"
---

# POEMS-1 — Requirements

POEMS-1 is a small creative-writing deliverable: three original sci-fi poems
about Artificial Intelligence, gathered as a deliberate tonal trio — one
funny, one weird, one dark. The set is for a reader who wants AI poetry that
shows range across a single sitting, not a chapbook and not a single mood
stretched thin.

Success is three finished poems that read well on the page, hold their
assigned tone without hedging, and sit together in one document as a coherent
set unified by subject (AI) and genre (sci-fi). The artifact is the document
itself — no companion media, no further development.

## Goals

- Produce three original poems, each about Artificial Intelligence
- Commit to the funny / weird / dark tonal split — one poem per tone, no overlap
- Use sci-fi imagery and setting in service of the AI subject in each piece
- Deliver finished, edited poems — not drafts or sketches
- Ship the trio as a single, well-formed text document

## Non-Goals

- Connecting narrative arc across the three poems
- Shared world, recurring character, or recurring motif imposed on the set
- Illustration, audio, performance, or any non-text treatment
- Fixed form constraints (haiku, sonnet, page count) imposed across the trio
- Additional poems beyond the three (alternates, drafts, a fourth)
- Non-AI sci-fi themes (aliens, space travel, time travel) as the central subject

## Functional Requirements

### FR-1: Three poems, one per tone
**Tags:** FR-1, scope, tonal-trio

The deliverable contains exactly three poems. Each poem is assigned exactly
one tone from the set {funny, weird, dark}, with no tone repeated and no tone
omitted. The trio is the unit; fewer than three or more than three is not the
deliverable.

### FR-2: AI is the central subject of every poem
**Tags:** FR-2, subject, ai

Every poem is about Artificial Intelligence — AI is the central concern of
the piece, not background scenery. A poem set in a world that merely contains
AI does not satisfy this requirement; the AI itself (its mind, its making,
its situation, its effect on a witness) must carry the poem.

### FR-3: Sci-fi framing in every poem
**Tags:** FR-3, genre, sci-fi

Each poem uses sci-fi imagery, setting, or vocabulary in service of the AI
subject. The genre supplies the texture — circuitry, data, satellites, lab,
deep-space, neural lattice, etc. — but never substitutes for the subject. A
poem reading as pure mainstream verse with the word "AI" inserted does not
satisfy this requirement.

### FR-4: The funny poem is actually funny
**Tags:** FR-4, tone, funny

The funny poem produces humor on the page — irony, absurdity, comedic timing,
or punchline structure. Hedged or mildly amusing content does not satisfy
this requirement; the piece must commit to the comic register.

### FR-5: The weird poem is genuinely strange
**Tags:** FR-5, tone, weird

The weird poem is genuinely uncanny or estranging — disjointed logic,
unusual imagery, dislocated voice, or surreal procedure. "Slightly off" does
not satisfy this requirement; the piece must commit to strangeness.

### FR-6: The dark poem is actually dark
**Tags:** FR-6, tone, dark

The dark poem occupies a heavy emotional register — dread, grief, menace,
loss of agency, or extinction. Tonal hedging or a redemptive turn at the end
does not satisfy this requirement; the piece must commit to the dark register
through its final line.

### FR-7: Each poem is finished, not drafted
**Tags:** FR-7, polish, editing

Each poem is delivered as a finished piece: line breaks chosen deliberately,
word choices considered, opening and closing lines deliberate. Visible draft
artifacts (placeholder phrasing, alternate-line markers, "[fix later]"
annotations, multiple variant stanzas) are not allowed in the deliverable.

### FR-8: Originality
**Tags:** FR-8, originality

Each poem is written from scratch. No poem is a pastiche, parody, or
recognizable imitation of a specific identifiable existing work. Generic
genre tropes and shared sci-fi vocabulary are fine; line-level borrowing or
structural mimicry of a named poem is not.

### FR-9: Single-document delivery
**Tags:** FR-9, delivery, document

The three poems are delivered as text in a single Markdown document at the
project root. The file is the artifact — there are no auxiliary text files,
no separate per-poem files, and no non-text companion assets.

## Non-Functional Requirements

### NFR-1: Readable on the page
**Tags:** NFR-1, readability

The document renders cleanly as plain Markdown. Each poem's line breaks,
indentation, and stanza breaks survive in any standard Markdown viewer
without requiring special rendering, custom CSS, or HTML embedding. Poems
that depend on rendered styling to read correctly do not satisfy this
requirement.

### NFR-2: No filler
**Tags:** NFR-2, density

Each poem earns every line. No connective filler stanzas, no padding to hit
a perceived length, no repeated images used to extend the piece. Length is
determined by what the poem needs, not by a target.

## Architectural Decisions

### AD-1: Form, length, and meter chosen per poem
**Tags:** AD-1, form, per-poem-decision
**Resolves:** FR-1, FR-4, FR-5, FR-6

Form is decided per piece to amplify its assigned tone, not imposed across
the trio. The funny poem uses free verse with deliberate comic timing in line
breaks. The weird poem uses a prose-poem or hybrid form whose dislocated
shape itself contributes to the strangeness. The dark poem uses tight,
short-lined metered verse — compression intensifies dread. Length follows
form; no fixed line or stanza count is imposed.

### AD-2: Voice/perspective chosen per poem
**Tags:** AD-2, voice, per-poem-decision
**Resolves:** FR-4, FR-5, FR-6

Voice is decided per piece to reinforce the tonal contrast across the trio.
The funny poem is in first-person AI voice (the AI is the comedian). The
weird poem is in a detached, observational, near-omniscient voice (the AI is
witnessed, not heard). The dark poem is in second-person address (a voice
speaking *to* an AI, or an AI speaking *to* a human) to put the reader inside
the dread. Mixing voices across the trio is the point — it sharpens the
contrast.

### AD-3: No shared world or recurring motif
**Tags:** AD-3, cohesion, no-shared-world
**Resolves:** FR-1

The three poems do not share a setting, character, named system, or recurring
image. Cohesion is supplied by subject (AI), genre (sci-fi), and the tonal
trio structure — that is sufficient. A motif may emerge naturally during
writing, but none is engineered. If a recurring image surfaces in two poems
during drafting and removing it weakens both, it stays; otherwise it is
trimmed.

### AD-4: Single Markdown file at project root
**Tags:** AD-4, file, markdown
**Resolves:** FR-9

The deliverable file is `POEMS-1.md` at the project root
(`C:\dev\orchestration-projects\POEMS-1\POEMS-1.md`). Markdown is chosen for
plain-text portability and clean rendering of stanza breaks via blank lines.
No frontmatter is required on the deliverable file — the requirements
document carries project metadata; the poems file carries poems.

### AD-5: Each poem is its own H2 section
**Tags:** AD-5, structure, headings
**Resolves:** FR-9, FR-1

Within the deliverable file, each poem is introduced by an H2 heading naming
the poem and parenthetically tagging its tone, e.g.
`## {Title} (funny)`. The three sections appear in fixed order: funny, then
weird, then dark — this gives the reader an arc from light into heavy without
implying a narrative.

## Design Decisions

### DD-1: Document opens with a one-line set epigraph
**Tags:** DD-1, document-shape, epigraph
**Resolves:** FR-9

The deliverable file opens with an H1 title (`# POEMS-1 — Three Sci-Fi Poems
About AI`) followed by a single italicized line naming the trio as "funny,
weird, dark." No prose introduction, no author note, no commentary on the
poems. The reader meets the frame in one line and then meets the work.

### DD-2: Stanza breaks via blank lines only
**Tags:** DD-2, formatting, stanzas
**Resolves:** NFR-1

Stanza breaks within each poem are rendered as a single blank line in
Markdown source. No horizontal rules, no decorative separators, no `<br>`
tags. Indented lines (where used) use leading spaces preserved inside a
fenced block only if standard Markdown indentation cannot carry the visual
shape.

### DD-3: Poem titles are short and on-tone
**Tags:** DD-3, titles

Each poem has a title of one to four words, set by the H2 heading. The title
gestures at the piece without explaining it; titles do not announce the tone
in plain language (the tone tag in parentheses does that). Titles do not
share a naming pattern across the trio — pattern would imply a sequence the
trio explicitly rejects.

### DD-4: Sections separated by horizontal rules
**Tags:** DD-4, document-shape, separators
**Resolves:** AD-5

Between the three poem sections, a Markdown horizontal rule (`---`) on its
own line separates each poem from the next. The rule appears after the last
line of one poem and before the H2 of the next. There is no rule before the
first poem or after the last.
