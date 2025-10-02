// ESLint rules scoped to @wesley/core to enforce purity
module.exports = {
  env: { es2022: true },
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
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
};
