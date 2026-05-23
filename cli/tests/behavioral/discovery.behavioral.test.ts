import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TIER_ROOT = path.resolve(__dirname);

function walkTestFiles(dir: string, out: string[]): void {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkTestFiles(full, out);
    else if (ent.isFile() && ent.name.endsWith('.test.ts')) out.push(full);
  }
}

describe('behavioral tier discovery and convention', () => {
  it('every test file under cli/tests/behavioral/ uses the .behavioral.test.ts suffix', () => {
    const files: string[] = [];
    walkTestFiles(TIER_ROOT, files);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(f.endsWith('.behavioral.test.ts'), `${f} must use the .behavioral.test.ts suffix per AD-3`).toBe(true);
    }
  });

  it('README documents the required convention sections', () => {
    const readme = fs.readFileSync(path.join(TIER_ROOT, 'README.md'), 'utf8');
    for (const section of [
      'Purpose',
      'Directory layout',
      '.behavioral.test.ts',
      'Assertion surface',
      'In-process invocation',
      'Synthetic fixtures',
      'Helper scoping',
      'Behavioral vs framework vs integration',
      'Pipeline worked example',
    ]) {
      expect(readme, `README missing section: ${section}`).toContain(section);
    }
  });

  it('vitest include glob already covers behavioral tests (no config edits required)', () => {
    const cfg = fs.readFileSync(path.resolve(__dirname, '..', '..', 'vitest.config.ts'), 'utf8');
    expect(cfg).toContain("tests/**/*.test.ts");
  });
});
