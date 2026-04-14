/**
 * Compile-TTD Command - Compile GraphQL SDL with TTD directives
 *
 * Extracts TTD protocol definitions and generates:
 * - manifest/: JSON manifests (schema.json, contracts.json, manifest.json, ttd-ir.json)
 * - typescript/: TypeScript types, Zod validators, registry
 */

import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import { compileTtdProtocol } from '@wesley/core/ttd';
import { WesleyError } from '@wesley/core';
import { resolveWarpspaceOutputDir } from '../utils/warpspace.mjs';

const DEFAULT_TTD_OUT_DIR = 'ttd-out';

export class CompileTtdCommand extends WesleyCommand {
  constructor(ctx) {
    super(ctx, 'compile-ttd', 'Compile GraphQL schema with TTD directives to manifests and code');
    this.requiresSchema = true;
  }

  configureCommander(cmd) {
    return cmd
      .option('-s, --schema <path>', 'GraphQL schema file with TTD directives. Use "-" for stdin', 'schema.graphql')
      .option('--stdin', 'Read schema from stdin')
      .option('-o, --out-dir <dir>', 'Output directory')
      .option('--warpspace <path>', 'Path to host-project warpspace.mjs')
      .option('-t, --target <targets>', 'Comma-separated targets: manifest, typescript, rust', 'manifest,typescript')
      .option('--dry-run', 'Show what would be generated without writing files')
      .option('--unit <units...>', 'Compilation unit IDs to generate for (repeatable or comma-separated)')
      .option('--schema-root <dir>', 'Root directory for resolving @wes_import paths')
      .option('--qualified-names', 'Preserve mangled/qualified type names in output (default: demangle to short names)')
      .option('--print-composed-sdl', 'Print the effective SDL to stdout before compilation (debug)')
      .option('--print-ir', 'Print the TTD compilation result as JSON to stdout (debug)');
  }

  async executeCore(context) {
    return runCompileTtd({
      ctx: this.ctx,
      schemaContent: context.schemaContent,
      schemaPath: context.schemaPath,
      units: context.units,
      options: {
        ...context.options,
        outDir: await resolveWarpspaceOutputDir({
          outputKeys: ['warp-ttd', 'ttd'],
          explicitOutDir: context.options.outDir,
          defaultOutDir: DEFAULT_TTD_OUT_DIR,
          cwd: process.cwd(),
          env: this.ctx.env,
          warpspacePath: context.options.warpspace
        })
      },
      logger: context.logger
    });
  }
}

export async function runCompileTtd({
  ctx,
  schemaContent,
  schemaPath,
  units,
  options,
  logger
}) {
  const fs = ctx.fs;
  const clock = ctx.clock;
  const crypto = ctx.crypto;

  const targets = options.target.split(',').map(t => t.trim().toLowerCase());
  const validTargets = ['manifest', 'typescript', 'rust'];
  for (const target of targets) {
    if (!validTargets.includes(target)) {
      throw new WesleyError('INVALID_TARGET', `Invalid target: "${target}". Valid targets: ${validTargets.join(', ')}`);
    }
  }

  let effectiveSdl = schemaContent;

  if (units) {
    const {
      composeUnits,
      buildDemangleMap,
      demangleSdl,
      validateFilteredSdl
    } = await import('@wesley/core/domain/SchemaResolver');

    const unitFilter = options.unit ? options.unit.flatMap(u => u.split(',')).map(s => s.trim()).filter(Boolean) : null;
    if (unitFilter) {
      const composed = composeUnits(units, unitFilter);
      effectiveSdl = composed.sdl;
    }

    if (!options.qualifiedNames) {
      const demangleMap = buildDemangleMap(units);
      effectiveSdl = demangleSdl(effectiveSdl, demangleMap);
    }

    if (unitFilter) {
      const diag = validateFilteredSdl(effectiveSdl, units, unitFilter);
      if (diag) {
        const lines = diag.missing.map(m =>
          m.definedIn
            ? `  ${m.type} (defined in ${m.definedIn})`
            : `  ${m.type} (unknown source)`
        );
        throw new WesleyError(
          'SCHEMA_RESOLUTION_FAILED',
          'Filtered SDL references types not included in the selected units:\n' +
          lines.join('\n') + '\n\n' +
          `You asked for units: ${unitFilter.join(', ')}\n` +
          'Add the missing units with --unit or compile the full schema.'
        );
      }
    }
  } else if (options.unit) {
    throw new WesleyError(
      'UNSUPPORTED_OPTION',
      '--unit requires a composed schema (with @wes_import/@wes_package directives).\n' +
      `The schema at ${schemaPath} has no composition directives.`
    );
  }

  const debugDump = options.printComposedSdl || options.printIr;

  if (options.printComposedSdl) {
    ctx.stdout.write(effectiveSdl + '\n');
    if (options.dryRun) {
      return { files: [], dryRun: true };
    }
  }

  if (!options.json && !debugDump) {
    logger?.info?.(`Compiling TTD protocol from ${schemaPath}`);
    logger?.debug?.(`Targets: ${targets.join(', ')}`);
  }

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
    throw error instanceof WesleyError
      ? error
      : new WesleyError('TTD_COMPILE_FAILED', `TTD compilation failed: ${error.message}`, {}, error);
  }

  if (options.printIr) {
    ctx.stdout.write(JSON.stringify(result, (key, value) => {
      if (key === 'content' && typeof value === 'string' && value.length > 200) {
        return `<${value.length} bytes>`;
      }
      return value;
    }, 2) + '\n');
    if (options.dryRun) {
      return {
        files: result.files.map(file => ({ path: file.path, size: file.content.length })),
        dryRun: true
      };
    }
  }

  const outDir = options.outDir;

  if (!options.dryRun) {
    for (const file of result.files) {
      const fullPath = `${outDir}/${file.path}`;
      const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
      await ensureDir(fs, dir);
      await fs.write(fullPath, file.content);
      if (!options.json) {
        logger?.debug?.(`Wrote: ${fullPath}`);
      }
    }
  }

  const summary = {
    schemaHash: result.schemaHash,
    files: result.files.map(file => ({
      path: options.dryRun ? file.path : `${outDir}/${file.path}`,
      size: file.content.length
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

async function ensureDir(fs, dir) {
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
      try {
        await fs.mkdir?.(current);
      } catch {
        // Ignore - parent might exist or we'll fail on write.
      }
    }
  }
}
