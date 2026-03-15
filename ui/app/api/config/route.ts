import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { getWorkspaceRoot } from '@/lib/path-resolver';
import { readConfig } from '@/lib/fs-reader';
import { transformConfig } from '@/lib/config-transformer';

export async function GET() {
  try {
    const root = getWorkspaceRoot();
    const rawConfig = await readConfig(root);
    const config = transformConfig(rawConfig);

    return NextResponse.json({ config }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
