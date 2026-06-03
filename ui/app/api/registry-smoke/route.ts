import { NextResponse } from 'next/server';
import * as registry from '@rad-orchestration/repo-registry';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const operations = Object.keys(registry).filter((k) => typeof (registry as Record<string, unknown>)[k] === 'function');
    return NextResponse.json({ ok: true, operations }, { status: 200 });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
