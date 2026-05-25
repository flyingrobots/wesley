/**
 * Dependency Cruiser Configuration for Wesley
 * Enforces retained JavaScript package boundaries after legacy Node retirement.
 */

export default {
  forbidden: [
    {
      name: 'no-retired-wesley-package-imports',
      comment: 'Retained packages must not import deleted JavaScript compiler/runtime packages',
      severity: 'error',
      from: {
        path: '^packages/.+?/src'
      },
      to: {
        path: [
          '^@wesley/(core|cli|runtime-node)$',
          '^@wesley/(core|cli|runtime-node)/',
          'packages/wesley-(core|cli|host-node|runtime-node)'
        ]
      }
    },
    {
      name: 'no-host-experiment-to-holmes',
      comment: 'External host experiments must stay independent from Holmes assurance tooling',
      severity: 'error',
      from: {
        path: 'packages/wesley-host-(browser|bun|deno)'
      },
      to: {
        path: 'packages/wesley-holmes'
      }
    },
    {
      name: 'no-holmes-to-host-experiments',
      comment: 'Holmes assurance tooling must not depend on host smoke experiments',
      severity: 'error',
      from: {
        path: 'packages/wesley-holmes'
      },
      to: {
        path: 'packages/wesley-host-(browser|bun|deno)'
      }
    }
  ],
  options: {
    includeOnly: { path: '^packages/.+?/src' },
    exclude: {
      path: ['node_modules', '/test/', '\\.(spec|test)\\.']
    }
  }
};
