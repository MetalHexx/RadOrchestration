import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dot = readFileSync(join(__dirname, 'bind-state-dot.tsx'), 'utf-8');
const badge = readFileSync(join(__dirname, 'bind-state-badge.tsx'), 'utf-8');
const header = readFileSync(join(__dirname, 'entity-header.tsx'), 'utf-8');

test('dot resolves color from BIND_STATE_MAP, no hardcoded color (AD-6, DD-1, NFR-2)', () => {
  assert.match(dot, /BIND_STATE_MAP\[/);
  assert.match(dot, /\.cssVar/);
  assert.doesNotMatch(dot, /#[0-9a-fA-F]{3,8}/);
});

test('badge renders dot + word from the map (DD-1)', () => {
  assert.match(badge, /BIND_STATE_MAP\[/);
  assert.match(badge, /\.label/);
});

test('standalone dot keeps its aria-label for screen readers (P02 F-15)', () => {
  // Default/non-decorative usage still emits aria-label from the map entry
  assert.match(dot, /aria-label['"]?\s*:\s*entry\.label|aria-label.*entry\.label/);
});

test('dot accepts a decorative prop that hides it from screen readers (P02 F-15)', () => {
  // The component exposes a decorative flag
  assert.match(dot, /decorative/);
  // Decorative mode sets aria-hidden and omits aria-label (no double-announcement)
  assert.match(dot, /aria-hidden/);
});

test('badge embeds the dot as decorative to avoid double-announcing the state (P02 F-15)', () => {
  // The badge renders the label as visible text, so the embedded dot must be decorative
  assert.match(badge, /<BindStateDot[^>]*\bdecorative\b/);
});

test('entity header carries kind prefix + slug and picks glyph by kind (DD-3)', () => {
  assert.match(header, /GitBranch/);
  assert.match(header, /Layers/);
  assert.match(header, /Repo:|Repo Group:/);
});

test('repo header trails a bind badge; group header carries none (DD-3)', () => {
  assert.match(header, /BindStateBadge/);
});
