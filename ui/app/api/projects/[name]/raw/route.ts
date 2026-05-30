import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { resolveDocPath, resolveProjectDir } from '@/lib/path-resolver';
import { readDocument } from '@/lib/fs-reader';

export async function GET(
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

  try {
    const projectDir = resolveProjectDir(params.name);
    const absPath = resolveDocPath(params.name, pathParam);
    if (!absPath.startsWith(projectDir)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }
    const raw = await readDocument(absPath);
    return new NextResponse(raw, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'content-security-policy':
          "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data:",
      },
    });
  } catch (err) {
    const isNotFound =
      err instanceof Error && 'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT';
    if (isNotFound) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
