/**
 * Transform Command - Alias of Generate, new primary verb
 */

import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import GeneratePipelineCommand from './generate.mjs';

export class TransformPipelineCommand extends WesleyCommand {
  constructor(ctx) {
    super(ctx, 'transform', 'Transform GraphQL schema into SQL/Types/Zod/pgTAP');
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

export default TransformPipelineCommand;

