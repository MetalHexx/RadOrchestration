import { NextResponse } from 'next/server';
import { readRegistry } from '@rad-orchestration/repo-registry';
import { getRegistryRoot } from '@/lib/path-resolver';
import { computeRepoGroup } from '@/lib/registry/read-shape';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const reg = readRegistry({ root: getRegistryRoot() });
  if (!(params.slug in reg.repoGroups)) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: `Repo-group '${params.slug}' was not found.`, field: 'slug' } },
      { status: 404 });
  }
  return NextResponse.json(computeRepoGroup(reg, params.slug), { status: 200 });
}
