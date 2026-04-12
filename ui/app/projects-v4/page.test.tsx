/**
 * Tests for ProjectsV4Page — component imports, hook wiring, content-id, and ConfigClickContext dependency verification.
 * Run with: npx tsx --tsconfig ui/tsconfig.test.json ui/app/projects-v4/page.test.tsx
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import ProjectsV4Page from './page';
import { useConfigClickContext } from '@/hooks/use-config-click-context';

// ─── Test runner ─────────────────────────────────────────────────────────────

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

// ─── Source text helper ───────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const sourceText = readFileSync(join(__dirname, 'page.tsx'), 'utf-8');

// ─── Tests ───────────────────────────────────────────────────────────────────

async function run() {
  console.log('projects-v4/page — exports and contracts');

  await test('Default export is a function named ProjectsV4Page', () => {
    assert.strictEqual(typeof ProjectsV4Page, 'function', 'Default export should be a function');
    assert.strictEqual(ProjectsV4Page.name, 'ProjectsV4Page', 'Default export should be named ProjectsV4Page');
  });

  await test('useConfigClickContext is importable from @/hooks/use-config-click-context', () => {
    assert.strictEqual(typeof useConfigClickContext, 'function', 'useConfigClickContext should be a function');
  });

  await test('Module does NOT re-export AppHeader', async () => {
    const mod = await import('./page') as Record<string, unknown>;
    const keys = Object.keys(mod);
    assert.ok(
      !keys.includes('AppHeader'),
      `Module should not export AppHeader, but found keys: ${keys.join(', ')}`
    );
  });

  // ─── Component import verification ──────────────────────────────────────────

  await test('Source imports ProjectSidebar from @/components/sidebar', () => {
    assert.ok(
      sourceText.includes('ProjectSidebar') &&
        (sourceText.includes('"@/components/sidebar"') || sourceText.includes("'@/components/sidebar'")),
      'page.tsx must import ProjectSidebar from @/components/sidebar'
    );
  });

  await test('Source imports MainDashboard from @/components/layout', () => {
    assert.ok(
      sourceText.includes('MainDashboard') &&
        (sourceText.includes('"@/components/layout"') || sourceText.includes("'@/components/layout'")),
      'page.tsx must import MainDashboard from @/components/layout'
    );
  });

  await test('Source imports DocumentDrawer from @/components/documents', () => {
    assert.ok(
      sourceText.includes('DocumentDrawer') &&
        (sourceText.includes('"@/components/documents"') || sourceText.includes("'@/components/documents'")),
      'page.tsx must import DocumentDrawer from @/components/documents'
    );
  });

  await test('Source imports ConfigEditorPanel from @/components/config', () => {
    assert.ok(
      sourceText.includes('ConfigEditorPanel') &&
        (sourceText.includes('"@/components/config"') || sourceText.includes("'@/components/config'")),
      'page.tsx must import ConfigEditorPanel from @/components/config'
    );
  });

  await test('Source imports SidebarProvider from @/components/ui/sidebar', () => {
    assert.ok(
      sourceText.includes('SidebarProvider') &&
        (sourceText.includes('"@/components/ui/sidebar"') || sourceText.includes("'@/components/ui/sidebar'")),
      'page.tsx must import SidebarProvider from @/components/ui/sidebar'
    );
  });

  // ─── Hook import verification ────────────────────────────────────────────────

  await test('Source imports useProjects from @/hooks/use-projects', () => {
    assert.ok(
      sourceText.includes('useProjects') &&
        (sourceText.includes('"@/hooks/use-projects"') || sourceText.includes("'@/hooks/use-projects'")),
      'page.tsx must import useProjects from @/hooks/use-projects'
    );
  });

  await test('Source imports useDocumentDrawer from @/hooks/use-document-drawer', () => {
    assert.ok(
      sourceText.includes('useDocumentDrawer') &&
        (sourceText.includes('"@/hooks/use-document-drawer"') || sourceText.includes("'@/hooks/use-document-drawer'")),
      'page.tsx must import useDocumentDrawer from @/hooks/use-document-drawer'
    );
  });

  await test('Source imports useConfigEditor from @/hooks/use-config-editor', () => {
    assert.ok(
      sourceText.includes('useConfigEditor') &&
        (sourceText.includes('"@/hooks/use-config-editor"') || sourceText.includes("'@/hooks/use-config-editor'")),
      'page.tsx must import useConfigEditor from @/hooks/use-config-editor'
    );
  });

  // ─── ConfigClickContext wiring verification ──────────────────────────────────

  await test('Source calls setOnConfigClick (ConfigClickContext bridge wired)', () => {
    assert.ok(
      sourceText.includes('setOnConfigClick'),
      'page.tsx must call setOnConfigClick to wire the ConfigClickContext bridge'
    );
  });

  // ─── Content region id verification ─────────────────────────────────────────

  await test('Source contains id="main-content" on the content region', () => {
    assert.ok(
      sourceText.includes('id="main-content"') || sourceText.includes("id='main-content'"),
      'page.tsx must have id="main-content" on the SidebarInset content region'
    );
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
