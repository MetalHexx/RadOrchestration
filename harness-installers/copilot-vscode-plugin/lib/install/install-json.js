import fs from 'node:fs';
import path from 'node:path';

export function readInstallJson(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeInstallJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sanitized = { ...value };
  delete sanitized.state_schema_version;
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(sanitized, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

export function isCurrentShape(ij) {
  return !!ij && typeof ij.harnesses === 'object' && ij.harnesses !== null;
}

/** Robust registry loader — always returns a valid `{ harnesses: {} }` shaped object. */
export function loadRegistry(installJsonPath) {
  try {
    if (!fs.existsSync(installJsonPath)) return { harnesses: {} };
    const ij = readInstallJson(installJsonPath);
    if (!isCurrentShape(ij)) return { harnesses: {} };
    return ij;
  } catch {
    return { harnesses: {} };
  }
}

export function buildCopilotVscodePluginEntry(version) {
  return {
    version,
    channel: 'copilot-vscode-plugin',
    installed_at: new Date().toISOString(),
    last_writer_version: version,
  };
}
