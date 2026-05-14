import { describe, it, expect } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { expandDestinationTokens } from '../../../src/lib/upgrade/expand-tokens.js';

const home = os.homedir();

describe('expandDestinationTokens', () => {
  it('expands HARNESS_ROOT for claude', () => {
    expect(
      expandDestinationTokens('${HARNESS_ROOT}/skills/foo', 'claude'),
    ).toBe(path.join(home, '.claude', 'skills', 'foo'));
  });

  it('expands HARNESS_ROOT for copilot-vscode', () => {
    expect(
      expandDestinationTokens('${HARNESS_ROOT}/agents/bar.md', 'copilot-vscode'),
    ).toBe(path.join(home, '.copilot', 'agents', 'bar.md'));
  });

  it('expands HARNESS_ROOT for copilot-cli', () => {
    expect(
      expandDestinationTokens('${HARNESS_ROOT}/skills/baz', 'copilot-cli'),
    ).toBe(path.join(home, '.copilot', 'skills', 'baz'));
  });

  it('expands RAD_HOME', () => {
    expect(
      expandDestinationTokens('${RAD_HOME}/ui/server.js', 'claude'),
    ).toBe(path.join(home, '.radorch', 'ui', 'server.js'));
  });

  it('passes through paths with no tokens but normalises separators', () => {
    // path.normalize collapses mixed separators to OS-native.
    expect(
      expandDestinationTokens('/absolute/path/already', 'claude'),
    ).toBe(path.normalize('/absolute/path/already'));
  });
});
