import { GeneratorPlugin } from '@wesley/core';
import { generateVue } from './index.mjs';

/**
 * VuePlugin — Canonical GeneratorPlugin adapter for @wesley/generator-vue.
 *
 * This is the unified entrypoint for Vue artifact generation.
 * Wraps generateVue() in the GeneratorPlugin contract so it integrates
 * with the PluginRunner and CLI discovery infrastructure.
 *
 * The legacy direct-import path (`import { generateVue }`) remains
 * available but this plugin is the supported invocation path for
 * production use and CI.
 */
export class VuePlugin extends GeneratorPlugin {
  #outPath = 'types.generated.ts';

  get apiVersion() {
    return '1';
  }

  get name() {
    return 'vue';
  }

  /**
   * @param {Record<string, unknown>} config
   */
  init(config) {
    if (typeof config.outPath === 'string' && config.outPath.length > 0) {
      this.#outPath = config.outPath;
    }
  }

  /**
   * @param {object} schema
   * @param {import('@wesley/core').PluginContext} _context
   * @returns {Promise<import('@wesley/core').GenerationPlan>}
   */
  async plan(schema, _context) {
    return {
      artifacts: [
        { path: this.#outPath, reason: 'Vue TypeScript type definitions' }
      ],
      metadata: {
        ir: schema.ir ?? schema,
        outPath: this.#outPath
      }
    };
  }

  /**
   * @param {import('@wesley/core').GenerationPlan} plan
   * @param {import('@wesley/core').PluginContext} _context
   * @returns {Promise<Record<string, string>>}
   */
  async generate(plan, _context) {
    const { ir, outPath } = plan.metadata;
    const result = await generateVue(ir, { outPath });

    const artifacts = Object.create(null);
    for (const file of result.files) {
      artifacts[file.path] = file.content;
    }
    return artifacts;
  }
}
