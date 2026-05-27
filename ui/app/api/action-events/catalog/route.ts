import { NextResponse } from 'next/server';
import { listCatalogEntries, resolveCatalogRoot } from '@/lib/action-events-fs';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const entries = listCatalogEntries(resolveCatalogRoot());
    return NextResponse.json({ entries }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
