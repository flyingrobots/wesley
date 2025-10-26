import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import react from 'eslint-plugin-react'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import { defineConfig, globalIgnores } from 'eslint/config'
import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({ baseDirectory: import.meta.dirname })

export default defineConfig([
  globalIgnores(['dist']),
  ...compat.extends('mantine'),
  {
    files: ['**/*.{js,jsx}'],
    plugins: { react, 'jsx-a11y': jsxA11y },
    extends: [
      js.configs.recommended,
      react.configs.recommended,
      jsxA11y.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    settings: { react: { version: 'detect' } },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    files: ['**/*.{test,spec}.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.jest },
    },
  },
])
