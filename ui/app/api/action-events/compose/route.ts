import { NextRequest, NextResponse } from 'next/server';
import { composeActionPrompt, composeOrphanEventPrompt } from '../../../../../cli/src/lib/pipeline-engine/composer';
import { resolveCatalogRoot } from '@/lib/action-events-fs';

export const dynamic = 'force-dynamic';

interface ComposePayload {
  kind?: string;
  name?: string;
  completion_event?: string | null;
  overlay?: Record<string, string>;
}

export async function POST(req: NextRequest) {
  let body: ComposePayload;
  try { body = (await req.json()) as ComposePayload; } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { kind, name, completion_event, overlay } = body;
  if (kind !== 'action' && kind !== 'event') return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
  if (typeof name !== 'string' || !/^[a-z0-9_]+$/.test(name)) return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
  try {
    const catalogRoot = resolveCatalogRoot();
    let prompt: string;
    if (kind === 'action') {
      prompt = composeActionPrompt({ actionName: name, completionEvent: completion_event ?? null, catalogRoot, overlay });
    } else {
      prompt = composeOrphanEventPrompt({ eventName: name, catalogRoot, overlay });
    }
    return NextResponse.json({ prompt }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Compose failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
