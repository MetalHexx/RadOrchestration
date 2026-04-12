import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { AppHeaderShell } from './app-header-shell';
import * as barrel from './index';

// ─── Source text helper ───────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const sourceText = readFileSync(join(__dirname, 'app-header-shell.tsx'), 'utf-8');

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${name}\n    ${msg}`);
    failed++;
  }
}

async function run() {
  console.log('app-header-shell — exports and structure');

  await test('AppHeaderShell is exported and is a function', () => {
    assert.strictEqual(typeof AppHeaderShell, 'function');
  });

  await test('AppHeaderShell is re-exported from the barrel', () => {
    assert.strictEqual(typeof barrel.AppHeaderShell, 'function');
  });

  await test('AppHeaderShell.name equals "AppHeaderShell"', () => {
    assert.strictEqual(AppHeaderShell.name, 'AppHeaderShell');
  });

  await test('NAV_LINKS contains "/projects" href', () => {
    assert.ok(
      sourceText.includes('"/projects"') || sourceText.includes("'/projects'"),
      'app-header-shell.tsx must contain a NAV_LINKS entry with href="/projects"'
    );
  });

  await test('NAV_LINKS contains "/projects-v4" href', () => {
    assert.ok(
      sourceText.includes('"/projects-v4"') || sourceText.includes("'/projects-v4'"),
      'app-header-shell.tsx must contain a NAV_LINKS entry with href="/projects-v4"'
    );
  });

  if (failed > 0) {
    console.error(`\n${failed} test(s) failed, ${passed} passed`);
    process.exit(1);
  } else {
    console.log(`\nAll ${passed} tests passed`);
  }
}

run();
