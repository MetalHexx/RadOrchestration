import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { resolveCatalogRoot } from '@/lib/action-events-fs';

export const dynamic = 'force-dynamic';

const KIND_RE = /^(action|event)$/;
const NAME_RE = /^[a-z0-9_]+$/;
const SLOT_RE = /^(pre|post)$/;

interface Params { params: { kind: string; name: string; slot: string } }

function validate(p: Params['params']): string | null {
  if (!KIND_RE.test(p.kind)) return 'Invalid kind';
  if (!NAME_RE.test(p.name)) return 'Invalid name';
  if (!SLOT_RE.test(p.slot)) return 'Invalid slot';
  if (p.kind === 'action' && p.slot === 'post') return 'Slot "post" not applicable to actions';
  return null;
}

function filePath(p: Params['params']): string {
  return path.join(resolveCatalogRoot(), 'custom', `${p.kind}.${p.name}.${p.slot}.md`);
}

export async function GET(_req: NextRequest, { params }: Params) {
  const err = validate(params);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  const fp = filePath(params);
  if (!fs.existsSync(fp)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const content = fs.readFileSync(fp, 'utf8');
  return NextResponse.json({ content }, { status: 200 });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const err = validate(params);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const content = (body as { content?: unknown })?.content;
  if (typeof content !== 'string') return NextResponse.json({ error: 'Missing field: content' }, { status: 400 });
  if (/^---\s*\r?\n/.test(content)) {
    return NextResponse.json({ error: 'Custom files must not contain YAML frontmatter' }, { status: 400 });
  }
  const fp = filePath(params);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, content, 'utf8');
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const err = validate(params);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  const fp = filePath(params);
  try {
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
