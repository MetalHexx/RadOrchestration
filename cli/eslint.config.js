// cli/eslint.config.js — ESLint flat config (v9-native).
// Blocks console.log outside framework/output.ts so the stdout/stderr contract cannot drift.
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'dist-bundle/**', 'coverage/**', 'node_modules/**'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    rules: {
      'no-console': ['error', { allow: ['error', 'warn'] }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['src/framework/output.ts'],
    rules: {
      'no-console': 'off',
    },
  },
);
