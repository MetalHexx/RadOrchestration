import { NextResponse } from 'next/server';
import { readRegistry, addRepo, addGroupMember } from '@rad-orchestration/repo-registry';
import { getRegistryRoot } from '@/lib/path-resolver';
import { computeRepo } from '@/lib/registry/read-shape';
import { RegistryError, statusForCode } from '@/lib/registry/errors';
import {
  validateSlug, validateRequired, validateDirectory, validateUniqueName, normalizeRemote,
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

export async function POST(request: Request) {
  const root = getRegistryRoot();
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const slug = String(body.slug ?? '');
    const remote = normalizeRemote(String(body.remote ?? ''));
    const defaultBranch = String(body.defaultBranch ?? '');
    const description = String(body.description ?? '');
    const localPath = String(body.localPath ?? '');
    const groups = Array.isArray(body.groups) ? (body.groups as string[]) : [];

    validateSlug(slug);
    const reg = readRegistry({ root });
    validateUniqueName(reg, slug);
    validateRequired(remote, 'remote');
    validateRequired(defaultBranch, 'defaultBranch');
    validateRequired(description, 'description');
    validateRequired(localPath, 'localPath');
    validateDirectory(localPath, 'localPath');
    for (const g of groups) {
      if (!(g in reg.repoGroups)) {
        throw new RegistryError('NOT_FOUND', `Group '${g}' does not exist.`, 'groups');
      }
    }

    addRepo({ root, name: slug, identity: { remote, default_branch: defaultBranch, description }, localPath });
    for (const g of groups) addGroupMember({ root, group: g, repo: slug });

    return NextResponse.json(computeRepo(readRegistry({ root }), slug), { status: 201 });
  } catch (err) {
    return fail(err);
  }
}
