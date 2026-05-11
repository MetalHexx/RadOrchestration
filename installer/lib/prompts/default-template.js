// installer/lib/prompts/default-template.js

import { select } from '@inquirer/prompts';
import { INQUIRER_THEME } from '../theme.js';

/**
 * Runs the "Default Template" prompt section.
 * The default template controls which review-intensity tier the planner
 * proposes when a new project starts. `ask` defers the choice until project time.
 * @returns {Promise<{ defaultTemplate: 'ask'|'extra-high'|'high'|'medium'|'low' }>}
 */
export async function promptDefaultTemplate() {
  const defaultTemplate = await select({
    message: 'Default review-intensity template',
    theme: INQUIRER_THEME,
    default: 'ask',
    choices: [
      { name: 'ask — Choose per project',                         value: 'ask' },
      { name: 'extra-high — Maximum review intensity',            value: 'extra-high' },
      { name: 'high — High review intensity',                     value: 'high' },
      { name: 'medium — Balanced review intensity',               value: 'medium' },
      { name: 'low — Minimal review intensity',                   value: 'low' },
    ],
  });

  return { defaultTemplate };
}
