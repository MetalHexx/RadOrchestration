import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

import type { GateApproveResponse, GateErrorResponse } from '@/types/state';
import { getWorkspaceRoot, resolveProjectDir } from '@/lib/path-resolver';
import { readConfig, readProjectState, resolveOrchRoot } from '@/lib/fs-reader';

export const dynamic = 'force-dynamic';

const execFileAsync = promisify(execFile);

const ALLOWED_GATE_EVENTS: ReadonlySet<string> = new Set(['plan_approved', 'final_approved']);
const PROJECT_NAME_PATTERN = /^[A-Z0-9][A-Z0-9_-]*$/;

export async function POST(
  request: NextRequest,
  { params }: { params: { name: string } }
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

    const name = params.name;

    // Validate project name format
    if (!PROJECT_NAME_PATTERN.test(name)) {
      return NextResponse.json(
        { error: 'Invalid project name format.' } satisfies GateErrorResponse,
        { status: 400 }
      );
    }

    // Resolve project directory and verify existence
    const root = getWorkspaceRoot();
    const config = await readConfig(root);
    const projectDir = resolveProjectDir(root, config.projects.base_path, name);

    const state = await readProjectState(projectDir);
    if (state === null) {
      return NextResponse.json(
        { error: 'Project not found.' } satisfies GateErrorResponse,
        { status: 404 }
      );
    }

    // Resolve pipeline script path and invoke
    const pipelineScript = path.resolve(root, resolveOrchRoot(config), 'skills', 'orchestration', 'scripts', 'pipeline.js');

    const relativeProjectDir = path.relative(root, projectDir);

    // Build --context payload so the pipeline pre-read doesn't try to derive
    // doc_path itself (which causes a doubled-path bug on workspace-relative paths).
    const contextPayload: Record<string, string> = {};
    if (event === 'plan_approved') {
      const steps = state.planning?.steps;
      // steps is an array in v3 format; master_plan is the last entry (index 4)
      const masterPlanStep = Array.isArray(steps)
        ? steps.find((s) => s.name === 'master_plan')
        : (steps as Record<string, { doc_path?: string | null }>)?.['master_plan'];
      const docPath = masterPlanStep?.doc_path;
      if (docPath) contextPayload.doc_path = docPath;
    } else if (event === 'final_approved') {
      const docPath = state.final_review?.doc_path;
      if (docPath) contextPayload.doc_path = docPath;
    }

    const pipelineArgs = [
      pipelineScript,
      '--event', event,
      '--project-dir', relativeProjectDir,
    ];
    if (Object.keys(contextPayload).length > 0) {
      pipelineArgs.push('--context', JSON.stringify(contextPayload));
    }

    let stdout: string;
    try {
      const result = await execFileAsync(
        process.execPath,
        pipelineArgs,
        { encoding: 'utf-8', cwd: root }
      );
      stdout = result.stdout;
    } catch (err: unknown) {
      const execErr = err as { stderr?: string; message?: string };
      return NextResponse.json(
        {
          error: 'Pipeline execution failed.',
          detail: execErr.stderr || execErr.message || 'Unknown error',
        } satisfies GateErrorResponse,
        { status: 500 }
      );
    }

    // Parse pipeline output
    let parsed: { success: boolean; action?: string; mutations_applied?: string[] };
    try {
      parsed = JSON.parse(stdout);
    } catch {
      return NextResponse.json(
        { error: 'Invalid pipeline response.', detail: stdout } satisfies GateErrorResponse,
        { status: 500 }
      );
    }

    if (parsed.success === true) {
      return NextResponse.json(
        {
          success: true,
          action: parsed.action ?? '',
          mutations_applied: parsed.mutations_applied ?? [],
        } satisfies GateApproveResponse,
        { status: 200 }
      );
    }

    // Pipeline rejected the event
    return NextResponse.json(
      { error: 'Pipeline rejected the event.', detail: stdout } satisfies GateErrorResponse,
      { status: 409 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json(
      { error: message } satisfies GateErrorResponse,
      { status: 500 }
    );
  }
}
