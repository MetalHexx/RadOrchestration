// AD-8: the public barrel is the facade-only surface. Consumers reach the
// work-graph exclusively through `WorkGraphService` and the public type
// vocabulary below. Internals (GraphIndex, WorkGraph, the derive/* helpers,
// validate/reconcile, id helpers, and the store-format types) are NOT
// re-exported here, so no consumer can bypass the facade or touch the backing
// store. Tests that need an internal import it by its direct module path.
export { WorkGraphService } from './service.js';
export { PROJECTION_SCHEMA } from './types.js';
//# sourceMappingURL=index.js.map