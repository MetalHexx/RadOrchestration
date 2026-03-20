#!/usr/bin/env node
'use strict';

const { processEvent, scaffoldInitialState } = require('./lib/pipeline-engine');
const stateIo = require('./lib/state-io');

function parseArgs(argv) {
  let event, projectDir, configPath, context;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--event' && i + 1 < argv.length) { event = argv[++i]; }
    else if (argv[i] === '--project-dir' && i + 1 < argv.length) { projectDir = argv[++i]; }
    else if (argv[i] === '--config' && i + 1 < argv.length) { configPath = argv[++i]; }
    else if (argv[i] === '--context' && i + 1 < argv.length) {
      try { context = JSON.parse(argv[++i]); }
      catch (e) { throw new Error('Invalid --context JSON: ' + e.message); }
    }
  }
  if (!event) throw new Error('Missing required flag: --event');
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
  catch (err) { process.stderr.write('[ERROR] pipeline: ' + err.message + '\n'); process.exit(1); }
}

module.exports = { parseArgs };
