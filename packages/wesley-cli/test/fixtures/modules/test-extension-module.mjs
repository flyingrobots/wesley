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
        targets: [{
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
        }],
        generators: [{ name: 'fixture-generator' }]
      },
      holmes: {
        scopes: [{ name: 'fixture-scope' }]
      },
      watson: {
        verifiers: [{ name: 'fixture-verifier' }]
      },
      moriarty: {
        policyProfiles: [{ name: 'fixture-policy' }]
      },
      blade: {
        gates: [{ name: 'fixture-gate' }]
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
