import { NextResponse } from 'next/server';
import * as registry from '@rad-orchestration/repo-registry';

export const dynamic = 'force-dynamic';

export async function GET() {
  const operations = Object.keys(registry).filter((k) => typeof (registry as Record<string, unknown>)[k] === 'function');
  return NextResponse.json({ ok: true, operations }, { status: 200 });
}
