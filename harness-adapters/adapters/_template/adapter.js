// Reference shape for new harness adapters. Copy this folder to
// `harness-adapters/adapters/<your-harness>/` and replace every
// placeholder. The underscore prefix excludes this folder from discovery.
//
// Contract: an adapter is a tiny data module exposing exactly three fields —
// `name` (matches the folder name), `filenames` (template strings per content
// kind, with `{name}` as the canonical-name substitution token), and
// `bodyTokens` (a flat string-to-string substitution map applied to body
// text after frontmatter substitution; empty on day one, reserved as a
// future extension point for vocabulary drift between harnesses).
//
// The contract is intentionally narrow: no tool dictionary, no model alias
// map, no frontmatter projector, no destination, no manifest emitter. All
// harness vocabulary lives in `<agent>.<your-harness>.yml` files alongside
// each agent body in `harness-files/agents/`.

export const adapter = {
  name: '_template',
  filenames: {
    agent: '<your-harness-agent-pattern>',
    skill: '<your-harness-skill-pattern>',
  },
  bodyTokens: {},
};
