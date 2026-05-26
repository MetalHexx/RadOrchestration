import fs from 'node:fs';
import path from 'node:path';

export function readInstallJson(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * Writes install.json atomically and strips any incoming state_schema_version
 * field — new writes are unversioned and identified structurally by the
 * presence of the `harnesses` object.
 */
export function writeInstallJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sanitized = { ...value };
  delete sanitized.state_schema_version;
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(sanitized, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

/**
 * The current install.json shape is identified structurally by presence of
 * the `harnesses` object. No version literal is consulted — there is no
 * version namespace.
 */
export function isCurrentShape(ij) {
  return !!ij && typeof ij.harnesses === 'object' && ij.harnesses !== null;
}

/**
 * Lifts a legacy install.json record into the current `harnesses`-keyed
 * unversioned shape. Accepts two legacy shapes:
 *   - flat single-record (no `harnesses` object; historically tagged
 *     `state_schema_version: 'v5'`)
 *   - earlier `harnesses`-keyed record that still carries a
 *     `state_schema_version` field (historically `'v6'`)
 * Either way, the lifted record drops `state_schema_version` entirely so
 * the next write is field-less.
 */
export function migrateInstallJson(ij, installKey) {
  if (isCurrentShape(ij)) {
    // Already harnesses-keyed; strip any lingering state_schema_version field.
    const stripped = { ...ij };
    delete stripped.state_schema_version;
    return stripped;
  }
  const flat = ij ?? {};
  const version = flat.package_version ?? 'unknown';
  const installed_at = flat.installed_at ?? new Date().toISOString();
  const last_writer_version = flat.last_writer_version ?? version;
  return {
    harnesses: { [installKey]: { version, channel: 'claude-plugin', installed_at, last_writer_version } },
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

export function buildClaudePluginEntry(version) {
  return {
    version,
    channel: 'claude-plugin',
    installed_at: new Date().toISOString(),
    last_writer_version: version,
  };
}

/**
 * True when the entry carries every canonical field; false when missing or
 * shape-drifted. Used by the NOOP path to decide whether install.json needs
 * an upsert even though the file copy is skipped.
 */
export function isEntryCurrent(entry, version) {
  if (!entry || typeof entry !== 'object') return false;
  return entry.version === version
    && entry.channel === 'claude-plugin'
    && typeof entry.installed_at === 'string'
    && entry.last_writer_version === version;
}
