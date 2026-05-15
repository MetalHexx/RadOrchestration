import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
test('no shipped docs mention docker compose for UI', () => {
  // Allow docs/internals/_private/* (historical refactor notes).
  let out = '';
  try {
    out = execSync('rg -l "docker[- ]compose" docs ui --glob !docs/internals/_private/**', { encoding: 'utf8' }).trim();
  } catch (e) {
    // Fall back to grep if rg is not available
    try {
      out = execSync('(grep -r "docker-compose\\|docker compose" docs ui --exclude-dir=_private 2>nul) || exit /b 0', { encoding: 'utf8', shell: 'cmd.exe' }).trim();
    } catch (e2) {
      out = '';
    }
  }
  assert.equal(out, '', `Docker UI references remain in:\n${out}`);
});
test('no shipped docs mention cd ui && npm run dev', () => {
  let out = '';
  try {
    out = execSync('rg -l "cd ui &&" docs --glob !docs/internals/_private/**', { encoding: 'utf8' }).trim();
  } catch (e) {
    // Fall back to grep if rg is not available
    try {
      out = execSync('(grep -r "cd ui &&" docs --exclude-dir=_private 2>nul) || exit /b 0', { encoding: 'utf8', shell: 'cmd.exe' }).trim();
    } catch (e2) {
      out = '';
    }
  }
  assert.equal(out, '');
});
