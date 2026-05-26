export type CustomAnchor = 'action' | 'event';
export type CustomSlot = 'pre' | 'post';

export interface ParsedCustomSlot {
  anchor: CustomAnchor;
  name: string;
  slot: CustomSlot;
}

// Three recognized shapes only (DD-2):
//   action.<name>.pre.md
//   event.<name>.pre.md
//   event.<name>.post.md
const ACTION_PRE = /^action\.([a-z0-9_]+)\.pre\.md$/;
const EVENT_PRE  = /^event\.([a-z0-9_]+)\.pre\.md$/;
const EVENT_POST = /^event\.([a-z0-9_]+)\.post\.md$/;

export function parseCustomSlotFilename(filename: string): ParsedCustomSlot | null {
  let m = ACTION_PRE.exec(filename);
  if (m) return { anchor: 'action', name: m[1], slot: 'pre' };
  m = EVENT_PRE.exec(filename);
  if (m) return { anchor: 'event', name: m[1], slot: 'pre' };
  m = EVENT_POST.exec(filename);
  if (m) return { anchor: 'event', name: m[1], slot: 'post' };
  return null;
}
