import { NextRequest, NextResponse } from 'next/server';
import { unlink } from 'node:fs/promises';

export const dynamic = 'force-dynamic';

import { resolveDocPath, resolveProjectDir } from '@/lib/path-resolver';

export async function POST(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  const pathParam = request.nextUrl.searchParams.get('path');

  if (!pathParam) {
    return NextResponse.json({ error: 'Missing required query parameter: path' }, { status: 400 });
  }
  if (pathParam.includes('..')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }
  // Restrict deletions to root-level artifact files (.md / .html) — the only
  // files the UI ever surfaces via deriveArtifacts. Without this, a crafted
  // request could unlink state.json, schemas, or nested files even though they
  // resolve inside the project dir.
  const isRootArtifact = !/[\\/]/.test(pathParam) && /\.(md|html)$/i.test(pathParam);
  if (!isRootArtifact) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  try {
    const projectDir = resolveProjectDir(params.name);
    const absPath = resolveDocPath(params.name, pathParam);
    if (!absPath.startsWith(projectDir)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }
    await unlink(absPath);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    const isNotFound =
      err instanceof Error && 'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT';
    if (isNotFound) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
