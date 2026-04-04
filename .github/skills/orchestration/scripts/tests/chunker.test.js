'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { chunkMarkdown } = require('../rag/chunker.js');

describe('chunkMarkdown', () => {
  it('splits on ## headers', () => {
    const md = '# Title\nIntro text\n## Section A\nContent A\n## Section B\nContent B';
    const chunks = chunkMarkdown(md);
    assert.equal(chunks.length, 3);
    assert.equal(chunks[0].section_title, '# Title');
    assert.ok(chunks[0].content.includes('Intro text'));
    assert.equal(chunks[1].section_title, '## Section A');
    assert.ok(chunks[1].content.includes('Content A'));
    assert.equal(chunks[2].section_title, '## Section B');
    assert.ok(chunks[2].content.includes('Content B'));
  });

  it('merges small sections (under 50 tokens) with next section', () => {
    const md = '## Tiny\nHi\n## Normal\nThis section has enough content to stand on its own with many words here to pass the threshold easily and comfortably.';
    const chunks = chunkMarkdown(md);
    assert.equal(chunks.length, 1);
    assert.ok(chunks[0].content.includes('Hi'));
    assert.ok(chunks[0].content.includes('This section'));
  });

  it('splits large sections on ### headers', () => {
    const bigContent = 'word '.repeat(2100);
    const md = `## Big Section\n${bigContent}\n### Sub A\nSub content A\n### Sub B\nSub content B`;
    const chunks = chunkMarkdown(md);
    assert.ok(chunks.length >= 2, `Expected >=2 chunks, got ${chunks.length}`);
  });

  it('handles document with no headers', () => {
    const md = 'Just plain text with no headers at all.';
    const chunks = chunkMarkdown(md);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].section_title, '(untitled)');
  });

  it('handles empty document', () => {
    const chunks = chunkMarkdown('');
    assert.equal(chunks.length, 0);
  });

  it('preserves content within sections', () => {
    const md = '## Config\n```yaml\nkey: value\n```\n## Next\nMore text';
    const chunks = chunkMarkdown(md);
    assert.ok(chunks[0].content.includes('```yaml'));
    assert.ok(chunks[0].content.includes('key: value'));
  });
});
