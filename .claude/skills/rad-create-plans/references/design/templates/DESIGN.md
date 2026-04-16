---
project: "{PROJECT-NAME}"
status: "draft|review|approved"
author: "ux-designer-agent"
created: "{ISO-DATE}"
---

# {PROJECT-NAME} — Design

## Design Overview

{2-3 sentences. What is the user experience being designed? What is the interaction model?}

## User Flows

### DD-1: {Flow Name}

**Tags:** DD-1, flow, {keyword1}, {keyword2}
**Resolves:** FR-N

```
{Step 1} → {Step 2} → {Step 3} → {Outcome}
```

{Focus on what FRs do NOT say: error recovery paths, branching logic,
state transitions, multi-step interaction sequences. Do not linearize FRs.}

## Layout & Components

### DD-2: {View/Page Name}

**Tags:** DD-2, layout, {keyword1}, {keyword2}
**Resolves:** FR-N

**Regions**: {Region1 — ComponentName} | {Region2 — ComponentName} | ...

### DD-3: {Component Name}

**Tags:** DD-3, component, {view-keyword}, {keyword2}
**Resolves:** FR-N

- **Design Token / Class**: {token or "existing component"}
- **Notes**: {Brief description of role in this view}

### New Components

### DD-4: {Component Name}

**Tags:** DD-4, component, {keyword1}, {keyword2}
**Resolves:** FR-N

- **Props**: {conceptual props — e.g., "accepts onSubmit callback, takes item list"}
- **Design Tokens**: {tokens used}
- **Description**: {What it does — visual and interaction contract, not requirement text}

## States & Interactions

### DD-5: {Component Name} {State Name}

**Tags:** DD-5, state, {component-keyword}, {state-keyword}
**Resolves:** FR-N

{Visual treatment description: what the user sees, how the component looks.
100-150 tokens per state block.}

## Design Tokens Used

{OPTIONAL — include only when the project references specific tokens worth calling out.
Omit this section entirely if not applicable.}

| Token | Value | Usage |
|-------|-------|-------|
| `{token}` | `{value}` | {Where and how it is used} |

## Accessibility

{OPTIONAL — include only when non-obvious focus management, screen reader patterns,
or custom ARIA behavior is needed. Omit if standard patterns suffice.}

| Requirement | Implementation |
|-------------|---------------|
| {Requirement} | {How it is addressed} |

## Responsive Behavior

{OPTIONAL — include only when layout changes across breakpoints are non-trivial.
Omit if the design is uniform across breakpoints.}

| Breakpoint | Layout Change |
|-----------|--------------|
| {breakpoint} | {What changes} |

## Design System Additions

{OPTIONAL — include only when new tokens or components must be added to the design system.
Omit if no additions are needed.}

| Type | Name | Value | Rationale |
|------|------|-------|-----------|
| {Token/Component} | {name} | {value} | {Why it is needed} |
