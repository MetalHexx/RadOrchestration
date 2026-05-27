import { NextRequest, NextResponse } from 'next/server';
import { readShippedEntry, resolveCatalogRoot } from '@/lib/action-events-fs';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { kind: string; name: string } }) {
  const { kind, name } = params;
  if (kind !== 'action' && kind !== 'event') {
    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
  }
  if (!/^[a-z0-9_]+$/.test(name)) {
    return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
  }
  try {
    const entry = readShippedEntry(resolveCatalogRoot(), kind, name);
    if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(entry, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
