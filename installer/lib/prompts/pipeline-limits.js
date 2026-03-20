// installer/lib/prompts/pipeline-limits.js

import { input } from '@inquirer/prompts';

/**
 * Returns true if value is a string representation of a positive integer (>= 1).
 * Returns an error message string otherwise.
 * @param {string} value
 * @returns {true|string}
 */
function isPositiveInteger(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    return 'Please enter a positive integer (1 or greater)';
  }
  return true;
}

/**
 * Returns true if value is a string representation of a non-negative integer (>= 0).
 * Returns an error message string otherwise.
 * @param {string} value
 * @returns {true|string}
 */
function isNonNegativeInteger(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    return 'Please enter a non-negative integer (0 or greater)';
  }
  return true;
}

/**
 * Runs the "Pipeline Limits" prompt section.
 * @returns {Promise<{ maxPhases: number, maxTasksPerPhase: number, maxRetriesPerTask: number, maxConsecutiveReviewRejections: number }>}
 */
export async function promptPipelineLimits() {
  const rawMaxPhases = await input({
    message: 'Maximum phases per project',
    default: '10',
    validate: isPositiveInteger,
  });

  const rawMaxTasksPerPhase = await input({
    message: 'Maximum tasks per phase',
    default: '8',
    validate: isPositiveInteger,
  });

  const rawMaxRetriesPerTask = await input({
    message: 'Maximum retries per task',
    default: '2',
    validate: isNonNegativeInteger,
  });

  const rawMaxConsecutiveReviewRejections = await input({
    message: 'Maximum consecutive review rejections',
    default: '3',
    validate: isPositiveInteger,
  });

  return {
    maxPhases: parseInt(rawMaxPhases, 10),
    maxTasksPerPhase: parseInt(rawMaxTasksPerPhase, 10),
    maxRetriesPerTask: parseInt(rawMaxRetriesPerTask, 10),
    maxConsecutiveReviewRejections: parseInt(rawMaxConsecutiveReviewRejections, 10),
  };
}
