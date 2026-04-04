'use strict';

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

function chunkMarkdown(markdown) {
  if (!markdown || !markdown.trim()) return [];

  const lines = markdown.split('\n');
  const rawSections = [];
  let currentTitle = null;
  let currentLines = [];

  for (const line of lines) {
    if (/^#{1,2}\s/.test(line)) {
      if (currentTitle !== null || currentLines.length > 0) {
        rawSections.push({
          section_title: currentTitle || '(untitled)',
          content: currentLines.join('\n').trim(),
        });
      }
      currentTitle = line.trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  if (currentTitle !== null || currentLines.length > 0) {
    rawSections.push({
      section_title: currentTitle || '(untitled)',
      content: currentLines.join('\n').trim(),
    });
  }

  const sections = rawSections.filter(s => s.content.length > 0);

  // Merge small sections (< 50 tokens) with next
  const merged = [];
  let i = 0;
  while (i < sections.length) {
    const current = sections[i];
    const currentTokens = estimateTokens(current.content);
    if (currentTokens < 50 && i + 1 < sections.length) {
      const next = sections[i + 1];
      const nextTokens = estimateTokens(next.content);
      if (nextTokens <= currentTokens) {
        merged.push(current);
        i += 1;
        continue;
      }
      merged.push({
        section_title: next.section_title,
        content: current.content + '\n\n' + next.content,
      });
      i += 2;
    } else {
      merged.push(current);
      i += 1;
    }
  }

  // Split large sections (> 2000 tokens) on ### headers
  const result = [];
  for (const section of merged) {
    if (estimateTokens(section.content) > 2000) {
      const subSections = splitOnH3(section);
      if (subSections.length > 1) {
        result.push(...subSections);
      } else {
        result.push(section);
      }
    } else {
      result.push(section);
    }
  }

  return result;
}

function splitOnH3(section) {
  const lines = section.content.split('\n');
  const parts = [];
  let currentTitle = section.section_title;
  let currentLines = [];

  for (const line of lines) {
    if (/^###\s/.test(line)) {
      if (currentLines.length > 0) {
        parts.push({
          section_title: currentTitle,
          content: currentLines.join('\n').trim(),
        });
      }
      currentTitle = line.trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  if (currentLines.length > 0) {
    parts.push({
      section_title: currentTitle,
      content: currentLines.join('\n').trim(),
    });
  }

  return parts.filter(p => p.content.length > 0);
}

module.exports = { chunkMarkdown };
