#!/usr/bin/env node
'use strict';

const { processEvent, scaffoldInitialState } = require('./lib/pipeline-engine');
const stateIo = require('./lib/state-io');

function parseArgs(argv) {
  let event, projectDir, configPath, docPath, branch, baseBranch, worktreePath,
      autoCommit, autoPr, gateType, reason, gateMode, commitHash, pushed,
      remoteUrl, compareUrl, prUrl;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--event' && i + 1 < argv.length) { event = argv[++i]; }
    else if (argv[i] === '--project-dir' && i + 1 < argv.length) { projectDir = argv[++i]; }
    else if (argv[i] === '--config' && i + 1 < argv.length) { configPath = argv[++i]; }
    else if (argv[i] === '--doc-path' && i + 1 < argv.length) { docPath = argv[++i]; }
    else if (argv[i] === '--branch' && i + 1 < argv.length) { branch = argv[++i]; }
    else if (argv[i] === '--base-branch' && i + 1 < argv.length) { baseBranch = argv[++i]; }
    else if (argv[i] === '--worktree-path' && i + 1 < argv.length) { worktreePath = argv[++i]; }
    else if (argv[i] === '--auto-commit' && i + 1 < argv.length) { autoCommit = argv[++i]; }
    else if (argv[i] === '--auto-pr' && i + 1 < argv.length) { autoPr = argv[++i]; }
    else if (argv[i] === '--gate-type' && i + 1 < argv.length) { gateType = argv[++i]; }
    else if (argv[i] === '--reason' && i + 1 < argv.length) { reason = argv[++i]; }
    else if (argv[i] === '--gate-mode' && i + 1 < argv.length) { gateMode = argv[++i]; }
    else if (argv[i] === '--commit-hash' && i + 1 < argv.length) { commitHash = argv[++i]; }
    else if (argv[i] === '--pushed'       && i + 1 < argv.length) { pushed      = argv[++i]; }
    else if (argv[i] === '--remote-url'   && i + 1 < argv.length) { remoteUrl   = argv[++i]; }
    else if (argv[i] === '--compare-url'  && i + 1 < argv.length) { compareUrl  = argv[++i]; }
    else if (argv[i] === '--pr-url'       && i + 1 < argv.length) { prUrl       = argv[++i]; }
  }
  if (!event) throw new Error('Missing required flag: --event');
  if (!projectDir) throw new Error('Missing required flag: --project-dir');
  return { event, projectDir, configPath, docPath, branch, baseBranch, worktreePath,
           autoCommit, autoPr, gateType, reason, gateMode, commitHash, pushed,
           remoteUrl, compareUrl, prUrl };
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
  const context = {};
  if (args.docPath !== undefined)      context.doc_path      = args.docPath;
  if (args.branch !== undefined)       context.branch        = args.branch;
  if (args.baseBranch !== undefined)   context.base_branch   = args.baseBranch;
  if (args.worktreePath !== undefined) context.worktree_path = args.worktreePath;
  if (args.autoCommit !== undefined)   context.auto_commit   = args.autoCommit;
  if (args.autoPr !== undefined)       context.auto_pr       = args.autoPr;
  if (args.gateType !== undefined)     context.gate_type     = args.gateType;
  if (args.reason !== undefined)       context.reason        = args.reason;
  if (args.gateMode !== undefined)     context.gate_mode     = args.gateMode;
  if (args.commitHash !== undefined)   context.commitHash    = args.commitHash;
  if (args.pushed !== undefined)       context.pushed        = args.pushed;
  if (args.remoteUrl  !== undefined)   context.remote_url    = args.remoteUrl  || null;
  if (args.compareUrl !== undefined)   context.compare_url   = args.compareUrl || null;
  if (args.prUrl !== undefined)        context.pr_url        = args.prUrl      || null;
  const result = processEvent(args.event, args.projectDir, context, io, args.configPath);
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
