import { NextResponse } from 'next/server';
import { readRegistry } from '@rad-orchestration/repo-registry';
import { getRegistryRoot } from '@/lib/path-resolver';
import { computeSnapshot } from '@/lib/registry/read-shape';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const root = getRegistryRoot();
    const reg = readRegistry({ root });
    return NextResponse.json(computeSnapshot(reg), { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: { code: 'INTERNAL', message, field: '' } }, { status: 500 });
  }
}
