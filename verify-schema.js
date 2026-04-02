const schema = JSON.parse(require('fs').readFileSync('.github/skills/orchestration/schemas/state-v4.schema.json','utf8'));
const issues = [];
const all = [];

function walk(obj, path) {
  if (!obj || typeof obj !== 'object') return;
  if (obj.title !== undefined || obj.description !== undefined) {
    all.push({ path, title: obj.title, desc: obj.description });
    
    if (obj.title) {
      const wordCount = obj.title.trim().split(/\s+/).length;
      if (wordCount < 2 || wordCount > 5) {
        issues.push(path + ': title word count ' + wordCount + ': ' + obj.title);
      }
      // Check for punctuation (allow letters, digits and spaces only)
      if (/[^a-zA-Z0-9 ]/.test(obj.title)) {
        issues.push(path + ': title has punctuation: ' + obj.title);
      }
    }
    
    if (obj.description) {
      if (obj.description.length > 120) {
        issues.push(path + ': description > 120 chars (' + obj.description.length + '): ' + obj.description);
      }
      if (!obj.description.endsWith('.')) {
        issues.push(path + ': description does not end with period: ' + obj.description);
      }
    }
  }
  if (obj.properties) {
    for (const [key, val] of Object.entries(obj.properties)) {
      walk(val, path + '.' + key);
    }
  }
  if (obj.items) walk(obj.items, path + '[]');
}

walk(schema, 'root');

console.log('Total nodes with title/description:', all.length);
console.log('');
console.log('--- Criteria violations ---');
if (issues.length === 0) {
  console.log('None - all criteria met');
} else {
  issues.forEach(i => console.log('  VIOLATION: ' + i));
}

// Print all titles for manual review
console.log('');
console.log('--- All titles ---');
all.forEach(a => console.log('  ' + a.path + ': ' + a.title));
