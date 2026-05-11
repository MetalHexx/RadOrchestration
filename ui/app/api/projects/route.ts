import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { discoverProjects } from '@/lib/fs-reader';

export async function GET() {
  try {
    const projects = await discoverProjects();

    return NextResponse.json({ projects }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
