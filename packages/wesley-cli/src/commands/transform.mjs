/**
 * Transform Command - Primary transmutation verb
 */

import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import { GeneratePipelineCommand } from './generate.mjs';

export class TransformPipelineCommand extends WesleyCommand {
  constructor(ctx) {
    super(ctx, 'transform', 'Run a named transmutation against a GraphQL schema');
    this.requiresSchema = true;
    this._delegate = new GeneratePipelineCommand(ctx);
  }

  configureCommander(cmd) {
    return this._delegate.configureCommander(cmd);
  }

  async executeCore(context) {
    return this._delegate.executeCore(context);
  }
}
