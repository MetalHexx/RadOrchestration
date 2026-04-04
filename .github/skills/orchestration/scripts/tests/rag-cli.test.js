'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseArgs } = require('../rag.js');

describe('rag.js parseArgs', () => {
  it('parses query command', () => {
    const args = parseArgs(['query', '--text', 'auth patterns', '--table', 'knowledge', '--limit', '10']);
    assert.equal(args.command, 'query');
    assert.equal(args.text, 'auth patterns');
    assert.equal(args.table, 'knowledge');
    assert.equal(args.limit, 10);
  });

  it('parses embed command', () => {
    const args = parseArgs(['embed', '--doc', 'ARCH.md', '--project-dir', '/tmp/p', '--table', 'context', '--doc-type', 'architecture', '--phase', '1']);
    assert.equal(args.command, 'embed');
    assert.equal(args.doc, 'ARCH.md');
    assert.equal(args.projectDir, '/tmp/p');
    assert.equal(args.table, 'context');
    assert.equal(args.docType, 'architecture');
    assert.equal(args.phase, 1);
  });

  it('parses embed-phase command', () => {
    const args = parseArgs(['embed-phase', '--project-dir', '/tmp/p', '--phase', '2']);
    assert.equal(args.command, 'embed-phase');
    assert.equal(args.projectDir, '/tmp/p');
    assert.equal(args.phase, 2);
  });

  it('parses doc-type filter as array', () => {
    const args = parseArgs(['query', '--text', 'x', '--table', 'context', '--project-dir', '/tmp/p', '--doc-type', 'architecture,design']);
    assert.deepStrictEqual(args.docTypes, ['architecture', 'design']);
  });

  it('defaults limit to 5 for context, 10 for knowledge', () => {
    const ctx = parseArgs(['query', '--text', 'x', '--table', 'context', '--project-dir', '/tmp/p']);
    assert.equal(ctx.limit, 5);
    const kn = parseArgs(['query', '--text', 'x', '--table', 'knowledge']);
    assert.equal(kn.limit, 10);
  });

  it('throws on missing command', () => {
    assert.throws(() => parseArgs([]), /Usage/);
  });
});
