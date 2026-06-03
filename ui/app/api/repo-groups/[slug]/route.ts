import { NextResponse } from 'next/server';
import {
  readRegistry,
  editGroup, addGroupMember, removeGroupMember, deleteGroup,
} from '@rad-orchestration/repo-registry';
import { getRegistryRoot } from '@/lib/path-resolver';
import { computeRepoGroup } from '@/lib/registry/read-shape';
import { RegistryError, statusForCode } from '@/lib/registry/errors';
import { validateRequired } from '@/lib/registry/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function fail(err: unknown) {
  if (err instanceof RegistryError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, field: err.field } },
      { status: statusForCode(err.code) });
  }
  const message = err instanceof Error ? err.message : 'Internal server error';
  return NextResponse.json({ error: { code: 'INTERNAL', message, field: '' } }, { status: 500 });
}

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  try {
    const reg = readRegistry({ root: getRegistryRoot() });
    if (!(params.slug in reg.repoGroups)) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: `Repo-group '${params.slug}' was not found.`, field: 'slug' } },
        { status: 404 });
    }
    return NextResponse.json(computeRepoGroup(reg, params.slug), { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: { code: 'INTERNAL', message, field: '' } }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { slug: string } }) {
  const root = getRegistryRoot();
  try {
    const slug = params.slug;
    const body = (await request.json()) as Record<string, unknown>;
    if ('slug' in body && body.slug !== slug) {
      throw new RegistryError('IMMUTABLE_SLUG', 'A slug cannot be changed on save.', 'slug');
    }
    const reg = readRegistry({ root });
    if (!(slug in reg.repoGroups)) {
      throw new RegistryError('NOT_FOUND', `Repo-group '${slug}' was not found.`, 'slug');
    }
    const description = String(body.description ?? '');
    validateRequired(description, 'description');
    const desired = Array.isArray(body.members) ? (body.members as string[]) : [];
    for (const m of desired) {
      if (!(m in reg.repos)) throw new RegistryError('NOT_FOUND', `Repo '${m}' does not exist.`, 'members');
    }

    editGroup({ root, name: slug, description });
    const currentMembers = reg.repoGroups[slug].members;
    for (const m of desired) if (!currentMembers.includes(m)) addGroupMember({ root, group: slug, repo: m });
    for (const m of currentMembers) if (!desired.includes(m)) removeGroupMember({ root, group: slug, repo: m });

    return NextResponse.json(computeRepoGroup(readRegistry({ root }), slug), { status: 200 });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: { slug: string } }) {
  const root = getRegistryRoot();
  try {
    const reg = readRegistry({ root });
    if (!(params.slug in reg.repoGroups)) {
      throw new RegistryError('NOT_FOUND', `Repo-group '${params.slug}' was not found.`, 'slug');
    }
    deleteGroup({ root, name: params.slug });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    return fail(err);
  }
}
