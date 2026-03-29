#!/usr/bin/env node
'use strict';

const { processEvent, scaffoldInitialState } = require('./lib/pipeline-engine');
const stateIo = require('./lib/state-io');
const fs = require('fs');
const path = require('path');

class ContextJsonParseError extends Error {
  constructor(stderrMessage, stdoutMessage) {
    super(stdoutMessage);          // this.message → used in stdout JSON { error: ... }
    this.name = 'ContextJsonParseError';
    this.stderrMessage = stderrMessage;  // multi-line hint → written to stderr
  }
}

function parseArgs(argv) {
  let event, projectDir, configPath;
  let contextRaw;      // raw string from --context (deferred parse)
  let contextFile;     // path string from --context-file

  for (let i = 0; i < argv.length; i++) {
    if      (argv[i] === '--event'        && i + 1 < argv.length) { event      = argv[++i]; }
    else if (argv[i] === '--project-dir'  && i + 1 < argv.length) { projectDir = argv[++i]; }
    else if (argv[i] === '--config'       && i + 1 < argv.length) { configPath = argv[++i]; }
    else if (argv[i] === '--context'      && i + 1 < argv.length) { contextRaw  = argv[++i]; }
    else if (argv[i] === '--context-file' && i + 1 < argv.length) { contextFile = argv[++i]; }
    else if (argv[i] === '--context-file') {
      throw new Error('Missing value for --context-file: expected a file path argument.');
    }
  }

  // Mutual exclusion — checked BEFORE parsing either value
  if (contextRaw !== undefined && contextFile !== undefined) {
    throw new Error(
      'Cannot use --context and --context-file together: provide one or the other.'
    );
  }

  let context;

  // Process --context (inline JSON) — enriched error on failure
  if (contextRaw !== undefined) {
    try {
      context = JSON.parse(contextRaw);
    } catch (e) {
      const stderrMessage =
        'Invalid --context JSON: ' + e.message + '.\n' +
        'If invoking from PowerShell, shell brace expansion may have stripped the outer braces from the JSON argument.\n' +
        'To avoid shell quoting issues entirely, write the context to a file and use --context-file:\n' +
        "  Set-Content context.json -Value '<json>'; node pipeline.js --event <event> --project-dir <dir> --context-file context.json\n" +
        'Or, to pass inline, assign the JSON to a variable using single quotes first:\n' +
        "  $ctx = '{\"key\":\"value\"}'; node pipeline.js --event <event> --project-dir <dir> --context $ctx";
      const stdoutMessage =
        'Invalid --context JSON: ' + e.message + '. ' +
        'If invoking from PowerShell, shell brace expansion may have stripped the outer braces from the JSON argument. ' +
        'To avoid shell quoting issues entirely, use --context-file instead: write the JSON to a file and pass the file path.';
      throw new ContextJsonParseError(stderrMessage, stdoutMessage);
    }
  }

  // Process --context-file (file-based JSON)
  if (contextFile !== undefined) {
    const resolvedPath = path.resolve(contextFile);
    let fileContent;
    try {
      fileContent = fs.readFileSync(resolvedPath, 'utf8');
    } catch (e) {
      if (e.code === 'ENOENT') {
        throw new Error(
          'Cannot read context file "' + contextFile + '": file not found.'
        );
      }
      throw new Error(
        'Cannot read context file "' + contextFile + '": ' + e.message + '.'
      );
    }
    try {
      context = JSON.parse(fileContent);
    } catch (e) {
      throw new Error(
        'Invalid JSON in context file "' + contextFile + '": ' + e.message + '.'
      );
    }
  }

  if (!event)      throw new Error('Missing required flag: --event');
  if (!projectDir) throw new Error('Missing required flag: --project-dir');
  return { event, projectDir, configPath, context };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const io = {
    readState: stateIo.readState,
    writeState: stateIo.writeState,
    readConfig: stateIo.readConfig,
    readDocument: stateIo.readDocument,
    ensureDirectories: stateIo.ensureDirectories,
  };
  const result = processEvent(args.event, args.projectDir, args.context || {}, io, args.configPath);
  const orchRoot = stateIo.bootstrapOrchRoot();
  result.orchRoot = orchRoot;
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(result.success ? 0 : 1);
}

if (require.main === module) {
  try { main(); }
  catch (err) {
    // stderr: use multi-line stderrMessage if available (ContextJsonParseError),
    //         otherwise fall back to err.message
    const stderrMsg = err.stderrMessage || err.message;
    process.stderr.write('[ERROR] pipeline: ' + stderrMsg + '\n');

    // stdout: always single-line JSON for LLM consumption (err.message is always single-line)
    process.stdout.write(JSON.stringify({ success: false, error: err.message }) + '\n');

    process.exit(1);
  }
}

module.exports = { parseArgs };
