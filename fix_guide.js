const fs = require('fs');
const f = '.github/skills/orchestration/references/pipeline-guide.md';
let content = fs.readFileSync(f, 'utf8');
const lines = content.split('\n');

// We need to insert a new line after each occurrence of the [--auto-commit / --auto-pr] line
// Occurrence 1: 7-space indent (inside 3-space indented code block)
// Occurrence 2: 4-space indent (inside bash code block)

let insertions = 0;
const result = [];
for (let i = 0; i < lines.length; i++) {
  result.push(lines[i]);
  // Match the auto-commit/auto-pr line in either indentation style
  // and only if the NEXT line does NOT already contain --remote-url
  if (lines[i].includes('[--auto-commit') && lines[i].includes('[--auto-pr') &&
      (i + 1 >= lines.length || !lines[i+1].includes('--remote-url'))) {
    // Determine indentation: count leading spaces
    const match = lines[i].match(/^(\s+)/);
    const indent = match ? match[1] : '';
    result.push(indent + '[--remote-url <url>] [--compare-url <url>]');
    insertions++;
    console.log('Inserted after line ' + (i+1) + ' (indent: ' + indent.length + ' spaces)');
  }
}

if (insertions === 2) {
  fs.writeFileSync(f, result.join('\n'), 'utf8');
  console.log('saved - ' + insertions + ' insertions made');
} else {
  console.log('ERROR: expected 2 insertions, got ' + insertions);
}