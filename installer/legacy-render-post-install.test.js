// installer/legacy-render-post-install.test.js — Unit test for renderPostInstall guidance.
//
// Tests the legacy installer path's post-install summary rendering. The CLI
// now ships inside the rad-orchestration skill folder; the summary points at
// the harness-rooted skill path, not the retired ~/.radorch/bin/ location.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// The test is structured to work around the module loading issue:
// we import dynamically only during test execution, not at module load time.

describe('renderPostInstall (legacy installer)', () => {
  it('emits npm install -g and in-skill direct invoke on Windows, no setx PATH', async () => {
    // Defer the import until test time to avoid module-load errors
    const { renderPostInstall } = await import('./index.js');

    // Save original platform descriptor
    const platformDesc = Object.getOwnPropertyDescriptor(process, 'platform');

    // Override platform
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true
    });

    // Capture output
    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(''));

    try {
      // Call the function
      renderPostInstall(
        { harnesses: ['claude'] },
        '/home/user/.radorch/orchestration.yml'
      );

      // Clean output (remove ANSI codes)
      const output = logs.join('\n')
        .replace(/\x1b\[[0-9;]*m/g, '');

      assert.match(
        output,
        /npm install -g rad-orchestration/,
        'Windows output must suggest npm install -g rad-orchestration'
      );

      assert.match(
        output,
        /node.*\.claude.*skills.*rad-orchestration.*scripts.*radorch\.mjs/,
        'Windows output must show direct node invocation of the in-skill CLI'
      );

      assert.doesNotMatch(
        output,
        /\\\.radorch\\bin\\/,
        'Windows output must NOT reference the retired ~/.radorch/bin/ path'
      );

      assert.doesNotMatch(
        output,
        /setx PATH/,
        'Windows output must NOT contain broken setx PATH instruction'
      );
    } finally {
      console.log = originalLog;
      // Restore platform
      if (platformDesc) {
        Object.defineProperty(process, 'platform', platformDesc);
      } else {
        delete process.platform;
      }
    }
  });

  it('emits in-skill CLI path on non-Windows, no retired ~/.radorch/bin reference', async () => {
    const { renderPostInstall } = await import('./index.js');

    const platformDesc = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', {
      value: 'linux',
      configurable: true
    });

    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(''));

    try {
      renderPostInstall(
        { harnesses: ['claude'] },
        '/home/user/.radorch/orchestration.yml'
      );

      const output = logs.join('\n')
        .replace(/\x1b\[[0-9;]*m/g, '');

      assert.match(
        output,
        /node\s+\$HOME\/\.claude\/skills\/rad-orchestration\/scripts\/radorch\.mjs/,
        'POSIX output must show direct node invocation of the in-skill CLI'
      );

      assert.doesNotMatch(
        output,
        /\$HOME\/\.radorch\/bin/,
        'POSIX output must NOT reference the retired ~/.radorch/bin path'
      );

      assert.doesNotMatch(
        output,
        /setx PATH/,
        'POSIX output must not contain Windows setx instruction'
      );
    } finally {
      console.log = originalLog;
      if (platformDesc) {
        Object.defineProperty(process, 'platform', platformDesc);
      } else {
        delete process.platform;
      }
    }
  });
});
