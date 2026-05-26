// ui-stop.js — Pre-flight UI lifecycle helper for the install path. Reads
// ~/.radorc/runtime/ui.pid; if a live dashboard UI process is registered,
// sends SIGTERM and polls until the PID is dead or POLL_TIMEOUT_MS elapses.
// Inlined per the harness-installer encapsulation rule — does not import the
// CLI's runStop, even though the logic mirrors cli/src/commands/ui/stop.ts.

import fs from 'node:fs';
import { userDataPaths } from './user-data-paths.js';

const POLL_INTERVAL_MS = 200;
const POLL_TIMEOUT_MS = 5000;

function defaultIsPidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function defaultKill(pid, signal) {
  process.kill(pid, signal);
}

function defaultSleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/**
 * @param {{
 *   home?: string,
 *   _isPidAlive?: (pid: number) => boolean,
 *   _kill?: (pid: number, signal: NodeJS.Signals | 0) => void,
 *   _sleep?: (ms: number) => Promise<void>,
 *   _now?: () => number,
 * }} [opts]
 * @returns {Promise<{
 *   wasRunning: boolean,
 *   stopped: boolean,
 *   status: { pid: number, port: number, url: string } | null,
 *   reason: string | null,
 * }>}
 */
export async function detectAndStopUi(opts = {}) {
  const isAlive = opts._isPidAlive ?? defaultIsPidAlive;
  const kill = opts._kill ?? defaultKill;
  const sleep = opts._sleep ?? defaultSleep;
  const now = opts._now ?? Date.now;
  const paths = userDataPaths({ home: opts.home });
  const pidFile = paths.uiPidFile;

  if (!fs.existsSync(pidFile)) {
    return { wasRunning: false, stopped: false, status: null, reason: null };
  }
  let entry;
  try { entry = JSON.parse(fs.readFileSync(pidFile, 'utf8')); }
  catch { return { wasRunning: false, stopped: false, status: null, reason: null }; }
  // Guard against pid: 0 / negative / non-integer. process.kill(0, sig) on POSIX
  // signals the whole process group; treat invalid pids as not-running.
  if (!entry || !Number.isInteger(entry.pid) || entry.pid <= 0) {
    return { wasRunning: false, stopped: false, status: null, reason: null };
  }
  if (!isAlive(entry.pid)) {
    try { fs.rmSync(pidFile, { force: true }); } catch { /* best-effort */ }
    return { wasRunning: false, stopped: false, status: null, reason: null };
  }

  const status = {
    pid: entry.pid,
    port: typeof entry.port === 'number' ? entry.port : -1,
    url: typeof entry.port === 'number' ? `http://localhost:${entry.port}` : '<unknown port>',
  };

  try { kill(entry.pid, 'SIGTERM'); }
  catch (err) {
    return { wasRunning: true, stopped: false, status, reason: `SIGTERM failed: ${err.message}` };
  }

  const deadline = now() + POLL_TIMEOUT_MS;
  while (now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    if (!isAlive(entry.pid)) {
      try { fs.rmSync(pidFile, { force: true }); } catch { /* best-effort */ }
      return { wasRunning: true, stopped: true, status, reason: null };
    }
  }
  return {
    wasRunning: true,
    stopped: false,
    status,
    reason: `PID ${entry.pid} still alive ${POLL_TIMEOUT_MS}ms after SIGTERM`,
  };
}

export function formatUiLockMessage(status, reason) {
  return (
    `dashboard UI is running and could not be stopped (PID ${status.pid} at ${status.url}). ` +
    `${reason}. Stop it manually and re-run the installer.`
  );
}

/** Thrown by hydrate-user-data when the UI lock can't be cleared. Caller surfaces .uiStatus. */
export class UiLockError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'UiLockError';
    this.uiStatus = status;
  }
}
