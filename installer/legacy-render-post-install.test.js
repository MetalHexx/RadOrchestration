// installer/legacy-render-post-install.test.js — Unit test for renderPostInstall Windows guidance (FR-21, DD-1)
//
// Tests the legacy installer path's post-install summary rendering.
// The renderPostInstall function is called at the end of the install flow
// in installer/index.js main(). This test verifies that the Windows branch
// now emits DD-1 guidance instead of the broken setx instruction.

import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';

// The test is structured to work around the module loading issue:
// we import dynamically only during test execution, not at module load time.

describe('renderPostInstall (legacy installer, FR-21/DD-1)', () => {
  it('emits npm install -g and direct invoke on Windows, no setx PATH', async () => {
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

      // Assertions per DD-1 / FR-21
      assert.match(
        output,
        /npm install -g rad-orchestration/,
        'DD-1: Windows output must suggest npm install -g rad-orchestration'
      );

      assert.match(
        output,
        /node.*\.radorch.*radorch\.mjs/,
        'DD-1: Windows output must show direct node invocation of radorch.mjs'
      );

      assert.doesNotMatch(
        output,
        /setx PATH/,
        'FR-21: Windows output must NOT contain broken setx PATH instruction'
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

  it('emits export PATH on non-Windows, not DD-1 guidance', async () => {
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
        /export PATH="\$HOME\/.radorch\/bin:\$PATH"/,
        'POSIX output must contain export PATH'
      );

      assert.doesNotMatch(
        output,
        /npm install -g/,
        'POSIX output must not contain Windows-specific npm guidance'
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
