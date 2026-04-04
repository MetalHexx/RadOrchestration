#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');

// ─── Arg Parsing ───────────────────────────────────────────────────────────

function parseArgs(argv) {
  const command = argv[0];
  if (!command || !['query', 'embed', 'embed-phase'].includes(command)) {
    throw new Error('Usage: node rag.js <query|embed|embed-phase> [options]');
  }

  const args = { command };
  for (let i = 1; i < argv.length; i++) {
    switch (argv[i]) {
      case '--text':        args.text = argv[++i]; break;
      case '--table':       args.table = argv[++i]; break;
      case '--doc':         args.doc = argv[++i]; break;
      case '--project-dir': args.projectDir = argv[++i]; break;
      case '--doc-type':    args.docType = argv[++i]; break;
      case '--phase':       args.phase = parseInt(argv[++i], 10); break;
      case '--limit':       args.limit = parseInt(argv[++i], 10); break;
      case '--config':      args.configPath = argv[++i]; break;
    }
  }

  // Normalize doc-type for query (comma-separated → array)
  if (command === 'query' && args.docType) {
    args.docTypes = args.docType.split(',').map(s => s.trim());
    delete args.docType;
  }

  // Default limits
  if (command === 'query' && args.limit == null) {
    args.limit = args.table === 'knowledge' ? 10 : 5;
  }

  return args;
}

// ─── Config Loading ────────────────────────────────────────────────────────

function loadRagConfig(configPath) {
  const stateIo = require('./lib/state-io');
  const config = stateIo.readConfig(configPath);
  return config.rag || null;
}

// ─── Output Helpers ────────────────────────────────────────────────────────

function output(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
}

function warn(msg) {
  process.stderr.write(`[rag] ${msg}\n`);
}

function disabled() {
  output({ results: [], status: 'disabled' });
}

function unavailable(error) {
  warn(error);
  output({ results: [], status: 'unavailable', error });
}

// ─── Commands ──────────────────────────────────────────────────────────────

async function runQuery(args, ragConfig) {
  const { embedTexts } = require('./rag/embedder');
  const db = require('./rag/db');

  const client = db.createClient(ragConfig);
  try {
    await client.connect();

    const [queryEmbedding] = await embedTexts([args.text], {
      ...ragConfig,
      input_type: 'search_query',
    });

    let results;
    if (args.table === 'knowledge') {
      results = await db.queryKnowledge(client, queryEmbedding, {
        category: args.category,
        limit: args.limit,
      });
    } else {
      const projectName = path.basename(args.projectDir);
      results = await db.queryContext(client, queryEmbedding, {
        project_name: projectName,
        doc_types: args.docTypes,
        phase: args.phase,
        limit: args.limit,
      });
    }

    output({ results, status: 'ok' });
  } finally {
    await client.end();
  }
}

async function runEmbed(args, ragConfig) {
  const { embedTexts } = require('./rag/embedder');
  const { chunkMarkdown } = require('./rag/chunker');
  const db = require('./rag/db');

  const docFullPath = path.isAbsolute(args.doc)
    ? args.doc
    : path.join(args.projectDir, args.doc);

  if (!fs.existsSync(docFullPath)) {
    warn(`Document not found: ${docFullPath}`);
    output({ embedded: 0, status: 'doc_not_found' });
    return;
  }

  const markdown = fs.readFileSync(docFullPath, 'utf8');
  const chunks = chunkMarkdown(markdown);

  if (chunks.length === 0) {
    output({ embedded: 0, status: 'empty_doc' });
    return;
  }

  const texts = chunks.map(c => c.content);
  const embeddings = await embedTexts(texts, ragConfig);

  const projectName = path.basename(args.projectDir);
  const client = db.createClient(ragConfig);

  try {
    await client.connect();

    if (args.table === 'knowledge') {
      const rows = chunks.map((chunk, i) => ({
        project_name: projectName,
        category: deriveCategoryFromTitle(chunk.section_title),
        title: chunk.section_title,
        content: chunk.content,
        source_doc: args.doc,
        embedding: embeddings[i],
      }));
      await db.insertKnowledgeChunks(client, rows);
    } else {
      const rows = chunks.map((chunk, i) => ({
        project_name: projectName,
        phase: args.phase || null,
        doc_path: args.doc,
        section_title: chunk.section_title,
        content: chunk.content,
        doc_type: args.docType || 'unknown',
        embedding: embeddings[i],
      }));
      await db.insertContextChunks(client, rows);
    }

    output({ embedded: chunks.length, status: 'ok' });
  } finally {
    await client.end();
  }
}

async function runEmbedPhase(args, ragConfig) {
  const { discoverPhaseArtifacts } = require('./rag/phase-discovery');
  const stateIo = require('./lib/state-io');

  const state = stateIo.readState(args.projectDir);
  if (!state) {
    warn('No state.json found');
    output({ embedded: 0, status: 'no_state' });
    return;
  }

  const artifacts = discoverPhaseArtifacts(state, args.phase);
  let totalEmbedded = 0;

  for (const artifact of artifacts) {
    await runEmbed({
      doc: artifact.doc_path,
      projectDir: args.projectDir,
      table: 'context',
      docType: artifact.doc_type,
      phase: args.phase,
    }, ragConfig);
    totalEmbedded++;
  }

  warn(`RAG: embedded artifacts for phase ${args.phase} (${totalEmbedded} documents)`);
}

function deriveCategoryFromTitle(title) {
  const lower = title.toLowerCase();
  if (lower.includes('decision')) return 'decision';
  if (lower.includes('lesson')) return 'lesson';
  if (lower.includes('pattern') || lower.includes('went well')) return 'pattern';
  return 'lesson';
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const ragConfig = loadRagConfig(args.configPath);

  if (!ragConfig || !ragConfig.enabled) {
    disabled();
    return;
  }

  try {
    if (args.command === 'query') await runQuery(args, ragConfig);
    else if (args.command === 'embed') await runEmbed(args, ragConfig);
    else if (args.command === 'embed-phase') await runEmbedPhase(args, ragConfig);
  } catch (err) {
    unavailable(err.message);
  }
}

if (require.main === module) {
  main().catch(err => {
    warn(err.message);
    process.exit(0); // Always exit 0 — RAG is never blocking
  });
}

module.exports = { parseArgs };
