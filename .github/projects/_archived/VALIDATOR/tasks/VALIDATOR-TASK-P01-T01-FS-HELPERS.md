---
project: "VALIDATOR"
phase: 1
task: 1
title: "File System Helpers"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# File System Helpers

## Objective

Create the foundational file system utility module (`lib/utils/fs-helpers.js`) that provides safe, never-throwing wrappers around Node.js `fs` and `path` built-ins. This module is used by every check module in the VALIDATOR tool.

## Context

VALIDATOR is a zero-dependency Node.js CLI tool (CommonJS, Node 18+) that validates `.github/` orchestration files. This module sits in the Infrastructure / Utilities layer and is the lowest-level dependency — all check modules (`lib/checks/*.js`) import from it. Every function must use synchronous `fs` APIs and return safe defaults on error (never throw). Only the built-in `fs` and `path` modules may be used.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `lib/utils/fs-helpers.js` | New file — foundational utility module |

## Implementation Steps

1. Create the file `lib/utils/fs-helpers.js` with `'use strict';` at the top.
2. Import `fs` and `path` built-in modules using `require`.
3. Implement `exists(filePath)` — wrap `fs.existsSync(filePath)` in a try/catch that returns `false` on any error.
4. Implement `isDirectory(dirPath)` — use `fs.existsSync(dirPath)` AND `fs.statSync(dirPath).isDirectory()` inside a try/catch, returning `false` on any error.
5. Implement `listFiles(dirPath, suffix)` — use `fs.readdirSync(dirPath, { withFileTypes: true })`, filter to entries where `dirent.isFile()` is true, extract `.name` property (filenames only, NOT full paths). When `suffix` is provided and non-empty, further filter to names ending with `suffix`. Return `[]` on any error.
6. Implement `listDirs(dirPath)` — use `fs.readdirSync(dirPath, { withFileTypes: true })`, filter to entries where `dirent.isDirectory()` is true, extract `.name` property (directory names only, NOT full paths). Return `[]` on any error.
7. Implement `readFile(filePath)` — use `fs.readFileSync(filePath, 'utf-8')` inside a try/catch, returning `null` on any error.
8. Export all 5 functions via `module.exports = { exists, isDirectory, listFiles, listDirs, readFile };`.

## Contracts & Interfaces

The module must conform to this exact contract:

```typescript
// lib/utils/fs-helpers.js

/**
 * Check if a path exists (file or directory).
 * @returns true if path exists, false otherwise. Never throws.
 */
function exists(filePath: string): boolean;

/**
 * Check if a path is a directory.
 * @returns true if path exists and is a directory, false otherwise. Never throws.
 */
function isDirectory(dirPath: string): boolean;

/**
 * List files in a directory matching a suffix pattern.
 * @param dirPath - Absolute path to directory
 * @param suffix - File suffix to match (e.g., '.agent.md'). Empty string = all files.
 * @returns Array of filenames (not full paths). Empty array if directory doesn't exist.
 */
function listFiles(dirPath: string, suffix?: string): string[];

/**
 * List subdirectories in a directory.
 * @param dirPath - Absolute path to directory
 * @returns Array of directory names (not full paths). Empty array if parent doesn't exist.
 */
function listDirs(dirPath: string): string[];

/**
 * Read a file's content as UTF-8 string.
 * @returns File content, or null if the file doesn't exist or can't be read. Never throws.
 */
function readFile(filePath: string): string | null;

module.exports = { exists, isDirectory, listFiles, listDirs, readFile };
```

## Styles & Design Tokens

Not applicable — this is a utility module with no UI output.

## Test Requirements

- [ ] `exists()` returns `true` for a file that exists on disk
- [ ] `exists()` returns `true` for a directory that exists on disk
- [ ] `exists()` returns `false` for a path that does not exist
- [ ] `exists()` returns `false` (not throws) when given an invalid/malformed path
- [ ] `isDirectory()` returns `true` for an existing directory
- [ ] `isDirectory()` returns `false` for an existing file (not a directory)
- [ ] `isDirectory()` returns `false` for a non-existent path
- [ ] `isDirectory()` returns `false` (not throws) on error
- [ ] `listFiles()` returns an array of filenames (strings, not full paths) for a valid directory
- [ ] `listFiles()` with a suffix (e.g., `'.md'`) returns only files ending with that suffix
- [ ] `listFiles()` without a suffix returns all files in the directory
- [ ] `listFiles()` does NOT include subdirectory names in the result
- [ ] `listFiles()` returns `[]` for a non-existent directory
- [ ] `listFiles()` returns `[]` (not throws) on error
- [ ] `listDirs()` returns an array of directory names (strings, not full paths) for a valid directory
- [ ] `listDirs()` does NOT include files in the result
- [ ] `listDirs()` returns `[]` for a non-existent directory
- [ ] `listDirs()` returns `[]` (not throws) on error
- [ ] `readFile()` returns a UTF-8 string for a valid readable file
- [ ] `readFile()` returns `null` for a non-existent file
- [ ] `readFile()` returns `null` (not throws) on error

## Acceptance Criteria

- [ ] File `lib/utils/fs-helpers.js` exists and is valid JavaScript
- [ ] Module uses CommonJS format (`require` / `module.exports`)
- [ ] Module imports ONLY `fs` and `path` built-in modules — zero external dependencies
- [ ] All 5 functions are exported: `exists`, `isDirectory`, `listFiles`, `listDirs`, `readFile`
- [ ] No function ever throws an exception — all use try/catch with safe defaults
- [ ] `exists(filePath)` returns `boolean` — `true` for existing files and directories, `false` otherwise
- [ ] `isDirectory(dirPath)` returns `boolean` — `true` only if path exists AND is a directory
- [ ] `listFiles(dirPath, suffix?)` returns `string[]` of filenames (NOT full paths); filters by suffix when provided; returns all files when suffix is omitted or empty; returns `[]` on error
- [ ] `listDirs(dirPath)` returns `string[]` of directory names (NOT full paths); returns `[]` on error
- [ ] `readFile(filePath)` returns `string` (UTF-8 content) or `null` on failure
- [ ] All `fs` operations use sync versions: `existsSync`, `readdirSync`, `readFileSync`, `statSync`

## Constraints

- Do NOT use any external npm packages — only Node.js built-in `fs` and `path`
- Do NOT return full paths from `listFiles` or `listDirs` — return only the basename (filename or directory name)
- Do NOT throw exceptions from any exported function — always catch and return safe defaults (`false`, `[]`, `null`)
- Do NOT use async/promise-based `fs` APIs — use sync versions only (`existsSync`, `readdirSync`, `readFileSync`, `statSync`)
- Do NOT write to stdout, stderr, or any log — this is a pure utility module with no side effects
- Do NOT import or depend on any other module in the VALIDATOR project — this module has zero internal dependencies
