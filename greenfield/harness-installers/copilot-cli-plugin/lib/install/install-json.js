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

export function migrateInstallJson(ij, installKey) {
  if (isCurrentShape(ij)) {
    const stripped = { ...ij };
    delete stripped.state_schema_version;
    return stripped;
  }
  const flat = ij ?? {};
  const version = flat.package_version ?? 'unknown';
  const installed_at = flat.installed_at ?? new Date().toISOString();
  const last_writer_version = flat.last_writer_version ?? version;
  return {
    harnesses: { [installKey]: { version, channel: 'copilot-cli-plugin', installed_at, last_writer_version } },
  };
}

/**
 * Robust registry loader — always returns a valid `{ harnesses: {} }` shaped
 * object. Returns empty harnesses for missing file, invalid JSON, or any
 * non-conforming shape (aligns with standard installer's loadRegistry).
 */
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

export function buildCopilotCliPluginEntry(version) {
  return {
    version,
    channel: 'copilot-cli-plugin',
    installed_at: new Date().toISOString(),
    last_writer_version: version,
  };
}
