// wesley-generator-echo/src/EchoPlugin.mjs

import { GeneratorPlugin, schemaHash, registryHash, canonicalize, computeHashChain } from '@wesley/core';
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
  async plan(schema, _context) {
    return {
      artifacts: [
        { path: 'ir.json', reason: 'Echo IR (echo-ir/v2)' },
        { path: 'ops.generated.ts', reason: 'Operation IDs and metadata' },
        { path: 'schemas.generated.ts', reason: 'Validation schemas' },
        { path: 'client.generated.ts', reason: 'Type-safe client helpers' }
      ],
      metadata: {
        sdl: schema.sdl,
        mutationIdNamespace: this.#mutationIdNamespace,
        queryNamespace: this.#queryNamespace
      }
    };
  }

  /**
   * @param {import('@wesley/core').GenerationPlan} plan
   * @param {import('@wesley/core').PluginContext} context
   * @returns {Promise<Record<string, string>>}
   */
  async generate(plan, _context) {
    const { sdl, mutationIdNamespace, queryNamespace } = plan.metadata;
    const result = await generateEcho({ sdl, mutationIdNamespace, queryNamespace });

    if (result == null || !Array.isArray(result.files)) {
      throw new Error(
        'generateEcho() returned unexpected shape: expected { files: Array }, ' +
        `got ${result == null ? String(result) : JSON.stringify(Object.keys(result))}`
      );
    }

    // Replace raw SDL hash with canonical schema hash
    const canonicalHash = await schemaHash(sdl);
    const canonicalBytes = canonicalize(sdl);
    const artifacts = Object.create(null);

    /** @type {object|undefined} */
    let parsedIr;

    for (const file of result.files) {
      if (file.path === 'ir.json') {
        const ir = JSON.parse(file.content);
        ir.schema_sha256 = canonicalHash;
        ir.schema_hash = canonicalHash;

        // Compute registry_hash over the registry portion of the IR
        // (everything except the hash metadata fields themselves)
        const { schema_sha256: _s, schema_hash: _sh, registry_hash: _r, hash_chain: _h, ...registryBlob } = ir;
        ir.registry_hash = await registryHash(registryBlob);

        parsedIr = ir;
        // Serialize without hash_chain first; it gets added after bundle hash
        artifacts[file.path] = JSON.stringify(ir, null, 2);
      } else {
        artifacts[file.path] = file.content;
      }
    }

    // Compute full hash chain (E1.4)
    if (parsedIr) {
      const { schema_sha256: _s, schema_hash: _sh, registry_hash: _rh, hash_chain: _hc, ...registryBlob } = parsedIr;
      const { schema_sha256: _s2, schema_hash: _sh2, registry_hash: _rh2, hash_chain: _hc2, ...irBlob } = parsedIr;

      const hashChain = await computeHashChain({
        sdl,
        canonicalBytes,
        irData: irBlob,
        registryData: registryBlob,
        artifacts
      });

      parsedIr.hash_chain = hashChain;
      artifacts['ir.json'] = JSON.stringify(parsedIr, null, 2);
    }

    return artifacts;
  }
}
