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

  async registerCliCommands(ctx) {
    new FixtureHelloCommand(ctx);
  }
}

export const wesleyModule = new TestExtensionModule();

export default wesleyModule;
