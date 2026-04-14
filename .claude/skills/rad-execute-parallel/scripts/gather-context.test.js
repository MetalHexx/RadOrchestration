'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseSimpleYaml } = require('./gather-context');

// ─── parseSimpleYaml ────────────────────────────────────────────────────────

describe('parseSimpleYaml', () => {

  it('parses flat key-value pairs', () => {
    const yaml = `name: my-project\nversion: 1.0`;
    const result = parseSimpleYaml(yaml);
    assert.equal(result['name'], 'my-project');
    assert.equal(result['version'], '1.0');
  });

  it('parses nested sections into dotted key paths', () => {
    const yaml = [
      'system:',
      '  orch_root: .github',
      '  debug: false',
      'projects:',
      '  base_path: /data/projects',
      '  naming: SCREAMING_CASE',
    ].join('\n');
    const result = parseSimpleYaml(yaml);
    assert.equal(result['system.orch_root'], '.github');
    assert.equal(result['system.debug'], 'false');
    assert.equal(result['projects.base_path'], '/data/projects');
    assert.equal(result['projects.naming'], 'SCREAMING_CASE');
  });

  it('strips surrounding double quotes from values', () => {
    const yaml = `path: "C:\\dev\\orchestration-projects"`;
    const result = parseSimpleYaml(yaml);
    assert.equal(result['path'], 'C:\\dev\\orchestration-projects');
  });

  it('strips surrounding single quotes from values', () => {
    const yaml = `path: '/some/path'`;
    const result = parseSimpleYaml(yaml);
    assert.equal(result['path'], '/some/path');
  });

  it('strips inline comments', () => {
    const yaml = `timeout: 30 # seconds`;
    const result = parseSimpleYaml(yaml);
    assert.equal(result['timeout'], '30');
  });

  it('ignores blank lines and comment-only lines', () => {
    const yaml = [
      '# Top-level comment',
      '',
      'key: value',
      '',
      '# Another comment',
      'other: data',
    ].join('\n');
    const result = parseSimpleYaml(yaml);
    assert.equal(Object.keys(result).length, 2);
    assert.equal(result['key'], 'value');
    assert.equal(result['other'], 'data');
  });

  it('handles section headers with no value as nesting parents', () => {
    const yaml = [
      'source_control:',
      '  auto_commit: always',
      '  auto_pr: never',
    ].join('\n');
    const result = parseSimpleYaml(yaml);
    assert.equal(result['source_control.auto_commit'], 'always');
    assert.equal(result['source_control.auto_pr'], 'never');
    assert.equal(result['source_control'], undefined);
  });

  it('returns empty object for empty input', () => {
    assert.deepEqual(parseSimpleYaml(''), {});
  });

  it('returns empty object for comment-only input', () => {
    assert.deepEqual(parseSimpleYaml('# just a comment\n# another'), {});
  });

  it('handles keys with hyphens and numbers', () => {
    const yaml = `max-retries: 3\nstep2: done`;
    const result = parseSimpleYaml(yaml);
    assert.equal(result['max-retries'], '3');
    assert.equal(result['step2'], 'done');
  });

  it('handles deeply nested sections (3 levels)', () => {
    const yaml = [
      'level1:',
      '  level2:',
      '    level3: deep-value',
    ].join('\n');
    const result = parseSimpleYaml(yaml);
    assert.equal(result['level1.level2.level3'], 'deep-value');
  });

  it('returns to top level after a nested section', () => {
    const yaml = [
      'section_a:',
      '  nested: val1',
      'top_level: val2',
    ].join('\n');
    const result = parseSimpleYaml(yaml);
    assert.equal(result['section_a.nested'], 'val1');
    assert.equal(result['top_level'], 'val2');
  });

  it('handles sibling sections at the same indent', () => {
    const yaml = [
      'alpha:',
      '  key: a_val',
      'beta:',
      '  key: b_val',
    ].join('\n');
    const result = parseSimpleYaml(yaml);
    assert.equal(result['alpha.key'], 'a_val');
    assert.equal(result['beta.key'], 'b_val');
  });

  it('parses a realistic orchestration.yml snippet', () => {
    const yaml = [
      'system:',
      '  orch_root: .github',
      '',
      'projects:',
      '  base_path: "C:\\\\dev\\\\orchestration-projects"',
      '  naming: SCREAMING_CASE',
      '',
      'source_control:',
      '  auto_commit: ask',
      '  auto_pr: ask',
      '  provider: github',
    ].join('\n');
    const result = parseSimpleYaml(yaml);
    assert.equal(result['system.orch_root'], '.github');
    assert.equal(result['projects.base_path'], 'C:\\\\dev\\\\orchestration-projects');
    assert.equal(result['projects.naming'], 'SCREAMING_CASE');
    assert.equal(result['source_control.auto_commit'], 'ask');
    assert.equal(result['source_control.auto_pr'], 'ask');
    assert.equal(result['source_control.provider'], 'github');
  });
});
