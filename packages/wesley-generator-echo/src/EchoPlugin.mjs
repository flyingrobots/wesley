// wesley-generator-echo/src/EchoPlugin.mjs

import { GeneratorPlugin } from '@wesley/core';
import { generateEcho } from './index.mjs';

/**
 * EchoPlugin - Adapter wrapping generateEcho() in the GeneratorPlugin contract.
 *
 * Delegates to the existing generateEcho() function and reshapes
 * { files: [{path, content}] } → Record<string, string>.
 *
 * Original generateEcho() export remains untouched for backward compatibility.
 * Adapter path is canonical from E0.2 onward.
 */
export class EchoPlugin extends GeneratorPlugin {
  #mutationIdNamespace = 'Mutation';
  #queryNamespace = 'Query';

  get apiVersion() {
    return '1';
  }

  get name() {
    return 'echo';
  }

  /**
   * @param {Record<string, unknown>} config
   */
  init(config) {
    if (config.mutationIdNamespace !== undefined) {
      this.#mutationIdNamespace = config.mutationIdNamespace;
    }
    if (config.queryNamespace !== undefined) {
      this.#queryNamespace = config.queryNamespace;
    }
  }

  /**
   * @param {object} schema
   * @param {import('@wesley/core').PluginContext} context
   * @returns {Promise<import('@wesley/core').GenerationPlan>}
   */
  async plan(schema, context) {
    return {
      artifacts: [
        { path: 'ir.json', reason: 'Echo IR (echo-ir/v1)' },
        { path: 'ops.generated.ts', reason: 'Operation IDs and metadata' },
        { path: 'schemas.generated.ts', reason: 'Validation schemas' },
        { path: 'client.generated.ts', reason: 'Type-safe client helpers' },
      ],
      metadata: {
        sdl: schema.sdl,
        mutationIdNamespace: this.#mutationIdNamespace,
        queryNamespace: this.#queryNamespace,
      },
    };
  }

  /**
   * @param {import('@wesley/core').GenerationPlan} plan
   * @param {import('@wesley/core').PluginContext} context
   * @returns {Promise<Record<string, string>>}
   */
  async generate(plan, context) {
    const { sdl, mutationIdNamespace, queryNamespace } = plan.metadata;
    const result = await generateEcho({ sdl, mutationIdNamespace, queryNamespace });

    const artifacts = Object.create(null);
    for (const file of result.files) {
      artifacts[file.path] = file.content;
    }
    return artifacts;
  }
}
