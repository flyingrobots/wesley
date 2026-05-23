import { WesleyModule } from '@wesley/core';
import { WesleyCommand } from '../../../src/framework/WesleyCommand.mjs';

class FixtureHelloCommand extends WesleyCommand {
  constructor(ctx) {
    super(ctx, 'fixture-hello', 'Fixture command provided by a Wesley test module');
  }

  async executeCore() {
    return {
      kind: 'fixture.hello',
      source: 'test-extension-module'
    };
  }
}

class TestExtensionModule extends WesleyModule {
  get apiVersion() {
    return '1';
  }

  get name() {
    return 'test-extension-module';
  }

  get capabilities() {
    return {
      wesley: {
        directives: [
          {
            name: 'fixture-directive',
            directive: 'fixture'
          }
        ],
        targets: [
          {
            name: 'fixture-target',
            async compile({ schemaContent, schemaPath, outDir, options, target }) {
              return {
                kind: 'fixture.compile-target.v1',
                target: target.name,
                schemaPath,
                outDir,
                dryRun: Boolean(options.dryRun),
                schemaBytes: schemaContent.length
              };
            }
          }
        ],
        generators: [
          {
            name: 'fixture-generator',
            async generate({ schemaPath } = {}) {
              return {
                kind: 'fixture.wesley.generator.v1',
                schemaPath
              };
            }
          }
        ],
        bundleProfiles: [
          {
            name: 'fixture-bundle-profile',
            format: 'fixture.bundle.v1'
          }
        ],
        realizationVerifiers: [
          {
            name: 'fixture-realization-verifier',
            async verify() {
              return {
                kind: 'fixture.wesley.realization-verifier.v1',
                status: 'pass'
              };
            }
          }
        ]
      },
      holmes: {
        scopes: [{ name: 'fixture-scope' }],
        checks: [
          {
            name: 'fixture-check',
            async check() {
              return {
                kind: 'fixture.holmes.check.v1',
                status: 'pass'
              };
            }
          }
        ],
        evidenceCollectors: [
          {
            name: 'fixture-evidence-collector',
            async collect() {
              return {
                kind: 'fixture.holmes.evidence-collector.v1',
                evidence: []
              };
            }
          }
        ],
        counterfactualProviders: [
          {
            name: 'fixture-counterfactual-provider',
            async analyze() {
              return {
                kind: 'fixture.holmes.counterfactual-provider.v1',
                status: 'clean'
              };
            }
          }
        ]
      },
      watson: {
        verifiers: [
          {
            name: 'fixture-verifier',
            async verify() {
              return {
                kind: 'fixture.watson.verifier.v1',
                status: 'pass'
              };
            }
          }
        ],
        auditProfiles: [
          {
            name: 'fixture-audit-profile',
            verifiers: ['fixture-verifier']
          }
        ]
      },
      moriarty: {
        policyProfiles: [{ name: 'fixture-policy-profile' }],
        judgmentProfiles: [
          {
            name: 'fixture-judgment-profile',
            policies: ['fixture-policy-profile']
          }
        ],
        predictors: [
          {
            name: 'fixture-predictor',
            async predict() {
              return {
                kind: 'fixture.moriarty.predictor.v1',
                prediction: 'neutral'
              };
            }
          }
        ]
      },
      blade: {
        scenarios: [
          {
            name: 'fixture-scenario',
            fixtures: ['fixture-blade-fixture']
          }
        ],
        fixtures: [
          {
            name: 'fixture-blade-fixture',
            async load() {
              return {
                kind: 'fixture.blade.fixture.v1',
                ready: true
              };
            }
          }
        ],
        envSetups: [
          {
            name: 'fixture-env-setup',
            async setup({ environment = 'fixture' } = {}) {
              return {
                kind: 'fixture.blade.env-setup.v1',
                environment,
                ready: true
              };
            }
          }
        ],
        tests: [
          {
            name: 'fixture-blade-test',
            async run({ shouldFail = false } = {}) {
              return {
                kind: 'fixture.blade.test.v1',
                status: shouldFail ? 'fail' : 'pass'
              };
            }
          }
        ],
        gates: [
          {
            name: 'fixture-gate',
            async evaluate({ passed = true } = {}) {
              if (!passed) {
                const error = new Error('fixture gate rejected fixture input');
                error.code = 'FIXTURE_GATE_REJECTED';
                throw error;
              }
              return {
                kind: 'fixture.blade.gate.v1',
                status: 'pass'
              };
            }
          }
        ],
        certificationProfiles: [
          {
            name: 'fixture-certification-profile',
            gates: ['fixture-gate']
          }
        ]
      },
      cli: {
        commands: [{ name: 'fixture-hello' }]
      }
    };
  }

  async registerCliCommands(ctx) {
    new FixtureHelloCommand(ctx);
  }
}

export const wesleyModule = new TestExtensionModule();

export default wesleyModule;
