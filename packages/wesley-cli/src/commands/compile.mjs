import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import { WesleyError, listModuleCapabilities } from '@wesley/core';
import { joinPath } from './path-utils.mjs';
import { runCompileTtd } from './compile-ttd.mjs';
import { runBundleEcho } from './bundle-echo.mjs';
import {
  buildRealizationManifest
} from './realization-integrity.mjs';

const LEGACY_COMPAT_MODULE_NAME = 'wesley-legacy-compile-compat';

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
    const availableTargets = getCompileTargetDescriptors(this.ctx);
    const targets = parseTargets(context.options.target, availableTargets);
    const manifestPath = context.options.manifestOut ?? context.options.witnessOut ?? joinPath(context.options.outDir, 'realization', 'manifest.json');
    const summary = {
      schemaPath: context.schemaPath,
      outDir: context.options.outDir,
      dryRun: Boolean(context.options.dryRun),
      targets,
      manifestPath,
      generatedTargets: {}
    };

    for (const targetName of targets) {
      const descriptor = availableTargets.byName.get(targetName);
      if (!descriptor) {
        throw new WesleyError(
          'INVALID_TARGET',
          `Invalid target: "${targetName}". Valid targets: ${formatTargetList(availableTargets)}`
        );
      }

      const result = await runCompileTargetDescriptor({
        command: this,
        descriptor,
        context,
        outDir: joinPath(context.options.outDir, descriptor.name)
      });

      summary.generatedTargets[descriptor.name] = {
        moduleName: descriptor.moduleName,
        result
      };

      if (descriptor.summaryKey) {
        summary[descriptor.summaryKey] = result;
      }
    }

    const schemaHashes = Object.values(summary.generatedTargets)
      .map((entry) => entry?.result?.schemaHash)
      .filter(Boolean);
    if (schemaHashes.length > 1 && new Set(schemaHashes).size !== 1) {
      throw new WesleyError(
        'SCHEMA_HASH_MISMATCH',
        'Generated targets disagreed on the authored schema hash.'
      );
    }

    if (schemaHashes.length > 0) {
      summary.schemaHash = schemaHashes[0];
    }

    const realizationManifest = await buildRealizationManifest({
      fs: this.ctx.fs,
      crypto: this.ctx.crypto,
      schemaContent: context.schemaContent,
      schemaPath: context.schemaPath,
      outDir: context.options.outDir,
      targets,
      summary,
      dryRun: Boolean(context.options.dryRun)
    });
    summary.realizationManifest = realizationManifest;

    if (!context.options.dryRun) {
      await this.ctx.fs.write(manifestPath, JSON.stringify(realizationManifest, null, 2) + '\n');
    }

    return summary;
  }
}

function getCompileTargetDescriptors(ctx) {
  const byName = new Map();
  const aliases = new Map();
  const ordered = [];

  for (const entry of listModuleCapabilities(
    ctx?.moduleCapabilityRegistry,
    'wesley',
    'targets'
  )) {
    addTargetDescriptor({
      byName,
      aliases,
      ordered,
      moduleName: entry.moduleName,
      target: entry.value
    });
  }

  for (const legacyTarget of legacyCompileTargets()) {
    addTargetDescriptor({
      byName,
      aliases,
      ordered,
      moduleName: LEGACY_COMPAT_MODULE_NAME,
      target: legacyTarget,
      replaceExisting: false
    });
  }

  return { byName, aliases, ordered };
}

function addTargetDescriptor({
  byName,
  aliases,
  ordered,
  moduleName,
  target,
  replaceExisting = true
}) {
  if (target == null || typeof target !== 'object' || Array.isArray(target)) {
    throw new WesleyError(
      'INVALID_TARGET_CAPABILITY',
      `Module "${moduleName}" registered a target capability that is not a plain object.`
    );
  }

  const name = normalizeTargetName(target.name);
  if (!name) {
    throw new WesleyError(
      'INVALID_TARGET_CAPABILITY',
      `Module "${moduleName}" registered a target capability without a non-empty string "name".`
    );
  }

  if (byName.has(name) && !replaceExisting) {
    return;
  }

  const descriptor = {
    ...target,
    name,
    moduleName
  };

  if (byName.has(name)) {
    const existingIndex = ordered.findIndex((item) => item.name === name);
    if (existingIndex >= 0) {
      ordered.splice(existingIndex, 1, descriptor);
    }
  } else {
    ordered.push(descriptor);
  }
  byName.set(name, descriptor);

  for (const alias of target.aliases ?? []) {
    const normalizedAlias = normalizeTargetName(alias);
    if (normalizedAlias) {
      aliases.set(normalizedAlias, name);
    }
  }
}

async function runCompileTargetDescriptor({
  command,
  descriptor,
  context,
  outDir
}) {
  if (typeof descriptor.compile !== 'function') {
    throw new WesleyError(
      'INVALID_TARGET_CAPABILITY',
      `Target "${descriptor.name}" from module "${descriptor.moduleName}" does not provide a compile() hook.`
    );
  }

  return descriptor.compile({
    ctx: command.ctx,
    command,
    schemaContent: context.schemaContent,
    schemaPath: context.schemaPath,
    units: context.units,
    options: context.options,
    logger: context.logger,
    outDir,
    target: descriptor
  });
}

function parseTargets(rawTargets, availableTargets) {
  const targets = String(rawTargets)
    .split(',')
    .map((target) => normalizeRequestedTarget(target, availableTargets))
    .filter(Boolean);

  if (targets.length === 0) {
    throw new WesleyError(
      'INVALID_TARGET',
      `At least one target is required. Valid targets: ${formatTargetList(availableTargets)}`
    );
  }

  for (const target of targets) {
    if (!availableTargets.byName.has(target)) {
      throw new WesleyError(
        'INVALID_TARGET',
        `Invalid target: "${target}". Valid targets: ${formatTargetList(availableTargets)}`
      );
    }
  }

  return targets;
}

function normalizeRequestedTarget(rawTarget, availableTargets) {
  const normalized = normalizeTargetName(rawTarget);
  return availableTargets.aliases.get(normalized) ?? normalized;
}

function normalizeTargetName(rawTarget) {
  return typeof rawTarget === 'string' ? rawTarget.trim().toLowerCase() : '';
}

function formatTargetList(availableTargets) {
  return availableTargets.ordered.map((target) => target.name).join(', ') || '<none>';
}

function legacyCompileTargets() {
  return [
    {
      name: 'warp-ttd',
      aliases: ['ttd'],
      summaryKey: 'warpTtd',
      async compile({ ctx, schemaContent, schemaPath, units, options, logger }) {
        return runCompileTtd({
          ctx,
          schemaContent,
          schemaPath,
          units,
          options: {
            ...options,
            outDir: joinPath(options.outDir, 'warp-ttd'),
            target: options.emit
          },
          logger
        });
      }
    },
    {
      name: 'echo',
      summaryKey: 'echo',
      async compile({ ctx, schemaContent, schemaPath, options, logger }) {
        return runBundleEcho({
          ctx,
          schemaContent,
          schemaPath,
          options: {
            ...options,
            outDir: joinPath(options.outDir, 'echo')
          },
          logger
        });
      }
    }
  ];
}
