import js from '@eslint/js';
import globals from 'globals';
import promise from 'eslint-plugin-promise';

export default [
  // Global ignores
  {
    ignores: [
      'node_modules/**',
      'out/**',
      'dist/**',
      'coverage/**',
      '.githooks/**',
      '.obsidian/**',
      'test/fixtures/examples/out/**',
      'test/fixtures/blade/out/**',
      'test/browser/contracts/dist/**',
      'tests/generated/**',
      'packages/wesley-website/**',
      'wesley-website/**'
    ]
  },

  // Base config for all JS/MJS files
  js.configs.recommended,
  promise.configs['flat/recommended'],
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2022
      }
    },
    rules: {
      // Promise plugin rules for proper async handling
      'promise/catch-or-return': 'error',
      'promise/no-return-wrap': 'error',
      'promise/param-names': 'error',
      'promise/always-return': 'error',

      // Async/await rules
      'no-async-promise-executor': 'error',
      'no-await-in-loop': 'off',
      'no-return-await': 'error',
      'prefer-promise-reject-errors': 'error',

      // ESM-specific rules
      'no-undef': 'error',
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],

      // General best practices for JavaScript
      'no-console': 'off',
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'comma-dangle': ['error', 'never'],
      'indent': ['error', 2],
      'no-trailing-spaces': 'error',
      'eol-last': 'error',

      // Modern JavaScript features
      'prefer-const': 'error',
      'prefer-arrow-callback': 'error',
      'no-var': 'error',
      'object-shorthand': 'error'
    }
  },

  // Core purity rules: no Node built-ins in @wesley/core src (not tests/demo)
  {
    files: ['packages/wesley-core/src/**/*.mjs', 'packages/wesley-core/src/**/*.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['node:*'],
              message: 'Do not use Node built-ins in core (keep it pure).'
            }
          ],
          paths: [
            { name: 'fs', message: 'Use ports/adapters; no fs in core.' },
            { name: 'path', message: 'Use ports/adapters; no path in core.' },
            { name: 'process', message: 'Do not use process in core.' },
            { name: 'child_process', message: 'No child_process in core.' },
            { name: 'os', message: 'No os in core.' },
            { name: 'buffer', message: 'No Buffer usage in core.' }
          ]
        }
      ]
    }
  },

  // Test files: relax rules that conflict with test patterns
  {
    files: ['**/test/**', '**/*.test.mjs', '**/*.test.js', '**/*.spec.mjs', '**/*.spec.js'],
    rules: {
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      // Test stubs often implement interfaces without using await
      'require-await': 'off',
      // Tests may use empty catch blocks for error-path testing
      'no-empty': 'off',
      'promise/catch-or-return': 'off',
      'promise/always-return': 'off'
    }
  },

  // Browser test files: allow browser globals
  {
    files: ['test/browser/**/*.mjs', 'test/browser/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser
      }
    }
  },

  // Host contract tests: allow Deno global
  {
    files: ['test/contracts/**/*.mjs'],
    languageOptions: {
      globals: {
        Deno: 'readonly'
      }
    }
  }
];
