import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { translateSkill } from '../index.js';

test('translateSkill copies SKILL.md and walks subfolders, skipping dev artifacts', async () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-xlate-'));
  try {
    const src = join(root, 'src/my-skill');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'SKILL.md'), '---\nname: my-skill\ndescription: a skill\n---\n\nBody refers to FOOTOOL.\n');
    mkdirSync(join(src, 'scripts'), { recursive: true });
    writeFileSync(join(src, 'scripts/run.js'), '// real script using FOOTOOL\n');
    // Dev artifacts that must be skipped:
    mkdirSync(join(src, '__tests__'), { recursive: true });
    writeFileSync(join(src, '__tests__/a.test.js'), 'should not ship');
    mkdirSync(join(src, 'node_modules/leftpad'), { recursive: true });
    writeFileSync(join(src, 'node_modules/leftpad/index.js'), 'should not ship');
    mkdirSync(join(src, 'dist'), { recursive: true });
    writeFileSync(join(src, 'dist/bundle.js'), 'should not ship');
    mkdirSync(join(src, 'dist-bundle'), { recursive: true });
    writeFileSync(join(src, 'dist-bundle/out.js'), 'should not ship');
    mkdirSync(join(src, '.next'), { recursive: true });
    writeFileSync(join(src, '.next/cache.json'), 'should not ship');
    writeFileSync(join(src, 'scripts/util.test.ts'), 'should not ship');
    writeFileSync(join(src, 'scripts/util.spec.mjs'), 'should not ship');
    writeFileSync(join(src, 'vitest.config.ts'), 'should not ship');
    writeFileSync(join(src, 'vitest.config.js'), 'should not ship');
    writeFileSync(join(src, 'vitest.config.mjs'), 'should not ship');
    writeFileSync(join(src, 'tsconfig.tsbuildinfo'), 'should not ship');
    // A binary subfile that must travel verbatim:
    writeFileSync(join(src, 'scripts/icon.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const adapter = { name: 'alpha', filenames: { agent: '{name}.md', skill: 'SKILL.md' }, bodyTokens: { FOOTOOL: 'bartool' } };
    await translateSkill({ skillDir: src, adapter, outDir: join(root, 'output') });

    const outSkill = join(root, 'output/alpha/skills/my-skill');
    const skillMd = readFileSync(join(outSkill, 'SKILL.md'), 'utf8');
    assert.ok(skillMd.includes('Body refers to bartool.'), 'bodyTokens applied to SKILL.md body (FR-12)');
    assert.match(skillMd, /^---\nname: my-skill/, 'inline frontmatter preserved (FR-12)');
    const script = readFileSync(join(outSkill, 'scripts/run.js'), 'utf8');
    assert.ok(script.includes('bartool'), 'bodyTokens applied to subfolder text content (FR-12)');
    assert.ok(existsSync(join(outSkill, 'scripts/icon.png')), 'binary subfile copied verbatim (FR-12)');
    const png = readFileSync(join(outSkill, 'scripts/icon.png'));
    assert.deepStrictEqual([...png], [0x89, 0x50, 0x4e, 0x47], 'binary bytes preserved (FR-12)');
    // Skip-list assertions (FR-18, AD-9):
    for (const skipped of ['__tests__', 'node_modules', 'dist', 'dist-bundle', '.next']) {
      assert.ok(!existsSync(join(outSkill, skipped)), `${skipped}/ folder skipped (AD-9)`);
    }
    for (const f of ['scripts/util.test.ts', 'scripts/util.spec.mjs', 'vitest.config.ts', 'vitest.config.js', 'vitest.config.mjs', 'tsconfig.tsbuildinfo']) {
      assert.ok(!existsSync(join(outSkill, f)), `${f} skipped (AD-9)`);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
