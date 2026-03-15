import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { getWorkspaceRoot } from '@/lib/path-resolver';
import { readConfig, discoverProjects } from '@/lib/fs-reader';

export async function GET() {
  try {
    const root = getWorkspaceRoot();
    const config = await readConfig(root);
    const projects = await discoverProjects(root, config.projects.base_path);

    return NextResponse.json({ projects }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
