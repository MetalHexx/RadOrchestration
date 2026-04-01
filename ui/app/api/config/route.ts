import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { getWorkspaceRoot } from '@/lib/path-resolver';
import { readConfigWithRaw } from '@/lib/fs-reader';

export async function GET() {
  try {
    const root = getWorkspaceRoot();
    const { config, rawYaml } = await readConfigWithRaw(root);

    return NextResponse.json({ config, rawYaml }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
