import { NextRequest, NextResponse } from 'next/server';
import child_process from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

import type { GateApproveResponse, GateErrorResponse } from '@/types/state';
import { resolveProjectDir } from '@/lib/path-resolver';
import { readProjectState } from '@/lib/fs-reader';

export const dynamic = 'force-dynamic';

const ALLOWED_GATE_EVENTS: ReadonlySet<string> = new Set(['plan_approved', 'final_approved']);
const PROJECT_NAME_PATTERN = /^[A-Z0-9][A-Z0-9._-]*$/;

/**
 * Thin Promise wrapper around child_process.execFile that defers to
 * child_process.execFile at call time (not at import time), so that
 * node:test mock.method stubs can intercept it.
 */
function execFileP(
  file: string,
  args: string[],
  opts: { encoding: 'utf-8' }
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    child_process.execFile(file, args, opts, (err, result) => {
      if (err) {
        const execErr = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
        const enriched = Object.assign(err, {
          stdout: execErr.stdout ?? (result as unknown as { stdout?: string })?.stdout ?? '',
          stderr: execErr.stderr ?? (result as unknown as { stderr?: string })?.stderr ?? '',
        });
        reject(enriched);
      } else {
        resolve(result as unknown as { stdout: string; stderr: string });
      }
    });
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> | { name: string } }
): Promise<NextResponse<GateApproveResponse | GateErrorResponse>> {
  try {
    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body.' } satisfies GateErrorResponse,
        { status: 400 }
      );
    }

    const { event } = body as { event?: string };

    // Validate event whitelist
    if (!event || !ALLOWED_GATE_EVENTS.has(event)) {
      return NextResponse.json(
        { error: 'Invalid gate event. Allowed: plan_approved, final_approved.' } satisfies GateErrorResponse,
        { status: 400 }
      );
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const name = resolvedParams.name;

    // Validate project name format
    if (!PROJECT_NAME_PATTERN.test(name)) {
      return NextResponse.json(
        { error: 'Invalid project name format.' } satisfies GateErrorResponse,
        { status: 400 }
      );
    }

    // Resolve project directory and verify existence
    const projectDir = resolveProjectDir(name);

    const state = await readProjectState(projectDir);
    if (state === null) {
      return NextResponse.json(
        { error: 'Project not found.' } satisfies GateErrorResponse,
        { status: 404 }
      );
    }

    // Invoke the radorch CLI — it auto-resolves doc paths from state (FR-13).
    const radorchBin = path.join(os.homedir(), '.radorch', 'bin', 'radorch.mjs');
    const subcmd = event === 'plan_approved' ? 'plan' : 'final';
    const args = [radorchBin, 'gate', 'approve', subcmd, '--project-dir', projectDir];

    let stdout: string;
    try {
      const r = await execFileP(process.execPath, args, { encoding: 'utf-8' });
      stdout = r.stdout;
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      // CLI may exit non-zero with a valid envelope on stdout; try to parse first.
      stdout = e.stdout ?? '';
      if (!stdout) {
        return NextResponse.json(
          { error: 'Gate CLI failed.', detail: e.stderr ?? e.message ?? 'unknown' } satisfies GateErrorResponse,
          { status: 500 },
        );
      }
    }

    // Parse the framework envelope: { ok, data: { success, action, mutations_applied, error }, exit_code }
    let parsed: { ok?: boolean; data?: { success?: boolean; action?: string; mutations_applied?: string[]; error?: { message?: string } }; error?: { message?: string } };
    try { parsed = JSON.parse(stdout!); }
    catch {
      return NextResponse.json(
        { error: 'Invalid CLI response.', detail: stdout! } satisfies GateErrorResponse,
        { status: 500 },
      );
    }

    const pipeline = parsed.data;
    if (pipeline?.success === true) {
      return NextResponse.json(
        { success: true, action: pipeline.action ?? '', mutations_applied: pipeline.mutations_applied ?? [] } satisfies GateApproveResponse,
        { status: 200 },
      );
    }

    const detail = pipeline?.error?.message ?? parsed.error?.message ?? stdout!;
    return NextResponse.json(
      { error: 'Pipeline rejected the event.', detail } satisfies GateErrorResponse,
      { status: 409 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json(
      { error: message } satisfies GateErrorResponse,
      { status: 500 }
    );
  }
}
