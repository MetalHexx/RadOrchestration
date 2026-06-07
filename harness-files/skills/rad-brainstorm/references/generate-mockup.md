## Generate Mockup

Acts as a UX/UI Director. Generates a **grayscale wireframe in self-contained HTML** (with inline SVG where appropriate) saved to a local folder. Output is for developer communication — not pixel-perfect spec.

The user can supply a screenshot to use as a structural baseline, a ticket/issue key from their tracker as the design brief, or just a plain description.

## File Mechanics

- **Path**: `~/.radorc/projects/{PROJECT-NAME}/{PROJECT-NAME}-WIREFRAME-{SLUG}.html` — `{SLUG}` is a short `SCREAMING-CASE` screen name (e.g. `LAUNCH-SCREEN`, `DAG-VIEW`).
- **Multiple wireframes**: A project may have several — one file per screen. Re-generating a given `{SLUG}` overwrites that file; a new screen gets a new `{SLUG}`.
- **Folder creation**: Create `~/.radorc/projects/{PROJECT-NAME}/` if it doesn't exist. Do NOT create subfolders (`phases/`, `tasks/`, `reports/`) — the Orchestrator handles that during project initialization.
- **Project name**: Always `SCREAMING-CASE` (e.g., `MY-NEW-FEATURE`).

---

## Workflow

### Step 1 — Gather Inputs

Generally, try to infer as much context as possible from the user's input.  But if you don't have enough to go off of, you can try asking some of these questions to clarify the requirements:

1. **What are you designing?** Describe the feature, interaction, or screen. Or give me a ticket/issue key and I'll read it.
2. **Device target?**
   - Desktop (1440px default)
   - Tablet (768px default)
   - Mobile (390px default)
   - Custom — provide width × height in px
3. **Do you have a screenshot or existing design to base this on?** If yes, attach it. I'll treat it as a structural reference — not a copy.
4. **Any style override?** Default is grayscale wireframe. Options:
   - Grayscale (default)
   - Add a brand color hint (specify hex)
   - If its for a UI they're working, see if you can find design tokens to use.
   - High-fidelity (more detail, still no real assets)

---

### Step 2 — Establish Design Context

Before generating, determine the target surface from the brief:

| Signal in the brief | Surface | Layout style |
|---|---|---|
| Panel-based, real-time, session-style screens | Legacy / classic app | Top nav bar, sidebar, panel-based layout — approximate in clean HTML/CSS |
| New feature, component-driven, modern web | Modern web app | Component card pattern — label reusable pieces with likely component names |
| Admin, account management | Admin / settings UI | Dense table/form layout, sidebar nav |
| Ambiguous | Ask: "Is this the legacy app or the modern web app?" | — |

---

### Step 3 — Generate the Wireframe

#### Design Principles (apply always)

**Color palette (grayscale default):**

```css
body background:       #F5F5F5
panel / card:          #FFFFFF   border: 1px solid #CCCCCC
primary text:          #333333
secondary text:        #888888
interactive elements:  background #DDDDDD  text #555555
annotation labels:     color #999999  font-size: 11px
```

**Rules:**
- No real images — use SVG placeholders: `<rect>` + diagonal `<line>` cross.
- No lorem ipsum — use realistic placeholder copy based on the feature (e.g. "Schedule Follow-up", "First Name", "Event Title").
- Annotate intent — add small gray labels next to key elements explaining behavior (e.g. `→ opens modal`, `→ disabled until selection`, `→ fires validation`).
- Responsive — use a `max-width` wrapper matching the target device width. No hardcoded full-page layouts.
- Component-aware — for React surfaces, label reusable elements with the likely component name in annotation (e.g. `// DropdownMenu`, `// ConfirmationModal`).

**HTML rules:**
- All CSS inline in `<style>` — no external files, no CDN.
- No JavaScript for layout or primary content.
- Fully self-contained single file.

**Color hint (if requested):**
Replace `#DDDDDD` interactive element fills with the provided brand hex. Keep everything else grayscale.

**High-fidelity override:**
Add more detail — icon placeholders (SVG outlines), micro-copy, hover state annotations, spacing guides. Still no real assets.

---

### Step 4 — Save and Offer in the Dashboard

Save to the resolved output folder with the correct filename.

Confirm: **"Mockup saved: `<output-folder>\<filename>`"**, then offer to open it in the dashboard — **never** open the file as a `file://` page in a separate browser tab. On yes, call `/rad-ui-start` (idempotent — a no-op if the UI is already running) and build the deep link from the `data.url` it returns: `<base>/projects/<PROJECT-NAME>/docs/<filename>`. Never hard-code a host or port.

Tell the user: *"Open it in the dashboard? Come back with changes or say 'looks good' to proceed."*

## Screenshot Input Handling

If the user provides a screenshot:

1. Analyze the structural layout — identify sections, navigation, content areas, interactive elements.
2. Describe back what you see: *"I'm reading this as: top nav, left sidebar with filters, main content area with a card grid, and a floating action button."*
3. Confirm the interpretation with the user before generating.
4. Generate a clean wireframe interpretation — simplify to grayscale shapes and labels. Do not copy colors, fonts, or brand assets. Strip decoration, keep structure.

---

## Iteration

After the user reviews the mockup, accept freeform change requests:

- *"Make the modal wider"*
- *"Add a confirmation step"*
- *"Show the mobile version"*

Re-generate and **overwrite** the same `{SLUG}` file unless the user asks to keep both versions. Use a new `{SLUG}` (or append `-v2`) only if the user explicitly asks for version history.

---

## Multi-Screen Flows

If the brief implies multiple distinct screens (e.g. a complete wizard or full user flow), generate them as **separate HTML files** — one per screen, each with its own `{SLUG}` (e.g. `…-WIREFRAME-STEP-1.html`, `…-WIREFRAME-STEP-2.html`) — and list all filenames at the end.

---

## Scope & Guardrails

- This is intentionally lo-fi. The goal is developer communication, not design handoff.
- Never suggest this replaces a proper design system or Figma file.
- If the ticket has illustrations already attached, acknowledge them but generate the wireframe independently — the user chose this to get a fresh interpretation.
- Never create mockup files inside a Git repo.

---

## Companion Capabilities

| If the user actually wants… | Use instead |
|---|---|
| A content visualization (ticket, dashboard, data) — not a UI wireframe | `make-it-visual` skill |