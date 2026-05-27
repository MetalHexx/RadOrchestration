import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { resolveCatalogRoot } from '@/lib/action-events-fs';

export const dynamic = 'force-dynamic';

export async function GET() {
  const fp = path.join(resolveCatalogRoot(), 'custom', 'README.md');
  if (!fs.existsSync(fp)) return NextResponse.json({ error: 'README not found' }, { status: 404 });
  try {
    const content = fs.readFileSync(fp, 'utf8');
    return NextResponse.json({ content }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Read failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
