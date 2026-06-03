import { NextResponse } from 'next/server';
import { readRegistry, createGroup } from '@rad-orchestration/repo-registry';
import { getRegistryRoot } from '@/lib/path-resolver';
import { computeRepoGroup } from '@/lib/registry/read-shape';
import { RegistryError, statusForCode } from '@/lib/registry/errors';
import { validateSlug, validateRequired, validateUniqueName } from '@/lib/registry/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const root = getRegistryRoot();
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const slug = String(body.slug ?? '');
    const description = String(body.description ?? '');
    const members = Array.isArray(body.members) ? (body.members as string[]) : [];

    validateSlug(slug);
    const reg = readRegistry({ root });
    validateUniqueName(reg, slug);
    validateRequired(description, 'description');
    const seen = new Set<string>();
    for (const m of members) {
      if (!(m in reg.repos)) throw new RegistryError('NOT_FOUND', `Repo '${m}' does not exist.`, 'members');
      if (seen.has(m)) throw new RegistryError('NAME_TAKEN', `Duplicate member '${m}'.`, 'members');
      seen.add(m);
    }

    createGroup({ root, name: slug, members, description });
    return NextResponse.json(computeRepoGroup(readRegistry({ root }), slug), { status: 201 });
  } catch (err) {
    if (err instanceof RegistryError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message, field: err.field } },
        { status: statusForCode(err.code) });
    }
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: { code: 'INTERNAL', message, field: '' } }, { status: 500 });
  }
}
