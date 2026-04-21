import { getColors } from './colors.js';

// Deliberate drift — FR-2 / NFR-1 specify `greet` returns `string` synchronously
// and treats `getColors()` as synchronous. This T2-as-coded implementation awaits
// a (non-existent) Promise, creating a cross-task contract mismatch with T1's
// synchronous `Color[]` return. Task-scope review must catch this as a `drift`
// row against FR-2. The orchestrator's corrective handoff fixes this to match
// the reference shape in the task handoff's Implementation Notes.
export async function greet(name: string): Promise<string> {
  const palette = (await (getColors() as unknown as Promise<string[]>)).join(', ');
  return `Hello, ${name}! Palette: ${palette}.`;
}
