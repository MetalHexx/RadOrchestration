export const HarnessName = ['claude', 'copilot-vscode', 'copilot-cli'] as const;
export type HarnessName = (typeof HarnessName)[number];
export function isHarnessName(value: unknown): value is HarnessName {
  return typeof value === 'string' && (HarnessName as readonly string[]).includes(value);
}
