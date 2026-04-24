import { NextRequest, NextResponse } from 'next/server';

import { getWorkspaceRoot } from '@/lib/path-resolver';
import { readConfig, discoverProjects } from '@/lib/fs-reader';
import { invokeLaunchClaudeProject } from '@/lib/launch-claude-project-invoke';

export const dynamic = 'force-dynamic';

const PROJECT_NAME_PATTERN = /^[A-Z0-9][A-Z0-9_-]*$/;

type StartAction = 'start-planning' | 'start-brainstorming';
const ALLOWED_ACTIONS: ReadonlySet<string> = new Set<StartAction>([
  'start-planning',
  'start-brainstorming',
]);

/**
 * Server-side prompt composition. The literal strings live here — not in
 * the browser — so a modified client cannot launch Claude with arbitrary
 * slash commands. (AD-4)
 */
function composePrompt(action: StartAction, projectName: string): string {
  if (action === 'start-planning') {
    return `/rad-plan Start planning ${projectName}`;
  }
  return `/brainstorm ${projectName}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { name: string } }
): Promise<NextResponse> {
  // 1. Validate project name format (AD-5)
  const name = params.name;
  if (!PROJECT_NAME_PATTERN.test(name)) {
    return NextResponse.json({ error: 'Invalid project name format.' }, { status: 400 });
  }

  // 2. Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const action = (body as { action?: string } | null)?.action;
  if (!action || !ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json(
      { error: 'Invalid action. Allowed: start-planning, start-brainstorming.' },
      { status: 400 }
    );
  }

  // 3. Resolve workspace root (FR-7, NFR-3)
  let workspaceRoot: string;
  try {
    workspaceRoot = getWorkspaceRoot();
  } catch {
    return NextResponse.json(
      { error: 'Workspace root is not configured.' },
      { status: 500 }
    );
  }

  // 4. Validate project exists under the configured base path (AD-5)
  let projectExists = false;
  try {
    const config = await readConfig(workspaceRoot);
    const projects = await discoverProjects(workspaceRoot, config.projects.base_path);
    projectExists = projects.some((p) => p.name === name);
  } catch {
    return NextResponse.json(
      { error: 'Failed to enumerate projects.' },
      { status: 500 }
    );
  }
  if (!projectExists) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }

  // 5. Compose prompt server-side and invoke launcher (FR-4, FR-5, AD-3, AD-4)
  const prompt = composePrompt(action as StartAction, name);
  const result = await invokeLaunchClaudeProject({ workspaceRoot, prompt });

  if (!result.success) {
    // NFR-3: do not echo absolute paths or env values; surface launcher
    // message verbatim (launcher never includes cwd-level detail).
    return NextResponse.json(
      { success: false, error: result.error ?? 'Launcher failed.' },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { success: true, platform: result.platform },
    { status: 200 }
  );
}
