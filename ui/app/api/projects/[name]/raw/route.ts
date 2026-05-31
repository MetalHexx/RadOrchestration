import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { resolveDocPath, resolveProjectDir } from '@/lib/path-resolver';
import { readDocument } from '@/lib/fs-reader';

function scrollbarStyle(chrome: string | null): string {
  if (chrome === 'scroll') {
    // Paired with sandbox="allow-same-origin" so scrollbar styling is honored.
    // Match the app's scrollbars EXACTLY: native thin width, the app's translucent
    // thumb (--scrollbar-thumb), and — crucially — the app's near-black background
    // (--background) as the TRACK rather than transparent. A transparent track let
    // the artifact's content show through (no black rail, washed-out thumb); a
    // solid near-black rail gives the thumb the same dark backdrop it has app-wide.
    return '<style>html,body{scrollbar-width:thin !important;scrollbar-color:oklch(0.55 0 0 / 0.5) oklch(0.145 0 0) !important;}</style>';
  }
  if (chrome === 'hide') {
    return '<style>::-webkit-scrollbar{display:none !important;}html,body{scrollbar-width:none !important;-ms-overflow-style:none !important;}*{scrollbar-width:none;-ms-overflow-style:none;}</style>';
  }
  return '';
}

function injectStyle(body: string, style: string): string {
  if (!style) return body;
  const headClose = /<\/head>/i;
  if (headClose.test(body)) {
    return body.replace(headClose, `${style}</head>`);
  }
  return style + body;
}

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
    const chrome = request.nextUrl.searchParams.get('chrome');
    const body = injectStyle(raw, scrollbarStyle(chrome));
    return new NextResponse(body, {
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
