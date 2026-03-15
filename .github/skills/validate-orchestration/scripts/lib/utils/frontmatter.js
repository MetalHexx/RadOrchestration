'use strict';

/**
 * Extract and parse YAML frontmatter from a markdown file's content.
 * Handles two formats:
 *   1. Standard: content between opening --- and closing --- at file start
 *   2. Fenced: content inside a ```chatagent or ```instructions or ```skill
 *      code block with --- delimiters inside
 *
 * @param {string} fileContent - Full text content of the markdown file
 * @returns {{ frontmatter: Record<string, any> | null, body: string }}
 *          frontmatter is null if no valid frontmatter block is found
 */
function extractFrontmatter(fileContent) {
  try {
    if (typeof fileContent !== 'string') {
      return { frontmatter: null, body: '' };
    }

    if (fileContent === '') {
      return { frontmatter: null, body: '' };
    }

    const lines = fileContent.split('\n');

    // --- Format 2: Fenced code block frontmatter ---
    const fencedMatch = lines[0].match(/^```(chatagent|instructions|skill|prompt)\s*$/i);
    if (fencedMatch) {
      return extractFenced(lines, fileContent);
    }

    // --- Format 1: Standard --- delimited frontmatter ---
    if (lines[0].trim() === '---') {
      return extractStandard(lines, fileContent);
    }

    // --- No frontmatter detected ---
    return { frontmatter: null, body: fileContent };
  } catch {
    return { frontmatter: null, body: fileContent };
  }
}

/**
 * Extract frontmatter from fenced code block format.
 * @param {string[]} lines
 * @param {string} fileContent
 * @returns {{ frontmatter: Record<string, any> | null, body: string }}
 */
function extractFenced(lines, fileContent) {
  // Find the closing ``` fence
  let closingFenceIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].match(/^```\s*$/)) {
      closingFenceIdx = i;
      break;
    }
  }

  if (closingFenceIdx === -1) {
    return { frontmatter: null, body: fileContent };
  }

  // Within the fenced block (lines 1 to closingFenceIdx-1), find --- delimiters
  const fencedContent = lines.slice(1, closingFenceIdx);
  let openIdx = -1;
  let closeIdx = -1;

  for (let i = 0; i < fencedContent.length; i++) {
    if (fencedContent[i].trim() === '---') {
      if (openIdx === -1) {
        openIdx = i;
      } else {
        closeIdx = i;
        break;
      }
    }
  }

  if (openIdx === -1 || closeIdx === -1) {
    return { frontmatter: null, body: fileContent };
  }

  const yamlLines = fencedContent.slice(openIdx + 1, closeIdx);
  const frontmatter = parseYaml(yamlLines);

  if (frontmatter === null) {
    return { frontmatter: null, body: fileContent };
  }

  // Body is everything inside the fenced block after the closing ---
  const bodyInsideFence = fencedContent.slice(closeIdx + 1);
  const body = bodyInsideFence.join('\n');

  return { frontmatter, body };
}

/**
 * Extract frontmatter from standard --- delimited format.
 * @param {string[]} lines
 * @param {string} fileContent
 * @returns {{ frontmatter: Record<string, any> | null, body: string }}
 */
function extractStandard(lines, fileContent) {
  let closeIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      closeIdx = i;
      break;
    }
  }

  if (closeIdx === -1) {
    return { frontmatter: null, body: fileContent };
  }

  const yamlLines = lines.slice(1, closeIdx);
  const frontmatter = parseYaml(yamlLines);

  if (frontmatter === null) {
    return { frontmatter: null, body: fileContent };
  }

  const body = lines.slice(closeIdx + 1).join('\n');
  return { frontmatter, body };
}

/**
 * Parse simple YAML key-value pairs from an array of lines.
 * Supports: scalars, quoted strings, booleans, integers, inline empty arrays, and YAML lists.
 * @param {string[]} yamlLines
 * @returns {Record<string, any> | null}
 */
function parseYaml(yamlLines) {
  const result = {};
  let i = 0;

  while (i < yamlLines.length) {
    const line = yamlLines[i];

    // Skip blank lines
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Match key: value pattern
    const keyMatch = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)/);
    if (!keyMatch) {
      i++;
      continue;
    }

    const key = keyMatch[1];
    const rawValue = keyMatch[2].trim();

    // Check if next lines are list items (  - value)
    if (rawValue === '') {
      // Could be a YAML list following, or just an empty value
      const listItems = [];
      let j = i + 1;
      while (j < yamlLines.length && yamlLines[j].match(/^\s+-\s+/)) {
        const itemMatch = yamlLines[j].match(/^\s+-\s+(.*)/);
        if (itemMatch) {
          const itemContent = itemMatch[1].trim();
          const colonMatch = itemContent.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)/);
          if (colonMatch) {
            // Key-value pair → object item
            const obj = {};
            obj[colonMatch[1]] = parseScalar(colonMatch[2].trim());
            // Consume continuation lines (indented deeper, not a new list item)
            let k = j + 1;
            while (k < yamlLines.length) {
              const contLine = yamlLines[k];
              const contTrimmed = contLine.trim();
              if (contTrimmed === '' || contLine.match(/^\s+-\s+/) || !contLine.match(/^\s+/)) break;
              const contMatch = contTrimmed.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)/);
              if (contMatch) {
                obj[contMatch[1]] = parseScalar(contMatch[2].trim());
              }
              k++;
            }
            listItems.push(obj);
            j = k;
          } else {
            listItems.push(parseScalar(itemContent));
            j++;
          }
        } else {
          j++;
        }
      }
      if (listItems.length > 0) {
        result[key] = listItems;
        i = j;
        continue;
      }
      // Empty value — treat as empty string
      result[key] = '';
      i++;
      continue;
    }

    // Inline empty array []
    if (rawValue === '[]') {
      result[key] = [];
      i++;
      continue;
    }

    // Regular scalar value
    result[key] = parseScalar(rawValue);
    i++;
  }

  return result;
}

/**
 * Parse a scalar YAML value string into the appropriate JS type.
 * @param {string} value
 * @returns {string | number | boolean}
 */
function parseScalar(value) {
  // Boolean
  if (value === 'true') return true;
  if (value === 'false') return false;

  // Quoted strings (double quotes)
  if (value.length >= 2 && value[0] === '"' && value[value.length - 1] === '"') {
    return value.slice(1, -1);
  }

  // Quoted strings (single quotes)
  if (value.length >= 2 && value[0] === "'" && value[value.length - 1] === "'") {
    return value.slice(1, -1);
  }

  // Integer
  if (/^-?\d+$/.test(value)) {
    return parseInt(value, 10);
  }

  // Unquoted string
  return value;
}

module.exports = { extractFrontmatter };
