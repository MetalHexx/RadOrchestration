import { Ajv, type ValidateFunction, type ErrorObject } from 'ajv';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { PipelineState } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCHEMA_PATH = join(__dirname, '..', '..', 'schemas', 'state-v5.schema.json');

let validateFn: ValidateFunction | null = null;

function getValidator(): ValidateFunction {
  if (validateFn !== null) {
    return validateFn;
  }
  const schemaText = readFileSync(SCHEMA_PATH, 'utf-8');
  const schema = JSON.parse(schemaText) as object;
  const ajv = new Ajv({ allErrors: true });
  validateFn = ajv.compile(schema);
  return validateFn;
}

function instancePathToDotNotation(instancePath: string): string {
  if (!instancePath) return '';
  const stripped = instancePath.startsWith('/') ? instancePath.slice(1) : instancePath;
  const segments = stripped.split('/');
  let result = '';
  for (const segment of segments) {
    if (/^\d+$/.test(segment)) {
      result += `[${segment}]`;
    } else {
      result += result === '' ? segment : `.${segment}`;
    }
  }
  return result;
}

function formatSchemaError(error: ErrorObject): string {
  const basePath = instancePathToDotNotation(error.instancePath);

  let path: string;
  let problem: string;

  switch (error.keyword) {
    case 'required': {
      const missing: string = error.params['missingProperty'];
      path = basePath ? `${basePath}.${missing}` : missing;
      problem = 'required field missing';
      break;
    }
    case 'type': {
      const expected: string = error.params['type'];
      const actual = error.data === null ? 'null' : typeof error.data;
      path = basePath;
      problem = `expected ${expected}, got ${actual}`;
      break;
    }
    case 'enum': {
      const allowedValues: unknown[] = error.params['allowedValues'];
      path = basePath;
      problem = `invalid value ${JSON.stringify(error.data)} — must be one of: ${allowedValues.join(', ')}`;
      break;
    }
    case 'const': {
      const expectedValue: unknown = error.params['allowedValue'];
      path = basePath;
      problem = `expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(error.data)}`;
      break;
    }
    case 'additionalProperties': {
      const additionalProp: string = error.params['additionalProperty'];
      path = basePath ? `${basePath}.${additionalProp}` : additionalProp;
      problem = 'unexpected field';
      if (additionalProp === 'commit_hash' && basePath.startsWith('pipeline.source_control')) {
        problem += ' — global commit_hash was removed in v5; per-task commit_hash is now recorded on each IterationEntry';
      }
      break;
    }
    case 'minimum': {
      const limit: number = error.params['limit'];
      path = basePath;
      problem = `value must be >= ${limit}`;
      break;
    }
    default:
      path = basePath;
      problem = error.message ?? 'validation failed';
  }

  return `[schema] ${path}: ${problem}`;
}

/**
 * Validates a PipelineState object against the v5 JSON Schema.
 * Returns an array of error strings with [schema] prefix, or empty array if valid.
 * Uses lazy-initialized singleton Ajv instance for schema compilation.
 */
export function validateStateSchema(state: PipelineState): string[] {
  const validate = getValidator();
  const valid = validate(state);
  if (valid) {
    return [];
  }
  const errors = validate.errors ?? [];
  return errors.map(formatSchemaError);
}
