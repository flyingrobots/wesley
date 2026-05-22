import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import { WesleyError, listModuleCapabilities } from '@wesley/core';
import { joinPath } from './path-utils.mjs';

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
      .option('-t, --target <targets>', 'Comma-separated module-provided targets. Defaults to all discovered targets.')
      .option('--schema-root <dir>', 'Root directory for resolving @wes_import paths')
      .option('--dry-run', 'Show what would be generated without writing files');
  }

  async executeCore(context) {
    const availableTargets = getCompileTargetDescriptors(this.ctx);
    const targets = parseTargets(context.options.target, availableTargets);
    const summary = {
      schemaPath: context.schemaPath,
      outDir: context.options.outDir,
      dryRun: Boolean(context.options.dryRun),
      targets,
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

  return { byName, aliases, ordered };
}

function addTargetDescriptor({
  byName,
  aliases,
  ordered,
  moduleName,
  target
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

  const descriptor = {
    ...target,
    name,
    moduleName
  };

  if (byName.has(name)) {
    const existing = byName.get(name);
    throw new WesleyError(
      'INVALID_TARGET_CAPABILITY',
      `Compile target "${name}" was registered by both module "${existing.moduleName}" and module "${moduleName}".`
    );
  }
  if (aliases.has(name)) {
    const existingTargetName = aliases.get(name);
    const existing = byName.get(existingTargetName);
    throw new WesleyError(
      'INVALID_TARGET_CAPABILITY',
      `Compile target "${name}" from module "${moduleName}" conflicts with alias registered by target "${existing?.name ?? existingTargetName}" from module "${existing?.moduleName ?? '<unknown>'}".`
    );
  }
  ordered.push(descriptor);
  byName.set(name, descriptor);

  for (const alias of target.aliases ?? []) {
    const normalizedAlias = normalizeTargetName(alias);
    if (normalizedAlias) {
      if (byName.has(normalizedAlias)) {
        const existing = byName.get(normalizedAlias);
        throw new WesleyError(
          'INVALID_TARGET_CAPABILITY',
          `Compile target alias "${normalizedAlias}" from module "${moduleName}" conflicts with target "${existing.name}" from module "${existing.moduleName}".`
        );
      }
      if (aliases.has(normalizedAlias)) {
        const existingTargetName = aliases.get(normalizedAlias);
        const existing = byName.get(existingTargetName);
        throw new WesleyError(
          'INVALID_TARGET_CAPABILITY',
          `Compile target alias "${normalizedAlias}" was registered by both module "${existing?.moduleName ?? '<unknown>'}" and module "${moduleName}".`
        );
      }
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
  if (typeof rawTargets !== 'string' || rawTargets.trim().length === 0) {
    const discoveredTargets = availableTargets.ordered.map((target) => target.name);
    if (discoveredTargets.length === 0) {
      throw new WesleyError(
        'NO_COMPILE_TARGETS',
        'No compile targets are available. Load a Wesley module that registers wesley.targets.'
      );
    }
    return discoveredTargets;
  }

  const targets = rawTargets
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
