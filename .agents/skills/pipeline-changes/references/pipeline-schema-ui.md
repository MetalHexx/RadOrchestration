# Schema & UI Update Checklist

When a pipeline change adds or modifies fields in **orchestration.yml** or **state.json**, these files must be updated in lockstep. Missing any one causes silent failures, validation rejections, or UI drift.

## Adding a New Config Field (orchestration.yml)

| # | File | What to Update |
|---|------|----------------|
| 1 | `scripts/lib/state-io.js` | Add default value to `DEFAULT_CONFIG` |
| 2 | `ui/types/config.ts` | Add field to `OrchestrationConfig` interface (+ enum type if applicable) |
| 3 | `ui/lib/config-field-meta.ts` | Add `FieldMeta` entry — key (dot-path), label, tooltip, section, controlType, options/min |
| 4 | `ui/lib/config-validator.ts` | Add validation rule — type check, enum allowlist, or constraint |
| 5 | `scripts/validate/lib/checks/config.js` | Add CLI validation — enum rules, required section checks, type constraints |

**Gotcha:** The form UI auto-generates controls from `config-field-meta.ts`. If the field isn't in the metadata array, it's invisible in form mode but still editable in raw YAML mode — causing user confusion.

**Gotcha:** `DEFAULT_CONFIG` in state-io.js uses shallow section merges (`{ ...DEFAULT_CONFIG.section, ...parsed.section }`). New fields get their default automatically as long as they're in the right section object. If you add a new top-level section, add a merge line in `readConfig()`.

## Adding a New State Field (state.json)

| # | File | What to Update |
|---|------|----------------|
| 1 | `schemas/state-v4.schema.json` | Add field to JSON Schema — type, description, enum values, required array |
| 2 | `ui/types/state.ts` | Add field to the relevant TypeScript interface |
| 3 | `scripts/lib/mutations.js` | Set field in the mutation handler(s) that produce it |
| 4 | `scripts/lib/validator.js` | Add invariant check if the field has cross-field constraints |
| 5 | `scripts/lib/state-io.js` | Update `scaffoldInitialState()` if the field needs an initial value |

**Gotcha:** JSON Schema validation runs on every `writeState()`. A field not declared in the schema is rejected by `additionalProperties: false`. Code works → tests pass → write is rejected at runtime.

**Gotcha:** The UI reads state via `ui/types/state.ts`. If the TypeScript type doesn't match the actual JSON shape, the dashboard silently drops or misrenders the field.

## Adding a New Enum Value

| Enum Location | Files to Update |
|--------------|-----------------|
| Config enum (e.g. execution_mode) | `DEFAULT_CONFIG`, `config.ts` type, `config-field-meta.ts` options, `config-validator.ts` allowlist, `checks/config.js` ENUM_RULES |
| State enum (e.g. task status) | `constants.js` frozen enum + transition map, `state-v4.schema.json` enum array, `state.ts` union type, `validator.js` if transitions change |

## Quick Validation

After any schema/config change, verify:

1. **CLI validation** — run `validate-orchestration` against a project with the new field
2. **UI form mode** — new config field renders correct control and validates input
3. **State round-trip** — `writeState()` succeeds with the new field present
4. **Tests** — run `pipeline-behavioral.test.js` and `pipeline.test.js`
