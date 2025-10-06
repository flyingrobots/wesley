/**
 * Dependency Cruiser Configuration for Wesley ENSIGN Architecture
 * Enforces hexagonal architecture boundaries and package dependencies
 */

export default {
  forbidden: [
    {
      name: 'no-core-to-adapters',
      comment: 'Core domain should not import from adapter packages',
      severity: 'error',
      from: {
        path: 'packages/wesley-core/src'
      },
      to: {
        path: [
          'packages/wesley-host-node/src',
          'packages/wesley-cli/src'
        ]
      }
    },
    {
      name: 'no-core-node-dependencies',
      comment: 'Core domain should not use Node.js modules directly',
      severity: 'error',
      from: {
        path: 'packages/wesley-core/src'
      },
      to: {
        path: [
          '^node:.*',
          '^fs$',
          '^path$',
          '^os$',
          '^process$',
          '^child_process$',
          '^stream$',
          '^events$',
          '^util$',
          '^crypto$',
          '^buffer$'
        ],
        pathNot: [
          // Allow core Node.js types that are platform-agnostic
          '^url$'
        ]
      }
    },
    {
      name: 'no-cli-to-host',
      comment: 'CLI library should not import from host adapter',
      severity: 'error',
      from: {
        path: 'packages/wesley-cli/src'
      },
      to: {
        path: 'packages/wesley-host-node/src'
      }
    },
    {
      name: 'no-tasks-to-slaps',
      comment: 'T.A.S.K.S. should not directly depend on S.L.A.P.S.',
      severity: 'error',
      from: {
        path: 'packages/wesley-tasks/src'
      },
      to: {
        path: 'packages/wesley-slaps/src'
      }
    },
    {
      name: 'no-generators-cross-dependency',
      comment: 'Generator packages should not depend on each other',
      severity: 'error',
      from: {
        path: 'packages/wesley-generator-*/src'
      },
      to: {
        path: 'packages/wesley-generator-*/src'
      }
    }
  ],
  options: {
    includeOnly: { path: '^packages/.+?/src' },
    exclude: {
      path: [
        'node_modules',
        '/test/',
        '\\.(spec|test)\\.'
      ]
    }
  }
};
