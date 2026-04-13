import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { getWorkspaceRoot } from '@/lib/path-resolver';
import { readConfig } from '@/lib/fs-reader';
import {
  resolveTemplateDir,
  isValidTemplateId,
  listTemplateFiles,
  writeTemplateFile,
  templateFileExists,
} from '@/lib/template-api-helpers';
import { parseYaml } from '@/lib/yaml-parser';

export async function GET() {
  try {
    const root = getWorkspaceRoot();
    const config = await readConfig(root);
    const templateDir = resolveTemplateDir(root, config);
    const templates = await listTemplateFiles(templateDir);
    return NextResponse.json({ templates }, { status: 200 });
  } catch (err) {
    console.error('GET /api/templates error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { id, content } =
    body !== null && typeof body === 'object'
      ? (body as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  if (typeof id !== 'string' || id === '') {
    return NextResponse.json({ error: 'Missing or invalid field: id' }, { status: 400 });
  }

  if (typeof content !== 'string' || !content || content.trim() === '') {
    return NextResponse.json({ error: 'Missing or invalid field: content' }, { status: 400 });
  }

  if (!isValidTemplateId(id)) {
    return NextResponse.json(
      {
        error:
          'Invalid template ID — must contain only alphanumeric characters, hyphens, and underscores',
      },
      { status: 400 },
    );
  }

  try {
    parseYaml(content);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid YAML';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const root = getWorkspaceRoot();
    const config = await readConfig(root);
    const templateDir = resolveTemplateDir(root, config);

    const exists = await templateFileExists(templateDir, id);
    if (exists) {
      return NextResponse.json({ error: `Template already exists: ${id}` }, { status: 409 });
    }

    await writeTemplateFile(templateDir, id, content);
    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (err) {
    console.error('POST /api/templates error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
