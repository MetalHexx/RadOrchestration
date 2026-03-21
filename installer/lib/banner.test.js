// installer/lib/banner.test.js — Tests for banner.js

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { renderBanner } from './banner.js';

test('renderBanner is exported as a function', () => {
  assert.equal(typeof renderBanner, 'function');
});

test('normal rendering (cols >= 80): output has no border, no tagline, no emoji', () => {
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

  // No box border characters
  assert.ok(!output.includes('╔'), 'output should NOT contain ╔');
  assert.ok(!output.includes('╗'), 'output should NOT contain ╗');
  assert.ok(!output.includes('╚'), 'output should NOT contain ╚');
  assert.ok(!output.includes('╝'), 'output should NOT contain ╝');

  // No tagline
  assert.ok(!output.includes('⚡ Orchestration System Installer ⚡'), 'output should NOT contain old tagline');

  // No emoji
  assert.ok(!output.includes('⚡'), 'output should NOT contain emoji');
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

  // Figlet Bloody for 'RadOrch' will produce multi-line ASCII art
  assert.ok(output.length > 100, 'output should be substantial (figlet art)');
  assert.ok(!output.includes('⚡'), 'output should NOT contain emoji');
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
  assert.ok(output.includes('RadOrch'), 'output should contain fallback text');
  assert.ok(!output.includes('⚡'), 'output should NOT contain emoji');
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
