import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { LIVE_TOKEN, LIVE_ACCENT_TOKEN, LIVE_COLOR, LIVE_ACCENT_COLOR } from './live-tokens';

test('exposes the lavender live token names and values', () => {
  assert.equal(LIVE_TOKEN, '--live');
  assert.equal(LIVE_ACCENT_TOKEN, '--live-accent');
  assert.equal(LIVE_COLOR.toLowerCase(), '#8a7cff');
  assert.equal(LIVE_ACCENT_COLOR.toLowerCase(), '#c3bbff');
});

test('globals.css declares --live and --live-accent in light and dark blocks', () => {
  const css = readFileSync(path.join(process.cwd(), 'app', 'globals.css'), 'utf-8');
  const liveDecls = css.match(/--live:\s*#8a7cff/gi) ?? [];
  const accentDecls = css.match(/--live-accent:\s*#c3bbff/gi) ?? [];
  assert.ok(liveDecls.length >= 2, 'two --live declarations (light + dark)');
  assert.ok(accentDecls.length >= 2, 'two --live-accent declarations (light + dark)');
});
