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
      .option('--dry-run', 'Show what would be generated without writing files')
      .option('--unit <units...>', 'Compilation unit IDs to generate for (repeatable or comma-separated)')
      .option('--schema-root <dir>', 'Root directory for resolving @wes_import paths')
      .option('--qualified-names', 'Preserve mangled/qualified type names in output (default: demangle to short names)')
      .option('--print-composed-sdl', 'Print the effective SDL to stdout before compilation (debug)')
      .option('--print-ir', 'Print the TTD compilation result as JSON to stdout (debug)');
  }

  async executeCore(context) {
    const { schemaContent, schemaPath, options, logger } = context;
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

    // ── Compute effective SDL: composition filtering + demangling ──

    let effectiveSdl = schemaContent;

    if (context.units) {
      const {
        composeUnits,
        buildDemangleMap,
        demangleSdl,
        validateFilteredSdl
      } = await import('@wesley/core/domain/SchemaResolver');

      // Apply --unit filter if specified
      const unitFilter = options.unit ? options.unit.flatMap(u => u.split(',')).map(s => s.trim()).filter(Boolean) : null;
      if (unitFilter) {
        const composed = composeUnits(context.units, unitFilter);
        effectiveSdl = composed.sdl;
      }

      // Demangle type names for clean TTD output (unless --qualified-names).
      // buildDemangleMap uses the full context.units (not activeUnits) because
      // demangling must map all mangled symbols across the entire composition.
      if (!options.qualifiedNames) {
        const demangleMap = buildDemangleMap(context.units);
        effectiveSdl = demangleSdl(effectiveSdl, demangleMap);
      }

      // Validate that the filtered SDL isn't missing types from excluded units
      if (unitFilter) {
        const diag = validateFilteredSdl(effectiveSdl, context.units, unitFilter);
        if (diag) {
          const lines = diag.missing.map(m =>
            m.definedIn
              ? `  ${m.type} (defined in ${m.definedIn})`
              : `  ${m.type} (unknown source)`
          );
          const e = new Error(
            'Filtered SDL references types not included in the selected units:\n' +
            lines.join('\n') + '\n\n' +
            `You asked for units: ${unitFilter?.join(', ')}\n` +
            'Add the missing units with --unit or compile the full schema.'
          );
          e.code = 'SCHEMA_RESOLUTION_FAILED';
          throw e;
        }
      }
    } else if (options.unit) {
      const e = new Error(
        '--unit requires a composed schema (with @wes_import/@wes_package directives).\n' +
        `The schema at ${schemaPath} has no composition directives.`
      );
      e.code = 'UNSUPPORTED_OPTION';
      throw e;
    }

    // ── Debug: print composed SDL ──

    const debugDump = options.printComposedSdl || options.printIr;

    if (options.printComposedSdl) {
      this.ctx.stdout.write(effectiveSdl + '\n');
      if (options.dryRun) {
        return { files: [], dryRun: true };
      }
    }

    if (!options.json && !debugDump) {
      logger?.info?.(`Compiling TTD protocol from ${schemaPath}`);
      logger?.debug?.(`Targets: ${targets.join(', ')}`);
    }

    // ── Compile TTD protocol ──

    const deps = {};
    if (clock) deps.clock = clock;
    if (crypto) deps.crypto = crypto;

    let result;
    try {
      result = await compileTtdProtocol({
        sdl: effectiveSdl,
        targets,
        deps
      });
    } catch (error) {
      const e = new Error(`TTD compilation failed: ${error.message}`);
      e.code = 'TTD_COMPILE_FAILED';
      e.cause = error;
      throw e;
    }

    // ── Debug: print IR ──

    if (options.printIr) {
      this.ctx.stdout.write(JSON.stringify(result, (key, val) => {
        // Omit file contents from IR dump to keep output readable
        if (key === 'content' && typeof val === 'string' && val.length > 200) {
          return `<${val.length} bytes>`;
        }
        return val;
      }, 2) + '\n');
      if (options.dryRun) {
        return { files: result.files.map(f => ({ path: f.path, size: f.content.length })), dryRun: true };
      }
    }

    // ── Write files ──

    const outDir = options.outDir;
    const filesWritten = [];

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

    // ── Report results ──

    const summary = {
      schemaHash: result.schemaHash,
      files: result.files.map(f => ({
        path: options.dryRun ? f.path : `${outDir}/${f.path}`,
        size: f.content.length
      })),
      targets,
      validation: result.validation,
      dryRun: options.dryRun || false
    };

    if (!options.quiet && !options.json && !debugDump) {
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
