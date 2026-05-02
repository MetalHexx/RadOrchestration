// adapters/_template/adapter.test.js — Surface coverage checklist for new adapters.
// The _template adapter is intentionally non-functional, so this file only
// documents the surface list each concrete adapter test file must cover.
import { test } from 'node:test';

test.skip('filenameRule(): agent kind returns harness filename');
test.skip('filenameRule(): skill kind returns harness filename');
test.skip('agentFrontmatter(): projects canonical fields → harness fields');
test.skip('agentFrontmatter(): drops or pass-through unknown fields per research');
test.skip('skillFrontmatter(): projects canonical fields → harness fields');
test.skip('toolDictionary: maps every Claude PascalCase tool name used in this repo');
test.skip('modelAliases: maps haiku/sonnet/opus to harness ids per research');
