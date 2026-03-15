import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { getWorkspaceRoot, resolveDocPath, resolveProjectDir } from '@/lib/path-resolver';
import { readConfig, readDocument } from '@/lib/fs-reader';
import { parseDocument } from '@/lib/markdown-parser';

export async function GET(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  const pathParam = request.nextUrl.searchParams.get('path');

  if (!pathParam) {
    return NextResponse.json(
      { error: 'Missing required query parameter: path' },
      { status: 400 }
    );
  }

  // Reject paths containing ".." to prevent path traversal attempts
  if (pathParam.includes('..')) {
    return NextResponse.json(
      { error: 'Invalid path' },
      { status: 400 }
    );
  }

  try {
    const root = getWorkspaceRoot();
    const config = await readConfig(root);
    const projectDir = resolveProjectDir(root, config.projects.base_path, params.name);
    const absPath = resolveDocPath(root, config.projects.base_path, params.name, pathParam);

    // Defense-in-depth: verify resolved path stays within the project directory
    if (!absPath.startsWith(projectDir)) {
      return NextResponse.json(
        { error: 'Invalid path' },
        { status: 400 }
      );
    }
    const raw = await readDocument(absPath);
    const { frontmatter, content } = parseDocument(raw);

    return NextResponse.json({ frontmatter, content, filePath: absPath }, { status: 200 });
  } catch (err) {
    const isNotFound =
      err instanceof Error &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT';

    if (isNotFound) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
