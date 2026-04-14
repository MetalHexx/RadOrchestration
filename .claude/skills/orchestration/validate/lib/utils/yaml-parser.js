'use strict';

/**
 * Parse a YAML string into a nested plain object.
 * Supports: scalars, single/double-quoted strings, arrays (- item),
 * nested objects (indented keys), inline booleans, integers.
 * Does NOT support: anchors, aliases, multi-document, flow style, multiline scalars.
 *
 * @param {string} yamlString - Raw YAML content
 * @returns {Record<string, any> | null} Parsed object, or null if parsing fails entirely
 */
function parseYaml(yamlString) {
  try {
    if (typeof yamlString !== 'string' || yamlString.trim() === '') {
      return null;
    }

    const rawLines = yamlString.split('\n');

    // Pre-process: strip comment-only lines, inline comments, blank lines
    const lines = [];
    for (const rawLine of rawLines) {
      // Skip blank lines
      if (rawLine.trim() === '') continue;

      // Skip comment-only lines (first non-whitespace is #)
      if (rawLine.trim().startsWith('#')) continue;

      // Strip inline comments (# not inside quotes)
      const processed = stripInlineComment(rawLine);

      // After stripping, skip if nothing meaningful remains
      if (processed.trim() === '') continue;

      lines.push(processed);
    }

    if (lines.length === 0) {
      return null;
    }

    const root = {};
    // Stack tracks nesting: { indent, container }
    // indent = indent level of the KEY that introduced this container
    const stack = [{ indent: -1, container: root }];

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const indent = getIndent(line);
      const trimmed = line.trim();

      // Pop stack entries whose indent >= current line's indent
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }

      const current = stack[stack.length - 1].container;

      // ── List item: - value ──────────────────────────────────────────
      if (trimmed.startsWith('- ')) {
        if (Array.isArray(current)) {
          const itemContent = trimmed.slice(2).trim();
          const colonIdx = findKeyColon(itemContent);
          if (colonIdx !== -1) {
            // Key-value pair → object item
            const obj = {};
            const key = itemContent.slice(0, colonIdx).trim();
            const rawValue = itemContent.slice(colonIdx + 1).trim();
            obj[key] = parseScalar(rawValue);
            // Consume continuation lines (indented deeper than the `- ` prefix)
            const itemIndent = indent + 2; // indent of content after `- `
            while (i + 1 < lines.length) {
              const nextLine = lines[i + 1];
              const nextIndent = getIndent(nextLine);
              const nextTrimmed = nextLine.trim();
              if (nextTrimmed === '' || nextIndent <= indent) break;
              const contColonIdx = findKeyColon(nextTrimmed);
              if (contColonIdx !== -1) {
                const contKey = nextTrimmed.slice(0, contColonIdx).trim();
                const contRawValue = nextTrimmed.slice(contColonIdx + 1).trim();
                obj[contKey] = parseScalar(contRawValue);
              }
              i++;
            }
            current.push(obj);
          } else {
            // No colon → scalar item (existing behavior)
            current.push(parseScalar(itemContent));
          }
        }
        i++;
        continue;
      }

      // ── Key-value or nested key ─────────────────────────────────────
      const colonIdx = findKeyColon(trimmed);
      if (colonIdx === -1) {
        // Not a recognized YAML line — skip
        i++;
        continue;
      }

      const key = trimmed.slice(0, colonIdx).trim();
      const rawValue = trimmed.slice(colonIdx + 1).trim();

      if (rawValue === '') {
        // No inline value — could be nested object, array, or empty string
        const nextLine = i + 1 < lines.length ? lines[i + 1] : null;
        const nextIndent = nextLine ? getIndent(nextLine) : 0;

        if (nextLine && nextIndent > indent) {
          // Deeper-indented children follow
          if (nextLine.trim().startsWith('- ')) {
            // Children are list items → array
            const arr = [];
            if (!Array.isArray(current)) {
              current[key] = arr;
            }
            stack.push({ indent, container: arr });
          } else {
            // Children are key-value pairs → object
            const obj = {};
            if (!Array.isArray(current)) {
              current[key] = obj;
            }
            stack.push({ indent, container: obj });
          }
        } else {
          // No children — empty string
          if (!Array.isArray(current)) {
            current[key] = '';
          }
        }
      } else if (rawValue === '[]') {
        // Inline empty array
        if (!Array.isArray(current)) {
          current[key] = [];
        }
      } else {
        // Scalar value
        if (!Array.isArray(current)) {
          current[key] = parseScalar(rawValue);
        }
      }

      i++;
    }

    return root;
  } catch {
    return null;
  }
}

/**
 * Strip an inline comment (# not inside quotes) from a line.
 * Preserves leading whitespace (indentation).
 * @param {string} line - Raw line with possible inline comment
 * @returns {string} Line with inline comment removed
 */
function stripInlineComment(line) {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    } else if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (ch === '#' && !inSingleQuote && !inDoubleQuote) {
      // Unquoted # — strip from here, trim trailing whitespace before it
      return line.slice(0, i).trimEnd();
    }
  }

  return line;
}

/**
 * Count leading spaces in a line (indentation level).
 * @param {string} line
 * @returns {number}
 */
function getIndent(line) {
  let count = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === ' ') {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Find the index of the first colon acting as a key-value separator.
 * A separator colon is followed by a space or is at end-of-string.
 * @param {string} trimmed - Trimmed line content
 * @returns {number} Index of colon, or -1 if not found
 */
function findKeyColon(trimmed) {
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === ':') {
      if (i === trimmed.length - 1 || trimmed[i + 1] === ' ') {
        return i;
      }
    }
  }
  return -1;
}

/**
 * Parse a scalar YAML value into the appropriate JavaScript type.
 * Supports: booleans (case-sensitive), integers, quoted strings, unquoted strings.
 * @param {string} value - Trimmed scalar value
 * @returns {string | number | boolean}
 */
function parseScalar(value) {
  // Boolean (case-sensitive per YAML 1.1 core)
  if (value === 'true') return true;
  if (value === 'false') return false;

  // Double-quoted string
  if (value.length >= 2 && value[0] === '"' && value[value.length - 1] === '"') {
    return value.slice(1, -1);
  }

  // Single-quoted string
  if (value.length >= 2 && value[0] === "'" && value[value.length - 1] === "'") {
    return value.slice(1, -1);
  }

  // Integer (positive or negative)
  if (/^-?\d+$/.test(value)) {
    return parseInt(value, 10);
  }

  // Unquoted string
  return value;
}

module.exports = { parseYaml };
