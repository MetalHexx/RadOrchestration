import { NextRequest, NextResponse } from 'next/server';
import { runCli } from '@/lib/cli-shell';

export const dynamic = 'force-dynamic';

interface ComposePayload {
  kind?: string;
  name?: string;
  completion_event?: string | null;
  overlay?: Record<string, string>;
}

export async function POST(req: NextRequest) {
  let body: ComposePayload;
  try {
    body = (await req.json()) as ComposePayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { kind, name, completion_event, overlay } = body;
  if (kind !== 'action' && kind !== 'event') {
    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
  }
  if (typeof name !== 'string' || !/^[a-z0-9_]+$/.test(name)) {
    return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
  }
  const args: string[] = ['action-events', 'compose', '--kind', kind, '--name', name];
  if (typeof completion_event === 'string') {
    args.push('--completion-event', completion_event);
  }
  const stdinPayload = JSON.stringify({ overlay: overlay ?? {} });
  const { envelope } = await runCli<{ prompt: string }>({ args, stdin: stdinPayload });
  if (envelope.ok === true) {
    return NextResponse.json({ prompt: envelope.data.prompt }, { status: 200 });
  }
  return NextResponse.json({ error: envelope.error.message }, { status: 500 });
}
