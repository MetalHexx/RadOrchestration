// installer/lib/prompts/gate-behavior.js

import { select } from '@inquirer/prompts';

/**
 * Runs the "Gate Behavior" prompt section.
 * @returns {Promise<{ executionMode: 'ask'|'phase'|'task'|'autonomous' }>}
 */
export async function promptGateBehavior() {
  const executionMode = await select({
    message: 'Execution mode',
    default: 'ask',
    choices: [
      { name: 'ask — Prompt before each phase',  value: 'ask' },
      { name: 'phase — Gate between phases',      value: 'phase' },
      { name: 'task — Gate between tasks',        value: 'task' },
      { name: 'autonomous — No gates',            value: 'autonomous' },
    ],
  });

  return { executionMode };
}
