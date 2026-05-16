// Engine public surface. Each function is harness-blind: no string literal
// for any harness name lives in this folder (NFR-2 is enforced by audit
// in P05). Implementation is filled in by P03-T02 / P03-T03 / P04-T01.

export async function discoverAdapters(adaptersDir) {
  throw new Error('discoverAdapters not yet implemented');
}

export async function translateAgent({ bodyPath, ymlPath, adapter, outDir }) {
  throw new Error('translateAgent not yet implemented');
}

export async function translateSkill({ skillDir, adapter, outDir }) {
  throw new Error('translateSkill not yet implemented');
}

export async function build({ harness } = {}) {
  throw new Error('build not yet implemented');
}
