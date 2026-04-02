import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { access, constants } from 'node:fs/promises';
import { getWorkspaceRoot } from '@/lib/path-resolver';
import { getConfigPath, readConfigWithRaw, writeConfig } from '@/lib/fs-reader';
import { parseYaml, stringifyYaml } from '@/lib/yaml-parser';
import { validateConfig } from '@/lib/config-validator';
import type { ConfigPutRequest } from '@/types/config';

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

export async function PUT(request: Request) {
  let body: ConfigPutRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.mode !== 'form' && body.mode !== 'raw') {
    return NextResponse.json(
      { error: 'Invalid mode — must be "form" or "raw"' },
      { status: 400 },
    );
  }

  const root = getWorkspaceRoot();
  let yamlString: string;

  if (body.mode === 'form') {
    if (!body.config) {
      return NextResponse.json(
        { error: 'Missing config object for form mode' },
        { status: 400 },
      );
    }

    let errors;
    try {
      errors = validateConfig(body.config);
    } catch {
      return NextResponse.json(
        { error: 'Invalid config structure' },
        { status: 400 },
      );
    }
    if (Object.keys(errors).length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 },
      );
    }

    yamlString = stringifyYaml(body.config);
  } else {
    if (!body.rawYaml || typeof body.rawYaml !== 'string') {
      return NextResponse.json(
        { error: 'Missing rawYaml string for raw mode' },
        { status: 400 },
      );
    }

    try {
      parseYaml(body.rawYaml);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: `Invalid YAML: ${message}` },
        { status: 400 },
      );
    }

    yamlString = body.rawYaml;
  }

  // Pre-check: verify config file is writable
  const configPath = getConfigPath(root);
  try {
    await access(configPath, constants.W_OK);
  } catch {
    return NextResponse.json(
      { error: 'Configuration file is not writable — check file permissions or volume mount' },
      { status: 403 },
    );
  }

  try {
    await writeConfig(root, yamlString);
    const readBack = await readConfigWithRaw(root);
    return NextResponse.json(
      { success: true, config: readBack.config },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to write config: ${message}` },
      { status: 500 },
    );
  }
}