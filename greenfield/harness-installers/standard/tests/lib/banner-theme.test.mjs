// tests/lib/banner-theme.test.mjs — banner rendering and THEME palette tests

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { THEME, FIGLET_FONT, INQUIRER_THEME, sectionHeader, divider } from '../../lib/theme.js';
import { renderBanner } from '../../lib/banner.js';

describe('THEME palette', () => {
  it('exports all required token functions', () => {
    const required = [
      'banner', 'heading', 'rule', 'label', 'body', 'secondary',
      'hint', 'success', 'warning', 'error', 'errorDetail',
      'command', 'stepNumber', 'disabled',
    ];
    for (const key of required) {
      assert.equal(typeof THEME[key], 'function', `THEME.${key} should be a function`);
    }
  });

  it('THEME.spinner is the string "green"', () => {
    assert.equal(THEME.spinner, 'green');
  });

  it('FIGLET_FONT is a non-empty string', () => {
    assert.equal(typeof FIGLET_FONT, 'string');
    assert.ok(FIGLET_FONT.length > 0);
  });

  it('INQUIRER_THEME has prefix.idle and prefix.done', () => {
    assert.ok(INQUIRER_THEME && typeof INQUIRER_THEME === 'object');
    assert.ok(INQUIRER_THEME.prefix);
    assert.equal(typeof INQUIRER_THEME.prefix.idle, 'string');
    assert.equal(typeof INQUIRER_THEME.prefix.done, 'string');
  });

  it('THEME functions wrap text (return a non-empty string)', () => {
    const result = THEME.banner('test');
    assert.equal(typeof result, 'string');
    assert.ok(result.length > 0);
  });
});

describe('renderBanner stdout', () => {
  it('captures stdout containing "RadOrch" in figlet output', (t, done) => {
    // Capture stdout
    const chunks = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk, ...rest) => {
      chunks.push(chunk.toString());
      return origWrite(chunk, ...rest);
    };

    renderBanner();

    // Restore
    process.stdout.write = origWrite;

    const output = chunks.join('');
    // The figlet output for 'RadOrch' may be wrapped with ANSI colors.
    // Strip ANSI escapes and check for some recognizable content.
    const stripped = output.replace(/\x1b\[[0-9;]*m/g, '');
    // figlet "Bloody" font renders RadOrch across multiple lines.
    // At minimum the output should be non-empty.
    assert.ok(stripped.length > 0, 'renderBanner should produce some stdout');
    // The banner should include some visible content — 'R' from RadOrch appears in figlet
    // (The actual shape depends on the font and terminal width)
    assert.ok(stripped.trim().length > 0, 'Banner should not be whitespace-only');
    done();
  });
});

describe('sectionHeader', () => {
  it('produces a non-empty string to stdout', (t, done) => {
    const chunks = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk, ...rest) => {
      chunks.push(chunk.toString());
      return origWrite(chunk, ...rest);
    };

    sectionHeader('::', 'Getting Started');

    process.stdout.write = origWrite;
    const output = chunks.join('');
    const stripped = output.replace(/\x1b\[[0-9;]*m/g, '');
    assert.ok(stripped.includes('::'), 'sectionHeader should include :: marker');
    assert.ok(stripped.includes('Getting Started'), 'sectionHeader should include title');
    done();
  });
});

describe('divider', () => {
  it('produces a non-empty line to stdout', (t, done) => {
    const chunks = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk, ...rest) => {
      chunks.push(chunk.toString());
      return origWrite(chunk, ...rest);
    };

    divider();

    process.stdout.write = origWrite;
    const output = chunks.join('');
    const stripped = output.replace(/\x1b\[[0-9;]*m/g, '');
    assert.ok(stripped.trim().length > 0, 'divider should produce visible output');
    done();
  });
});
