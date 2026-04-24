import assert from 'node:assert/strict';
import { invokeLaunchClaudeProject } from './launch-claude-project-invoke';

async function runTests() {
  // Happy path — dry-run env propagates to script, returns success JSON.
  {
    process.env.LAUNCH_CLAUDE_PROJECT_DRY_RUN = '1';
    const result = await invokeLaunchClaudeProject({
      workspaceRoot: process.cwd(),
      prompt: '/brainstorm FOO',
    });
    assert.equal(result.success, true);
    assert.equal(typeof result.platform, 'string');
    assert.equal(result.permissionMode, 'auto');
    console.log('✓ happy path → success with platform + permissionMode');
  }

  // Invalid permission mode is surfaced as { success: false, error }.
  {
    process.env.LAUNCH_CLAUDE_PROJECT_DRY_RUN = '1';
    const result = await invokeLaunchClaudeProject({
      workspaceRoot: process.cwd(),
      prompt: '/brainstorm FOO',
      permissionMode: 'bogus' as unknown as 'auto',
    });
    assert.equal(result.success, false);
    assert.match(result.error ?? '', /Invalid --permission-mode/);
    console.log('✓ invalid permission mode → structured failure');
  }

  // Missing required args is surfaced as { success: false, error }.
  {
    process.env.LAUNCH_CLAUDE_PROJECT_DRY_RUN = '1';
    const result = await invokeLaunchClaudeProject({
      workspaceRoot: '',
      prompt: '',
    });
    assert.equal(result.success, false);
    assert.match(result.error ?? '', /Missing required args/);
    console.log('✓ missing args → structured failure');
  }

  console.log('\nAll launch-claude-project-invoke tests passed');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
