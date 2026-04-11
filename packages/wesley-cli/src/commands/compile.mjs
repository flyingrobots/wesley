import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import { WesleyError } from '@wesley/core';
import { canonicalizeSchemaPath, joinPath } from './path-utils.mjs';
import { runCompileTtd } from './compile-ttd.mjs';
import { runBundleEcho } from './bundle-echo.mjs';

const VALID_TARGETS = ['warp-ttd', 'echo'];
const LEGACY_TARGET_ALIASES = new Map([['ttd', 'warp-ttd']]);
const REALIZATION_MANIFEST_KIND = 'wesley.realization.manifest.v1';

export class CompileCommand extends WesleyCommand {
  constructor(ctx) {
    super(
      ctx,
      'compile',
      'Compile one GraphQL contract family to one or more generated targets'
    );
    this.requiresSchema = true;
  }

  configureCommander(cmd) {
    return cmd
      .option('-s, --schema <path>', 'GraphQL schema file. Use "-" for stdin', 'schema.graphql')
      .option('--stdin', 'Read schema from stdin')
      .option('-o, --out-dir <dir>', 'Root output directory', 'out')
      .option('-t, --target <targets>', 'Comma-separated targets: warp-ttd, echo', 'warp-ttd,echo')
      .option('-e, --emit <targets>', 'Comma-separated warp-ttd emits: manifest, typescript, rust', 'manifest,typescript')
      .option('--manifest-out <path>', 'Realization manifest output path (defaults under <out-dir>/realization/manifest.json)')
      .option('--witness-out <path>', 'Deprecated alias for --manifest-out')
      .option('--schema-root <dir>', 'Root directory for resolving @wes_import paths')
      .option('--dry-run', 'Show what would be generated without writing files');
  }

  async executeCore(context) {
    const targets = parseTargets(context.options.target);
    const manifestPath = context.options.manifestOut ?? context.options.witnessOut ?? joinPath(context.options.outDir, 'realization', 'manifest.json');
    const summary = {
      schemaPath: context.schemaPath,
      outDir: context.options.outDir,
      dryRun: Boolean(context.options.dryRun),
      targets,
      manifestPath
    };

    if (targets.includes('warp-ttd')) {
      summary.warpTtd = await runCompileTtd({
        ctx: this.ctx,
        schemaContent: context.schemaContent,
        schemaPath: context.schemaPath,
        units: context.units,
        options: {
          ...context.options,
          outDir: joinPath(context.options.outDir, 'warp-ttd'),
          target: context.options.emit
        },
        logger: context.logger
      });
    }

    if (targets.includes('echo')) {
      summary.echo = await runBundleEcho({
        ctx: this.ctx,
        schemaContent: context.schemaContent,
        schemaPath: context.schemaPath,
        options: {
          ...context.options,
          outDir: joinPath(context.options.outDir, 'echo')
        },
        logger: context.logger
      });
    }

    const schemaHashes = [summary.warpTtd?.schemaHash, summary.echo?.schemaHash].filter(Boolean);
    if (schemaHashes.length > 1 && new Set(schemaHashes).size !== 1) {
      throw new WesleyError(
        'SCHEMA_HASH_MISMATCH',
        'Generated targets disagreed on the authored schema hash.'
      );
    }

    if (schemaHashes.length > 0) {
      summary.schemaHash = schemaHashes[0];
    }

    const realizationManifest = buildRealizationManifest({
      schemaPath: context.schemaPath,
      outDir: context.options.outDir,
      targets,
      summary
    });
    summary.realizationManifest = realizationManifest;

    if (!context.options.dryRun) {
      await this.ctx.fs.write(manifestPath, JSON.stringify(realizationManifest, null, 2) + '\n');
    }

    return summary;
  }
}

function buildRealizationManifest({ schemaPath, outDir, targets, summary }) {
  return {
    kind: REALIZATION_MANIFEST_KIND,
    schemaPath,
    canonicalSchemaPath: canonicalizeSchemaPath(schemaPath),
    schemaHash: summary.schemaHash ?? null,
    outDir,
    targets,
    generatedLegs: {
      warpTtd: summary.warpTtd == null
        ? null
        : {
          outDir: joinPath(outDir, 'warp-ttd'),
          schemaHash: summary.warpTtd.schemaHash,
          targets: summary.warpTtd.targets,
          files: summary.warpTtd.files
        },
      echo: summary.echo == null
        ? null
        : {
          outDir: summary.echo.outDir,
          schemaHash: summary.echo.schemaHash,
          artifactCount: summary.echo.echo.artifactCount,
          files: buildEchoLegFiles(summary.echo)
        }
    },
    proves: [
      'one authored schema path was compiled into one or more generated consumer legs',
      'generated legs share one authored schema hash',
      'the emitted files for each selected target are inspectable from this realization manifest'
    ],
    doesNotProve: [
      'cross-leg conformance beyond shared schema identity',
      'runtime semantics',
      'storage semantics',
      'debugger semantics',
      'compile-time footprint safety in neighboring runtimes'
    ]
  };
}

function parseTargets(rawTargets) {
  const targets = String(rawTargets)
    .split(',')
    .map(target => LEGACY_TARGET_ALIASES.get(target.trim().toLowerCase()) ?? target.trim().toLowerCase())
    .filter(Boolean);

  if (targets.length === 0) {
    throw new WesleyError('INVALID_TARGET', `At least one target is required. Valid targets: ${VALID_TARGETS.join(', ')}`);
  }

  for (const target of targets) {
    if (!VALID_TARGETS.includes(target)) {
      throw new WesleyError('INVALID_TARGET', `Invalid target: "${target}". Valid targets: ${VALID_TARGETS.join(', ')}`);
    }
  }

  return targets;
}

function buildEchoLegFiles(echoSummary) {
  return [
    ...echoSummary.echo.files,
    {
      path: relativeToOutDir(echoSummary.outDir, echoSummary.mock.outputPath),
      size: null
    },
    {
      path: relativeToOutDir(echoSummary.outDir, echoSummary.mock.summaryPath),
      size: null
    }
  ];
}

function relativeToOutDir(outDir, targetPath) {
  if (targetPath == null) {
    return null;
  }

  const normalizedOutDir = joinPath(outDir);
  const normalizedTargetPath = joinPath(targetPath);
  if (normalizedTargetPath === normalizedOutDir) {
    return '.';
  }
  if (normalizedTargetPath.startsWith(`${normalizedOutDir}/`)) {
    return normalizedTargetPath.slice(normalizedOutDir.length + 1);
  }
  return normalizedTargetPath;
}
