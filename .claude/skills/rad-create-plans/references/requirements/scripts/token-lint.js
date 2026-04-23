#!/usr/bin/env node
// Soft-warn token linter for Requirements docs.
// Splits the doc on ^### , estimates tokens as ceil(wordCount * 0.75),
// prints offenders (> 500 tokens) as JSON. Exit code always 0.

const fs = require('fs');
const path = require('path');

const TOKEN_LIMIT = 500;

function main() {
  const target = process.argv[2];
  if (!target) {
    console.error('usage: node token-lint.js <path-to-requirements-doc.md>');
    process.exit(0);
  }

  const abs = path.resolve(target);
  if (!fs.existsSync(abs)) {
    console.error(`file not found: ${abs}`);
    process.exit(0);
  }

  const lines = fs.readFileSync(abs, 'utf8').split(/\r?\n/);
  const offenders = [];
  let current = null;

  lines.forEach((line, idx) => {
    if (/^### /.test(line)) {
      if (current) offenders.push(finalize(current));
      current = { heading: line.trim(), lineNumber: idx + 1, wordCount: 0 };
    } else if (current) {
      const words = line.trim() === '' ? [] : line.trim().split(/\s+/);
      current.wordCount += words.length;
    }
  });
  if (current) offenders.push(finalize(current));

  const flagged = offenders.filter((o) => o.estimatedTokens > TOKEN_LIMIT);
  console.log(JSON.stringify(flagged, null, 2));
  process.exit(0);
}

function countHeadingWords(heading) {
  const stripped = heading.replace(/^###\s*/, '').replace(/:\s*$/, '').trim();
  return stripped ? stripped.split(/\s+/).length : 0;
}

function finalize(block) {
  const headingWords = countHeadingWords(block.heading);
  const totalWords = headingWords + block.wordCount;
  return {
    heading: block.heading,
    lineNumber: block.lineNumber,
    estimatedTokens: Math.ceil(totalWords * 0.75),
  };
}

main();
