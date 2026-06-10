export { sourceControlInitCommand, sourceControlInit } from './init.js';
// normalizeAutoSetting / normalizeOptionalUrl are re-exported for prospective external
// consumers of the source-control state-shape helpers; no in-tree caller depends on them yet.
export { buildSourceControlState, normalizeAutoSetting, normalizeOptionalUrl } from './state-shape.js';
