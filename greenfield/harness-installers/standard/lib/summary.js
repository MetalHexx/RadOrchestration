// greenfield/harness-installers/standard/lib/summary.js — Post-install summary
// renderer for the standard installer. Mirrors the legacy installer's text
// style (THEME tokens, BBS-style section headers, numbered next-steps) but
// works from the new harness-aware structure produced by index.js.
//
// Surface order (DD-2):
//   1. Section: ::: Installation Complete
//      ├─ one line per harness (action-aware: fresh-install | upgrade-complete
//      │  | noop → green check; downgrade-refused → red X)
//      ├─ Configuration: <orchYmlPath>
//      └─ Dashboard UI: built and ready
//   2. Section: ::: What's Next
//      ├─ /rad-brainstorm
//      ├─ /rad-plan
//      ├─ /rad-execute
//      └─ /rad-ui-start
//   3. Full-guide link.
//   4. (DD-4 — diagnostic): drift hint emitted on stderr if `driftHint` is truthy.

import { THEME, sectionHeader, divider } from './theme.js';

/**
 * @typedef {Object} HarnessResult
 * @property {string} harness - Harness key (claude / copilot-vscode / copilot-cli)
 * @property {'fresh-install' | 'upgrade-complete' | 'noop' | 'downgrade-refused'} action
 * @property {string} [message] - Optional message (typically set on downgrade-refused)
 */

/**
 * Renders the post-install summary to stdout. The drift hint, if present, is
 * emitted on stderr per DD-4 (diagnostics go to stderr; user-facing summary
 * stays on stdout).
 *
 * @param {{
 *   harnessResults: HarnessResult[],
 *   configPath: string,
 *   driftHint?: { installedVersion: string, pluginVersion: string } | boolean | null,
 *   uiBuilt?: boolean,
 * }} opts
 * @returns {void}
 */
export function renderPostInstallSummary({ harnessResults, configPath, driftHint, uiBuilt }) {
  console.log('');
  sectionHeader('::', 'Installation Complete');
  console.log('');

  for (const r of harnessResults) {
    if (r.action === 'downgrade-refused') {
      console.log(
        '  ' + THEME.error('✖') + ' ' +
        THEME.body(`harness '${r.harness}' bootstrapped (action: ${r.action})`),
      );
    } else {
      console.log(
        '  ' + THEME.success('✔') + ' ' +
        THEME.body(`harness '${r.harness}' bootstrapped (action: ${r.action})`),
      );
    }
  }

  console.log('  ' + THEME.success('✔') + ' ' + THEME.body('Configuration: ') + THEME.secondary(configPath));
  if (uiBuilt) {
    console.log('  ' + THEME.success('✔') + ' ' + THEME.body('Dashboard UI: ') + THEME.success('built and ready'));
  }

  console.log('');
  sectionHeader('::', "What's Next");
  console.log('');

  console.log('  ' + THEME.stepNumber('1.') + ' ' + THEME.body('Open your harness and start a new conversation.'));
  console.log('');

  console.log('  ' + THEME.stepNumber('2.') + ' ' + THEME.body('Walk through the orchestration workflow:'));
  console.log('');
  console.log('     ' + THEME.command('/rad-brainstorm') + '  →  ' + THEME.body('refine a project idea'));
  console.log('     ' + THEME.command('/rad-plan') + '        →  ' + THEME.body('produce requirements + master plan'));
  console.log('     ' + THEME.command('/rad-execute') + '     →  ' + THEME.body('run the pipeline through implementation'));
  console.log('');

  console.log('  ' + THEME.stepNumber('3.') + ' ' + THEME.body('(optional) Start the dashboard from inside your harness:'));
  console.log('');
  console.log('     ' + THEME.command('/rad-ui-start'));
  console.log('');

  console.log('  ' + THEME.body('Full guide: ') + THEME.command('https://github.com/MetalHexx/RadOrchestration/blob/main/docs/getting-started.md'));
  console.log('');

  divider();

  if (driftHint) {
    // DD-4: drift line is diagnostic — emit on stderr, not stdout.
    let line;
    if (typeof driftHint === 'object' && driftHint.installedVersion && driftHint.pluginVersion) {
      line = `[drift] run /plugin update rad-orchestration to sync (plugin v${driftHint.pluginVersion}, standard v${driftHint.installedVersion})\n`;
    } else {
      line = '[drift] run /plugin update rad-orchestration to sync\n';
    }
    process.stderr.write(line);
  }
}
