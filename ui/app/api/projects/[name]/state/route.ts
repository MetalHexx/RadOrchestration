import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { getWorkspaceRoot, resolveProjectDir } from '@/lib/path-resolver';
import { readConfig, readProjectState } from '@/lib/fs-reader';
import { normalizeState } from '@/lib/normalizer';

export async function GET(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const root = getWorkspaceRoot();
    const config = await readConfig(root);
    const projectDir = resolveProjectDir(root, config.projects.base_path, params.name);
    const raw = await readProjectState(projectDir);

    if (raw === null) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const state = normalizeState(raw);
    return NextResponse.json({ state }, { status: 200 });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: `Malformed state.json: ${err.message}` },
        { status: 422 }
      );
    }

    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
