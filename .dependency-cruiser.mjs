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
          '^fs$',
          '^path$',
          '^os$',
          '^process$',
          '^child_process$',
          '^stream$',
          '^events$',
          '^util$',
          '^crypto$'
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
    },
    {
      name: 'no-circular-dependencies',
      comment: 'No circular dependencies anywhere',
      severity: 'error',
      from: {},
      to: {}
    }
  ],
  allowed: [
    {
      name: 'core-to-core',
      comment: 'Core domain modules can import from each other',
      from: {
        path: 'packages/wesley-core/src'
      },
      to: {
        path: 'packages/wesley-core/src'
      }
    },
    {
      name: 'adapters-to-core',
      comment: 'Adapter packages can import from core domain',
      from: {
        path: [
          'packages/wesley-host-node/src',
          'packages/wesley-cli/src'
        ]
      },
      to: {
        path: 'packages/wesley-core/src'
      }
    },
    {
      name: 'host-to-external',
      comment: 'Host adapter can use external Node.js libraries',
      from: {
        path: 'packages/wesley-host-node/src'
      },
      to: {
        path: [
          '^fs$',
          '^path$',
          '^crypto$',
          '^stream$',
          '^events$',
          'node_modules'
        ]
      }
    },
    {
      name: 'generators-to-core',
      comment: 'Generator packages can import from core',
      from: {
        path: 'packages/wesley-generator-*/src'
      },
      to: {
        path: 'packages/wesley-core/src'
      }
    },
    {
      name: 'slaps-to-tasks',
      comment: 'S.L.A.P.S. can depend on T.A.S.K.S. for coordination',
      from: {
        path: 'packages/wesley-slaps/src'
      },
      to: {
        path: 'packages/wesley-tasks/src'
      }
    }
  ],
  options: {
    doNotFollow: {
      path: [
        'node_modules',
        '\\.d\\.ts$'
      ]
    },
    exclude: {
      path: [
        'node_modules',
        'test',
        'tests',
        '__tests__',
        'spec',
        '\\.spec\\.',
        '\\.test\\.'
      ]
    },
    includeOnly: {
      path: 'packages/wesley-'
    },
    focus: '',
    collapse: {
      path: '^packages/[^/]+/src'
    },
    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/[^/]+',
        filters: {
          includeOnly: {
            path: 'packages/wesley-'
          }
        }
      },
      archi: {
        collapsePattern: '^packages/wesley-[^/]+/src',
        theme: {
          graph: {
            splines: 'ortho'
          }
        }
      }
    },
    tsConfig: {
      fileName: 'tsconfig.json'
    },
    babelConfig: {
      fileName: '.babelrc'
    },
    webpackConfig: {
      fileName: 'webpack.config.js',
      env: {
        NODE_ENV: 'development'
      }
    }
  }
};