import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function makeTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ae-cmd-'));
}

export function seedCatalog(root: string): void {
  fs.mkdirSync(path.join(root, 'custom'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'action.exec.md'),
    '---\nkind: action\nname: exec\ntitle: Exec\ndescription: Run a task.\ncategory: agent-spawn\ncompletion_event: done\n---\n\nShipped action body.\n',
  );
  fs.writeFileSync(
    path.join(root, 'event.done.md'),
    '---\nkind: event\nname: done\ntitle: Done\ndescription: A done signal.\nsignal_payload: {}\n---\n\nShipped event body.\n',
  );
  fs.writeFileSync(
    path.join(root, 'event.orphan.md'),
    '---\nkind: event\nname: orphan\ntitle: Orphan\ndescription: Orphan event.\nsignal_payload: {}\n---\n\nOrphan body.\n',
  );
}

export function seedComposeFixture(): string {
  const root = makeTempRoot();
  fs.mkdirSync(path.join(root, 'custom'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'action.foo.md'),
    '---\nkind: action\nname: foo\ntitle: Foo\ndescription: Foo action.\ncategory: agent-spawn\ncompletion_event: kickoff\n---\n\nfoo body\n',
  );
  fs.writeFileSync(
    path.join(root, 'event.kickoff.md'),
    '---\nkind: event\nname: kickoff\ntitle: Kickoff\ndescription: A kickoff event.\nsignal_payload: {}\n---\n\nkickoff body\n',
  );
  return root;
}

