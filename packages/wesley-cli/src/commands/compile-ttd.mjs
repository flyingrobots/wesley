/**
 * Compile-TTD Command - Compile GraphQL SDL with TTD directives
 *
 * Extracts TTD protocol definitions and generates:
 * - manifest/: JSON manifests (schema.json, contracts.json, manifest.json, ttd-ir.json)
 * - typescript/: TypeScript types, Zod validators, registry
 */

import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import { compileTtdProtocol } from '@wesley/core/ttd';

export class CompileTtdCommand extends WesleyCommand {
  constructor(ctx) {
    super(ctx, 'compile-ttd', 'Compile GraphQL schema with TTD directives to manifests and code');
    this.requiresSchema = true;
  }

  configureCommander(cmd) {
    return cmd
      .option('-s, --schema <path>', 'GraphQL schema file with TTD directives. Use "-" for stdin', 'schema.graphql')
      .option('--stdin', 'Read schema from stdin')
      .option('-o, --out-dir <dir>', 'Output directory', 'ttd-out')
      .option('-t, --target <targets>', 'Comma-separated targets: manifest, typescript, rust', 'manifest,typescript')
      .option('--dry-run', 'Show what would be generated without writing files');
  }

  async executeCore({ schemaContent, schemaPath, options, logger }) {
    const fs = this.ctx.fs;
    const clock = this.ctx.clock;
    const crypto = this.ctx.crypto;

    // Parse targets
    const targets = options.target.split(',').map(t => t.trim().toLowerCase());
    const validTargets = ['manifest', 'typescript', 'rust'];
    for (const t of targets) {
      if (!validTargets.includes(t)) {
        const e = new Error(`Invalid target: "${t}". Valid targets: ${validTargets.join(', ')}`);
        e.code = 'INVALID_TARGET';
        throw e;
      }
    }

    // Only log in non-JSON mode (JSON mode outputs structured result only)
    if (!options.json) {
      logger?.info?.(`Compiling TTD protocol from ${schemaPath}`);
      logger?.debug?.(`Targets: ${targets.join(', ')}`);
    }

    // Compile TTD protocol
    const deps = {};
    if (clock) deps.clock = clock;
    if (crypto) deps.crypto = crypto;

    let result;
    try {
      result = await compileTtdProtocol({
        sdl: schemaContent,
        targets,
        deps,
      });
    } catch (error) {
      const e = new Error(`TTD compilation failed: ${error.message}`);
      e.code = 'TTD_COMPILE_FAILED';
      e.cause = error;
      throw e;
    }

    const outDir = options.outDir;
    const filesWritten = [];

    // Write files (unless dry-run)
    if (!options.dryRun) {
      for (const file of result.files) {
        const fullPath = `${outDir}/${file.path}`;

        // Ensure directory exists
        const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
        await this.ensureDir(fs, dir);

        await fs.write(fullPath, file.content);
        filesWritten.push(fullPath);
        if (!options.json) {
          logger?.debug?.(`Wrote: ${fullPath}`);
        }
      }
    }

    // Report results
    const summary = {
      schemaHash: result.schemaHash,
      files: result.files.map(f => ({
        path: options.dryRun ? f.path : `${outDir}/${f.path}`,
        size: f.content.length,
      })),
      targets,
      validation: result.validation,
      dryRun: options.dryRun || false,
    };

    if (!options.quiet && !options.json) {
      const action = options.dryRun ? 'Would generate' : 'Generated';
      logger?.info?.(`\n${action} ${result.files.length} files:`);
      for (const file of summary.files) {
        logger?.info?.(`  ${file.path} (${file.size} bytes)`);
      }
      logger?.info?.(`\nSchema hash: ${result.schemaHash}`);
      if (!options.dryRun) {
        logger?.info?.(`\nOutput directory: ${outDir}`);
      }
    }

    return summary;
  }

  /**
   * Ensure directory exists (recursive mkdir)
   */
  async ensureDir(fs, dir) {
    const parts = dir.split('/').filter(Boolean);
    let current = dir.startsWith('/') ? '' : '.';

    for (const part of parts) {
      current = current === '.' ? part : `${current}/${part}`;
      try {
        const exists = await fs.exists(current);
        if (!exists) {
          await fs.mkdir?.(current);
        }
      } catch {
        // Try to create anyway - might fail if it exists or can't be created
        try {
          await fs.mkdir?.(current);
        } catch {
          // Ignore - parent might exist or we'll fail on write
        }
      }
    }
  }
}

export default CompileTtdCommand;
