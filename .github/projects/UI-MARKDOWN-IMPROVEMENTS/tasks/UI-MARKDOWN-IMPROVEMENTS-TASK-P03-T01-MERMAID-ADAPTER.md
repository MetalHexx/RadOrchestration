---
project: "UI-MARKDOWN-IMPROVEMENTS"
phase: 3
task: 1
title: "MERMAID-ADAPTER"
status: "pending"
skills_required: ["run-tests"]
skills_optional: []
estimated_files: 2
---

# Install Mermaid and Create Adapter Module

## Objective

Install the `mermaid` npm package and create `ui/lib/mermaid-adapter.ts` — a singleton adapter module that dynamically imports mermaid on first use and exposes three functions (`initMermaid`, `renderDiagram`, `updateTheme`) to isolate the mermaid library API from React components.

## Context

The project uses a library adapter pattern established by `ui/lib/shiki-adapter.ts` — infrastructure modules abstract third-party library configuration so components never touch the library API directly. The mermaid adapter follows this same pattern. Mermaid accesses the DOM directly (`document`, `window`), so it must never be imported at the top level or during SSR — it must be dynamically imported via `import('mermaid')` inside the adapter functions. The adapter is consumed by a `MermaidBlock` component (built in the next task, T02) that calls these functions inside `useEffect`.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `ui/package.json` | Add `mermaid` to `dependencies` |
| CREATE | `ui/lib/mermaid-adapter.ts` | Singleton adapter with three exported async functions |

## Implementation Steps

1. **Install mermaid**: Run `npm install mermaid` in the `ui/` directory. Verify `mermaid` appears in `package.json` under `dependencies`.

2. **Create `ui/lib/mermaid-adapter.ts`**: Create the file with three module-level variables for singleton state:
   - `mermaidInstance`: holds the dynamically imported mermaid default export (initially `null`)
   - `initialized`: boolean flag tracking whether `mermaid.initialize()` has been called (initially `false`)
   - `currentTheme`: tracks the last theme passed to `initialize()` (initially `null`)

3. **Implement theme mapping helper**: Create a private function `getMermaidTheme(theme: 'dark' | 'light'): string` that maps:
   - `'dark'` → `'dark'`
   - `'light'` → `'default'`

4. **Implement `initMermaid(theme)`**: 
   - If `initialized` is `true` and `currentTheme` equals `theme`, return early (no-op)
   - Dynamically import mermaid: `const { default: mermaid } = await import('mermaid')`
   - Store the import in `mermaidInstance`
   - Call `mermaid.initialize({ startOnLoad: false, theme: getMermaidTheme(theme) })`
   - Set `initialized = true` and `currentTheme = theme`

5. **Implement `renderDiagram(id, code)`**:
   - If `mermaidInstance` is `null`, throw an error (`"Mermaid not initialized. Call initMermaid() first."`)
   - Call `const { svg } = await mermaidInstance.render(id, code)`
   - Return the `svg` string
   - Let mermaid parse/render errors propagate (the component handles them)

6. **Implement `updateTheme(theme)`**:
   - If `currentTheme` equals `theme`, return early (no-op)
   - Set `initialized = false` (forces re-initialization on next `initMermaid` call)
   - Call `await initMermaid(theme)` to re-initialize with the new theme

7. **Export all three functions**: Use named exports — `export { initMermaid, renderDiagram, updateTheme }`

8. **Verify no top-level mermaid import**: Confirm the file has zero `import mermaid` or `import { ... } from 'mermaid'` statements at the module level. The only import is the dynamic `import('mermaid')` inside `initMermaid`.

## Contracts & Interfaces

The adapter must export exactly these three functions with these signatures:

```typescript
// ui/lib/mermaid-adapter.ts

/**
 * Initialize mermaid with the given theme. Safe to call multiple times —
 * re-initializes if theme has changed, no-op otherwise.
 * Dynamically imports the mermaid library on first call.
 *
 * @param theme - 'dark' or 'light' (maps to mermaid's 'dark' / 'default' themes)
 */
export async function initMermaid(theme: 'dark' | 'light'): Promise<void>;

/**
 * Render a mermaid diagram and return the SVG markup.
 *
 * @param id - Unique element ID for the render container
 * @param code - Raw mermaid source code
 * @returns SVG markup string
 * @throws If mermaid fails to parse or render the diagram
 */
export async function renderDiagram(id: string, code: string): Promise<string>;

/**
 * Update the mermaid theme. Call when the user toggles dark/light.
 * Subsequent renderDiagram calls will use the new theme.
 *
 * @param theme - 'dark' or 'light'
 */
export async function updateTheme(theme: 'dark' | 'light'): Promise<void>;
```

### Singleton State (module-level, not exported)

```typescript
let mermaidInstance: typeof import('mermaid').default | null = null;
let initialized = false;
let currentTheme: 'dark' | 'light' | null = null;
```

### Theme Mapping (private helper)

```typescript
function getMermaidTheme(theme: 'dark' | 'light'): string {
  return theme === 'dark' ? 'dark' : 'default';
}
```

### Mermaid Initialize Call Shape

```typescript
mermaid.initialize({
  startOnLoad: false,
  theme: getMermaidTheme(theme),
});
```

- `startOnLoad: false` — prevents mermaid from scanning the DOM on import (rendering is explicit via `renderDiagram`)
- `theme` — `'dark'` for dark mode, `'default'` for light mode

### Mermaid Render Call Shape

```typescript
const { svg } = await mermaid.render(id, code);
// svg is an SVG markup string
```

## Styles & Design Tokens

No styles or design tokens apply to this task. The adapter is a pure infrastructure module with no visual output. The consuming `MermaidBlock` component (T02) handles all visual concerns.

## Test Requirements

- [ ] `mermaid` is listed in `ui/package.json` `dependencies`
- [ ] `ui/lib/mermaid-adapter.ts` exports `initMermaid`, `renderDiagram`, and `updateTheme` as named exports
- [ ] No top-level `import` of `mermaid` exists in the adapter file — only dynamic `import('mermaid')` inside function bodies
- [ ] `initMermaid('light')` calls `mermaid.initialize` with `{ startOnLoad: false, theme: 'default' }`
- [ ] `initMermaid('dark')` calls `mermaid.initialize` with `{ startOnLoad: false, theme: 'dark' }`
- [ ] Calling `initMermaid('light')` twice in a row only initializes once (idempotent)
- [ ] `renderDiagram` throws if called before `initMermaid`
- [ ] `updateTheme('dark')` after `initMermaid('light')` causes re-initialization with the dark theme
- [ ] `updateTheme('light')` when already on `'light'` is a no-op

## Acceptance Criteria

- [ ] `mermaid` package is installed and listed in `ui/package.json` `dependencies`
- [ ] `ui/lib/mermaid-adapter.ts` exists and exports exactly three named functions: `initMermaid`, `renderDiagram`, `updateTheme`
- [ ] The adapter has zero top-level `import` statements referencing `mermaid` — dynamic import only
- [ ] `initMermaid` is idempotent: same theme → no-op; different theme → re-initializes
- [ ] Theme mapping is correct: `'light'` → mermaid `'default'`, `'dark'` → mermaid `'dark'`
- [ ] `mermaid.initialize()` is called with `startOnLoad: false`
- [ ] `renderDiagram` returns an SVG string from `mermaid.render()`
- [ ] `renderDiagram` throws if mermaid is not initialized
- [ ] `updateTheme` triggers re-initialization with the new theme
- [ ] Module-level singleton pattern: `mermaidInstance`, `initialized`, `currentTheme` are private (not exported)
- [ ] All tests pass
- [ ] Build succeeds (`npm run build` in `ui/` — zero errors)
- [ ] No lint errors

## Constraints

- Do NOT import mermaid at the top level — dynamic `import('mermaid')` only, inside function bodies
- Do NOT add any React dependencies (no hooks, no JSX) — this is a pure TypeScript infrastructure module
- Do NOT create a React component — that is Task T02
- Do NOT modify `ui/lib/shiki-adapter.ts` — the mermaid adapter is a separate module
- Do NOT add mermaid to `devDependencies` — it must be in `dependencies` (it is a runtime dependency)
- Do NOT set `startOnLoad: true` — diagram rendering is explicitly triggered via `renderDiagram`, never automatic
- Do NOT export the module-level singleton variables — only the three functions are public API
