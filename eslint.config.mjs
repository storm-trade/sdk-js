import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['docs/*', 'dist/*', 'coverage/*', 'node_modules/*'],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { caughtErrorsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['tests/**/*.cjs', 'examples/builders/**/*.cjs'],
    languageOptions: { globals: globals.node },
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['tests/**/*.cjs', 'examples/builders/**/*.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
];
