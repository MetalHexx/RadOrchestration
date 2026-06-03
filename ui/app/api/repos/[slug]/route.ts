import { NextResponse } from 'next/server';
import { readRegistry } from '@rad-orchestration/repo-registry';
import { getRegistryRoot } from '@/lib/path-resolver';
import { computeRepo } from '@/lib/registry/read-shape';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const reg = readRegistry({ root: getRegistryRoot() });
  if (!(params.slug in reg.repos)) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: `Repo '${params.slug}' was not found.`, field: 'slug' } },
      { status: 404 });
  }
  return NextResponse.json(computeRepo(reg, params.slug), { status: 200 });
}
