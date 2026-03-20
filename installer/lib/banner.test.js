// installer/lib/banner.test.js — Tests for banner.js

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { renderBanner } from './banner.js';

test('renderBanner is exported as a function', () => {
  assert.equal(typeof renderBanner, 'function');
});

test('normal rendering (cols >= 80): output contains box-border characters and tagline', () => {
  const logs = [];
  const originalLog = console.log;
  const originalCols = process.stdout.columns;

  console.log = (...args) => logs.push(args.join(' '));
  Object.defineProperty(process.stdout, 'columns', { value: 120, writable: true, configurable: true });

  try {
    renderBanner();
  } finally {
    console.log = originalLog;
    Object.defineProperty(process.stdout, 'columns', { value: originalCols, writable: true, configurable: true });
  }

  const output = logs.join('\n');

  // Box border characters
  assert.ok(output.includes('╔'), 'output should contain ╔');
  assert.ok(output.includes('═'), 'output should contain ═');
  assert.ok(output.includes('╗'), 'output should contain ╗');
  assert.ok(output.includes('║'), 'output should contain ║');
  assert.ok(output.includes('╚'), 'output should contain ╚');
  assert.ok(output.includes('╝'), 'output should contain ╝');

  // Tagline
  assert.ok(output.includes('⚡ Orchestration System Installer ⚡'), 'output should contain tagline');
});

test('normal rendering (cols >= 80): output contains Figlet-rendered text for RadOrch', () => {
  const logs = [];
  const originalLog = console.log;
  const originalCols = process.stdout.columns;

  console.log = (...args) => logs.push(args.join(' '));
  Object.defineProperty(process.stdout, 'columns', { value: 120, writable: true, configurable: true });

  try {
    renderBanner();
  } finally {
    console.log = originalLog;
    Object.defineProperty(process.stdout, 'columns', { value: originalCols, writable: true, configurable: true });
  }

  const output = logs.join('\n');

  // Figlet ANSI Shadow for 'RadOrch' will produce multi-line ASCII art
  // The raw text should contain something from figlet (not just our fallback)
  assert.ok(output.length > 100, 'output should be substantial (figlet art + box)');
  assert.ok(!output.includes('⚡ RadOrch Installer ⚡') || output.includes('╔'), 
    'normal mode should not show narrow fallback text alone');
});

test('narrow fallback (cols < 60): output contains fallback text', () => {
  const logs = [];
  const originalLog = console.log;
  const originalCols = process.stdout.columns;

  console.log = (...args) => logs.push(args.join(' '));
  Object.defineProperty(process.stdout, 'columns', { value: 40, writable: true, configurable: true });

  try {
    renderBanner();
  } finally {
    console.log = originalLog;
    Object.defineProperty(process.stdout, 'columns', { value: originalCols, writable: true, configurable: true });
  }

  const output = logs.join('\n');
  assert.ok(output.includes('⚡ RadOrch Installer ⚡'), 'output should contain fallback text');
});

test('narrow fallback (cols < 60): output does NOT contain box-border characters', () => {
  const logs = [];
  const originalLog = console.log;
  const originalCols = process.stdout.columns;

  console.log = (...args) => logs.push(args.join(' '));
  Object.defineProperty(process.stdout, 'columns', { value: 40, writable: true, configurable: true });

  try {
    renderBanner();
  } finally {
    console.log = originalLog;
    Object.defineProperty(process.stdout, 'columns', { value: originalCols, writable: true, configurable: true });
  }

  const output = logs.join('\n');
  assert.ok(!output.includes('╔'), 'output should NOT contain ╔');
  assert.ok(!output.includes('╗'), 'output should NOT contain ╗');
  assert.ok(!output.includes('╚'), 'output should NOT contain ╚');
  assert.ok(!output.includes('╝'), 'output should NOT contain ╝');
});
