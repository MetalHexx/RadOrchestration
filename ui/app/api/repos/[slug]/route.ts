import { NextResponse } from 'next/server';
import {
  readRegistry,
  editRepo, bindRepo, addGroupMember, removeGroupMember,
  removeRepo,
} from '@rad-orchestration/repo-registry';
import { getRegistryRoot } from '@/lib/path-resolver';
import { computeRepo, computeSnapshot } from '@/lib/registry/read-shape';
import { RegistryError, statusForCode } from '@/lib/registry/errors';
import {
  validateRequired, validateDirectory, normalizeRemote,
} from '@/lib/registry/validate';

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
    if (!(params.slug in reg.repos)) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: `Repo '${params.slug}' was not found.`, field: 'slug' } },
        { status: 404 });
    }
    return NextResponse.json(computeRepo(reg, params.slug), { status: 200 });
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
    if (!(slug in reg.repos)) {
      throw new RegistryError('NOT_FOUND', `Repo '${slug}' was not found.`, 'slug');
    }
    const current = reg.repos[slug];

    const remote = body.remote === undefined ? undefined : normalizeRemote(String(body.remote));
    const defaultBranch = body.defaultBranch === undefined ? undefined : String(body.defaultBranch);
    // description: omit = unchanged, empty = REQUIRED reject (DD per-entity mechanics)
    const description = 'description' in body ? String(body.description) : undefined;
    if (remote !== undefined) validateRequired(remote, 'remote');
    if (defaultBranch !== undefined) validateRequired(defaultBranch, 'defaultBranch');
    if (description !== undefined) validateRequired(description, 'description');

    const edit: { description?: string; remote?: string; defaultBranch?: string } = {};
    if (remote !== undefined && remote !== current.remote) edit.remote = remote;
    if (defaultBranch !== undefined && defaultBranch !== current.default_branch) edit.defaultBranch = defaultBranch;
    if (description !== undefined && description !== current.description) edit.description = description;
    if (Object.keys(edit).length > 0) editRepo({ root, name: slug, ...edit });

    // bind: present-and-different = re-point; omit = unchanged (never clears)
    if ('localPath' in body && body.localPath !== undefined) {
      const localPath = String(body.localPath);
      validateRequired(localPath, 'localPath');
      validateDirectory(localPath, 'localPath');
      if (localPath !== reg.localPaths[slug]) bindRepo({ root, name: slug, localPath });
    }

    // membership diff: client sends the COMPLETE desired set
    const desired = Array.isArray(body.groups) ? (body.groups as string[]) : [];
    const currentGroups = Object.entries(reg.repoGroups)
      .filter(([, g]) => g.members.includes(slug)).map(([g]) => g);
    for (const g of desired) {
      if (!(g in reg.repoGroups)) throw new RegistryError('NOT_FOUND', `Group '${g}' does not exist.`, 'groups');
    }
    for (const g of desired) if (!currentGroups.includes(g)) addGroupMember({ root, group: g, repo: slug });
    for (const g of currentGroups) if (!desired.includes(g)) removeGroupMember({ root, group: g, repo: slug });

    return NextResponse.json(computeSnapshot(readRegistry({ root })).repos.find(r => r.slug === slug), { status: 200 });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: { slug: string } }) {
  const root = getRegistryRoot();
  try {
    const reg = readRegistry({ root });
    if (!(params.slug in reg.repos)) {
      throw new RegistryError('NOT_FOUND', `Repo '${params.slug}' was not found.`, 'slug');
    }
    removeRepo({ root, name: params.slug });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    return fail(err);
  }
}
