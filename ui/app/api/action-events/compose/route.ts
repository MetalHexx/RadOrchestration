import { NextRequest, NextResponse } from 'next/server';
import { runCli } from '@/lib/cli-shell';

export const dynamic = 'force-dynamic';

type ComposeMode = 'standalone' | 'runtime-orphan';

interface ComposePayload {
  kind?: string;
  name?: string;
  completion_event?: string | null;
  overlay?: Record<string, string>;
  mode?: string;
}

interface ComposeCliData {
  prompt: string;
  has_custom_instructions: boolean;
}

export async function POST(req: NextRequest) {
  let body: ComposePayload;
  try {
    body = (await req.json()) as ComposePayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { kind, name, completion_event, overlay, mode } = body;
  if (kind !== 'action' && kind !== 'event') {
    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
  }
  if (typeof name !== 'string' || !/^[a-z0-9_]+$/.test(name)) {
    return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
  }
  let resolvedMode: ComposeMode | undefined;
  if (mode !== undefined) {
    if (mode !== 'standalone' && mode !== 'runtime-orphan') {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }
    if (mode === 'runtime-orphan' && kind !== 'event') {
      return NextResponse.json({ error: "mode 'runtime-orphan' is only valid for kind 'event'" }, { status: 400 });
    }
    resolvedMode = mode;
  }
  const args: string[] = ['action-events', 'compose', '--kind', kind, '--name', name];
  if (typeof completion_event === 'string') args.push('--completion-event', completion_event);
  if (resolvedMode !== undefined) args.push('--mode', resolvedMode);
  const stdinPayload = JSON.stringify({ overlay: overlay ?? {} });
  const { envelope } = await runCli<ComposeCliData>({ args, stdin: stdinPayload });
  if (envelope.ok === true) {
    return NextResponse.json({
      prompt: envelope.data.prompt,
      has_custom_instructions: envelope.data.has_custom_instructions,
    }, { status: 200 });
  }
  return NextResponse.json({ error: envelope.error.message }, { status: 500 });
}
