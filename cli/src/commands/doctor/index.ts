import { createRequire } from 'node:module';
import { defineCommand } from '../../framework/command.js';
import type { CommandContext } from '../../framework/context.js';
import { resolveInstallRoot } from '../../lib/paths.js';
import { renderBanner } from '../../framework/banner.js';
import type { CheckResult } from './checks.js';
import { runEnvironmentChecks, runInstallChecks, runRegistryChecks, runPluginChecks } from './checks.js';

const require_ = createRequire(import.meta.url);
const pkg = require_('../../../package.json') as { version: string };

export interface DoctorResult {
  all_passed: boolean;
  checks: CheckResult[];
}

export async function runDoctor(opts: { env: NodeJS.ProcessEnv }): Promise<DoctorResult> {
  const root = resolveInstallRoot(opts.env);
  const checks: CheckResult[] = [
    ...(await runEnvironmentChecks()),
    ...(await runInstallChecks(root)),
    ...(await runRegistryChecks(root)),
    ...(await runPluginChecks({ root, localVersion: pkg.version })),
  ];
  const all_passed = !checks.some((c) => c.status === 'fail');
  return { all_passed, checks };
}

function renderInteractive(result: DoctorResult, ctx: CommandContext): void {
  if (!ctx.ux.isTTY || ctx.ux.nonInteractive || ctx.ux.json) return;
  const lookup = { pass: ctx.theme.success('PASS'), warn: ctx.theme.warning('WARN'), fail: ctx.theme.error('FAIL') } as const;
  const seen = new Set<string>();
  for (const c of result.checks) {
    if (!seen.has(c.category)) {
      ctx.stderr.write(`\n${ctx.theme.heading(c.category)}\n`);
      seen.add(c.category);
    }
    ctx.stderr.write(`  [${lookup[c.status]}] ${c.name}${c.detail ? ' — ' + c.detail : ''}\n`);
  }
  ctx.stderr.write(`\nSummary: ${result.all_passed ? ctx.theme.success('all passed') : ctx.theme.error('failures present')}\n`);
}

export const doctorCommand = defineCommand({
  name: 'doctor',
  description: 'Run health checks across environment, install integrity, and registry shape',
  args: {},
  flags: {},
  handler: async ({ ctx }: { ctx: CommandContext }) => {
    renderBanner({ stream: ctx.stderr, isTTY: ctx.ux.isTTY, nonInteractive: ctx.ux.nonInteractive, noColor: ctx.ux.noColor, json: ctx.ux.json });
    const result = await runDoctor({ env: ctx.env });
    renderInteractive(result, ctx);
    return result;
  },
  // Doctor's exit code is computed from check results, not error type.
  // exits 0 on no failures (warns allowed), 1 on any failure, 2 for unexpected internal errors (framework catch branch).
  mapResult: (r: DoctorResult) => ({
    ok: true as const,
    data: r,
    exit_code: r.all_passed ? 0 : 1,
  }),
});
