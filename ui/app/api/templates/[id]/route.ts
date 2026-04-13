import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { getWorkspaceRoot } from '@/lib/path-resolver';
import { readConfig } from '@/lib/fs-reader';
import {
  resolveTemplateDir,
  isValidTemplateId,
  readTemplateFile,
  writeTemplateFile,
  templateFileExists,
} from '@/lib/template-api-helpers';
import { parseYaml } from '@/lib/yaml-parser';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

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
    const root = getWorkspaceRoot();
    const config = await readConfig(root);
    const templateDir = resolveTemplateDir(root, config);
    const result = await readTemplateFile(templateDir, id);

    if (result === null) {
      return NextResponse.json({ error: `Template not found: ${id}` }, { status: 404 });
    }

    return NextResponse.json({ rawYaml: result.rawYaml, definition: result.definition }, { status: 200 });
  } catch (err) {
    console.error(`GET /api/templates/${id} error:`, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  if (!isValidTemplateId(id)) {
    return NextResponse.json(
      {
        error:
          'Invalid template ID — must contain only alphanumeric characters, hyphens, and underscores',
      },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { content } =
    body !== null && typeof body === 'object'
      ? (body as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  if (typeof content !== 'string' || !content || content.trim() === '') {
    return NextResponse.json({ error: 'Missing or invalid field: content' }, { status: 400 });
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
    if (!exists) {
      return NextResponse.json({ error: `Template not found: ${id}` }, { status: 404 });
    }

    await writeTemplateFile(templateDir, id, content);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error(`PUT /api/templates/${id} error:`, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
