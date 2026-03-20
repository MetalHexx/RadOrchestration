'use strict';

// ─── Shared Tool Constants ────────────────────────────────────────────────────

/** Valid toolset names for agent/prompt tools arrays */
const VALID_TOOLSETS = ['read', 'search', 'edit', 'execute', 'web', 'todo', 'agent', 'vscode'];

/** Known valid namespaced tool identifiers */
const VALID_NAMESPACED_TOOLS = [
  'web/fetch',
  'read/readFile', 'read/readDirectory', 'read/listDirectory',
  'edit/editFiles', 'edit/createFile', 'edit/deleteFile', 'edit/moveFile',
  'execute/runInTerminal'
];

/** Deprecated tool names that should not appear in tools arrays */
const DEPRECATED_TOOLS = [
  'readFile', 'editFile', 'createFile', 'deleteFile', 'moveFile',
  'findFiles', 'listDirectory', 'runInTerminal', 'fetchWebpage',
  'searchCodebase', 'searchFiles', 'runTests'
];

module.exports = { VALID_TOOLSETS, VALID_NAMESPACED_TOOLS, DEPRECATED_TOOLS };
