import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

// Mock theme.js with identity functions
const identity = (s) => s;
mock.module('./theme.js', {
  namedExports: {
    THEME: {
      banner: identity,
      heading: identity,
      label: identity,
      body: identity,
      secondary: identity,
      command: identity,
      hint: identity,
    },
  },
});

// Import AFTER mocks
const { renderHelp } = await import('./help.js');

describe('renderHelp', () => {
  it('does not throw', () => {
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    try {
      renderHelp();
    } finally {
      console.log = origLog;
    }
  });

  it('calls console.log', () => {
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    try {
      renderHelp();
    } finally {
      console.log = origLog;
    }
    assert.ok(logs.length > 0, 'console.log was called');
  });

  it('outputs key sections and flags', () => {
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    try {
      renderHelp();
    } finally {
      console.log = origLog;
    }
    const output = logs.join('\n');

    assert.ok(output.includes('radorch'), 'mentions radorch');
    assert.ok(output.includes('USAGE'), 'includes USAGE section');
    assert.ok(output.includes('--workspace'), 'includes --workspace');
    assert.ok(output.includes('--help'), 'includes --help');
    assert.ok(output.includes('--version'), 'includes --version');
    assert.ok(output.includes('--overwrite'), 'includes --overwrite');
    assert.ok(output.includes('--yes'), 'includes --yes');
    assert.ok(output.includes('--orch-root'), 'includes --orch-root');
    assert.ok(output.includes('--dashboard'), 'includes --dashboard');
    assert.ok(output.includes('EXAMPLES'), 'includes EXAMPLES');
    assert.ok(output.includes('--force'), 'includes --force alias');
    assert.ok(output.includes('--max-phases'), 'includes --max-phases');
    assert.ok(output.includes('--execution-mode'), 'includes --execution-mode');
  });

  it('includes memory flags in OPTIONAL FEATURES section', () => {
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    try {
      renderHelp();
    } finally {
      console.log = origLog;
    }
    const output = logs.join('\n');

    assert.ok(output.includes('OPTIONAL FEATURES'), 'includes OPTIONAL FEATURES section');
    assert.ok(output.includes('--memory'), 'includes --memory');
    assert.ok(output.includes('--no-memory'), 'includes --no-memory');
    assert.ok(output.includes('--auto-ingest'), 'includes --auto-ingest');
  });

  it('includes version from package.json', () => {
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    try {
      renderHelp();
    } finally {
      console.log = origLog;
    }
    const output = logs.join('\n');

    // Version string from actual package.json should appear in output
    assert.match(output, /v\d+\.\d+/, 'includes version number');
  });
});
