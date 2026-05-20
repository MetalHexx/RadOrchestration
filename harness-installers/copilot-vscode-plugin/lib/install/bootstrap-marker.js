import fs from 'node:fs';
import path from 'node:path';

/** Read the marker file, returning null on absent or unparseable. */
export function readMarker(markerPath) {
  if (!fs.existsSync(markerPath)) return null;
  try { return JSON.parse(fs.readFileSync(markerPath, 'utf8')); } catch { return null; }
}

/** Atomic write of the bootstrap marker file via tmp + rename. */
export function writeMarker(markerPath, marker) {
  fs.mkdirSync(path.dirname(markerPath), { recursive: true });
  const tmp = `${markerPath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(marker, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, markerPath);
}
