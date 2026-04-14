import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { WesleyError } from '@wesley/core';
import {
  CONTINUUM_CONTRACT_PROFILE,
  resolveContinuumContractBundleProfile
} from '@wesley/continuum';
import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import { runCompileTtd } from './compile-ttd.mjs';
import { runBundleEcho } from './bundle-echo.mjs';
import { buildRealizationManifest } from './realization-integrity.mjs';
import {
  buildContinuumWitnessReport,
  resolveContinuumWitnessOptions
} from './continuum-witness-report.mjs';
import { canonicalizeSchemaPath, joinPath } from './path-utils.mjs';

const CONTRACT_BUNDLE_KIND = 'wesley.contract.bundle.v1';
const CONTRACT_SYNC_KIND = 'wesley.contract.sync.v1';
const CONTRACT_AUTHORITY_KIND = 'wesley.contract.bundle.authority.v1';
const CLI_PACKAGE_NAME = '@wesley/cli';
const CLI_PACKAGE_VERSION = '0.1.0';
const PROFILE_PACKAGE_NAME = '@wesley/continuum';
const VALID_TARGETS = ['warp-ttd', 'echo'];
const LEGACY_TARGET_ALIASES = new Map([['ttd', 'warp-ttd']]);
const REQUIRED_WARP_TTD_EMITS = ['manifest', 'typescript'];

export class ContractCommand extends WesleyCommand {
  constructor(ctx) {
    super(ctx, 'contract', 'Release and sync versioned contract bundles');
  }

  configureCommander(cmd) {
    cmd
      .command('release')
      .description('Assemble one versioned contract bundle from one authored family')
      .requiredOption('--family <name>', 'Contract family name')
      .requiredOption('--release <semver>', 'Contract family release semver')
      .option('--profile <name>', 'Product profile', CONTINUUM_CONTRACT_PROFILE)
      .option('--schema <path>', 'Authored GraphQL schema path. Use "-" for stdin when releasing from a piped schema')
      .option('--stdin', 'Read schema from stdin')
      .option('--bundle-out <dir>', 'Bundle output directory (defaults under .wesley-cache/contracts/...)')
      .option('-t, --target <targets>', 'Comma-separated targets: warp-ttd, echo', 'warp-ttd,echo')
      .option('-e, --emit <targets>', 'Comma-separated warp-ttd emits: manifest, typescript, rust', 'manifest,typescript')
      .option('--authority-repo <repo>', 'Foreign authored-home repository identifier')
      .option('--authority-ref <ref>', 'Foreign authored-home ref or tag')
      .option('--authority-commit <sha>', 'Foreign authored-home commit SHA')
      .option('--authority-path <path>', 'Authored-home schema path as declared by the owning repo')
      .action((options, command) => {
        return this.execute({
          ...mergeCommandOptions(command),
          ...options,
          _contractSubcommand: 'release'
        }, command);
      });

    cmd
      .command('sync')
      .description('Sync generated consumer projections from a released bundle')
      .requiredOption('--bundle <dir>', 'Contract bundle root directory')
      .requiredOption('--consumer <name>', 'Consumer kind declared by the product profile')
      .requiredOption('--repo <path>', 'Consumer repository root')
      .option('--profile <name>', 'Product profile', CONTINUUM_CONTRACT_PROFILE)
      .option('--dry-run', 'Show which files would be synchronized without writing them')
      .action((options, command) => {
        return this.execute({
          ...mergeCommandOptions(command),
          ...options,
          _contractSubcommand: 'sync'
        }, command);
      });

    return cmd;
  }

  async executeCore(context) {
    if (context.options._contractSubcommand === 'release') {
      return this.executeRelease(context);
    }
    if (context.options._contractSubcommand === 'sync') {
      return this.executeSync(context);
    }

    context.command?.outputHelp?.();
    return;
  }

  async executeRelease({ options, logger }) {
    const profile = resolveContractProfile({
      profile: options.profile,
      family: options.family,
      release: options.release,
      schemaPath: options.schema,
      bundleOut: options.bundleOut,
      authorityRepository: options.authorityRepo,
      authorityRef: options.authorityRef,
      authorityCommit: options.authorityCommit,
      authorityPath: options.authorityPath
    });
    const schemaData = await this.readSchemaFromOptions({
      ...options,
      schema: options.schema ?? profile.schemaPath
    });
    const selectedTargets = parseTargets(options.target);
    ensureRequiredTargets({
      selectedTargets,
      requiredTargets: profile.targets
    });
    ensureRequiredWarpTtdEmits(options.emit);

    const summary = {
      schemaPath: schemaData.schemaPath,
      outDir: profile.targetsRoot,
      dryRun: false,
      targets: selectedTargets
    };

    if (selectedTargets.includes('warp-ttd')) {
      summary.warpTtd = await runCompileTtd({
        ctx: this.ctx,
        schemaContent: schemaData.schemaContent,
        schemaPath: schemaData.schemaPath,
        units: schemaData.units,
        options: {
          ...options,
          dryRun: false,
          outDir: joinPath(profile.targetsRoot, 'warp-ttd'),
          target: options.emit
        },
        logger
      });
    }

    if (selectedTargets.includes('echo')) {
      summary.echo = await runBundleEcho({
        ctx: this.ctx,
        schemaContent: schemaData.schemaContent,
        schemaPath: schemaData.schemaPath,
        options: {
          ...options,
          dryRun: false,
          outDir: joinPath(profile.targetsRoot, 'echo')
        },
        logger
      });
    }

    const schemaHashes = [summary.warpTtd?.schemaHash, summary.echo?.schemaHash].filter(Boolean);
    if (schemaHashes.length === 0) {
      throw new WesleyError(
        'CONTRACT_RELEASE_NO_TARGETS',
        'Contract release requires at least one generated target.'
      );
    }
    if (new Set(schemaHashes).size !== 1) {
      throw new WesleyError(
        'CONTRACT_RELEASE_SCHEMA_HASH_MISMATCH',
        'Generated targets disagreed on the authored schema hash.'
      );
    }
    summary.schemaHash = schemaHashes[0];

    const realizationManifest = await buildRealizationManifest({
      fs: this.ctx.fs,
      crypto: this.ctx.crypto,
      schemaContent: schemaData.schemaContent,
      schemaPath: schemaData.schemaPath,
      outDir: profile.targetsRoot,
      targets: selectedTargets,
      summary,
      dryRun: false
    });
    await this.ctx.fs.write(profile.realizationPath, JSON.stringify(realizationManifest, null, 2) + '\n');

    const witnessOptions = resolveContinuumWitnessOptions({
      scope: profile.scope,
      schemaPath: schemaData.schemaPath,
      outDir: profile.bundleRoot,
      ttdSchemaPath: schemaData.schemaPath,
      ttdDir: joinPath(profile.targetsRoot, 'warp-ttd'),
      echoSchemaPath: schemaData.schemaPath,
      echoDir: joinPath(profile.targetsRoot, 'echo'),
      realizationRoot: joinPath(profile.bundleRoot, 'realization'),
      outputPath: profile.witnessPath,
      proves: profile.proves,
      doesNotProve: profile.doesNotProve
    });
    const witnessReport = await buildContinuumWitnessReport({
      fs: this.ctx.fs,
      crypto: this.ctx.crypto,
      ...witnessOptions
    });
    await this.ctx.fs.write(profile.witnessPath, JSON.stringify(witnessReport, null, 2) + '\n');
    if (witnessReport.status !== 'pass') {
      throw new WesleyError(
        'CONTRACT_RELEASE_WITNESS_FAILED',
        `Contract release witness failed ${witnessReport.summary.failed} check(s). See ${profile.witnessPath}.`
      );
    }

    const authority = buildAuthorityDescriptor({
      profile,
      schemaPath: schemaData.schemaPath,
      sourceHash: summary.schemaHash
    });
    await this.ctx.fs.write(profile.sourceAuthorityPath, JSON.stringify(authority, null, 2) + '\n');
    await this.ctx.fs.write(profile.sourceSnapshotPath, ensureTrailingNewline(schemaData.schemaContent));

    const bundleManifest = await buildContractBundleManifest({
      fs: this.ctx.fs,
      crypto: this.ctx.crypto,
      profile,
      selectedTargets,
      summary,
      realizationManifest,
      witnessReport,
      authority
    });
    await this.ctx.fs.write(profile.bundleManifestPath, JSON.stringify(bundleManifest, null, 2) + '\n');

    if (!options.quiet && !options.json) {
      logger?.info?.(`Contract bundle released: ${profile.bundleRoot}`);
      logger?.info?.(`Bundle manifest: ${profile.bundleManifestPath}`);
      logger?.info?.(`Witness: ${profile.witnessPath}`);
    }

    return {
      kind: CONTRACT_BUNDLE_KIND,
      profile: profile.profile,
      family: profile.family,
      release: profile.release,
      bundleRoot: profile.bundleRoot,
      bundleManifestPath: profile.bundleManifestPath,
      sourceHash: summary.schemaHash,
      targets: bundleManifest.targets,
      realization: bundleManifest.realization,
      witness: bundleManifest.witness,
      compatibility: bundleManifest.compatibility
    };
  }

  async executeSync({ options, logger }) {
    const bundleRoot = normalizeRequiredText(options.bundle, 'Contract bundle path');
    const bundlePath = joinPath(bundleRoot, 'bundle.json');
    if (!(await this.ctx.fs.exists(bundlePath))) {
      throw new WesleyError(
        'CONTRACT_BUNDLE_NOT_FOUND',
        `Contract bundle manifest not found at ${bundlePath}.`
      );
    }

    const bundle = JSON.parse(await this.ctx.fs.read(bundlePath));
    validateBundleManifest(bundle, bundlePath);
    const requestedProfile = normalizeOptionalText(options.profile) ?? bundle.profile;
    if (requestedProfile !== bundle.profile) {
      throw new WesleyError(
        'CONTRACT_SYNC_PROFILE_MISMATCH',
        `Contract bundle profile mismatch: bundle declares "${bundle.profile}", sync requested "${requestedProfile}".`
      );
    }
    const consumerName = normalizeRequiredText(options.consumer, 'Contract consumer');
    const consumer = resolveBundleConsumer(bundle, consumerName);
    const repoRoot = normalizeRequiredText(options.repo, 'Consumer repository root');

    const copiedFiles = [];
    for (const projection of consumer.projections) {
      const writes = projection.kind === 'directory'
        ? await syncDirectoryProjection({
          fs: this.ctx.fs,
          bundleRoot,
          repoRoot,
          projection,
          dryRun: Boolean(options.dryRun)
        })
        : await syncFileProjection({
          fs: this.ctx.fs,
          bundleRoot,
          repoRoot,
          projection,
          dryRun: Boolean(options.dryRun)
        });
      copiedFiles.push(...writes);
    }

    if (!options.quiet && !options.json) {
      const action = options.dryRun ? 'Would sync' : 'Synced';
      logger?.info?.(`${action} ${copiedFiles.length} file(s) for ${consumer.consumer} from ${bundleRoot}`);
      logger?.info?.(`Consumer repository: ${repoRoot}`);
    }

    return {
      kind: CONTRACT_SYNC_KIND,
      profile: bundle.profile,
      family: bundle.family,
      release: bundle.release,
      bundleRoot,
      consumer: consumer.consumer,
      repoRoot,
      dryRun: Boolean(options.dryRun),
      fileCount: copiedFiles.length,
      files: copiedFiles
    };
  }
}

async function buildContractBundleManifest({
  crypto,
  profile,
  selectedTargets,
  summary,
  realizationManifest,
  witnessReport,
  authority
}) {
  const realizationDigest = await computeTextDigest({
    crypto,
    text: JSON.stringify(realizationManifest)
  });
  const witnessDigest = await computeTextDigest({
    crypto,
    text: JSON.stringify(witnessReport)
  });
  const compilerVersion = {
    package: CLI_PACKAGE_NAME,
    version: CLI_PACKAGE_VERSION,
    profilePackage: PROFILE_PACKAGE_NAME,
    gitCommit: resolveGitHeadCommit()
  };

  return {
    kind: CONTRACT_BUNDLE_KIND,
    profile: profile.profile,
    family: profile.family,
    scope: profile.scope,
    release: profile.release,
    sourceAuthority: {
      path: 'source/authority.json',
      admittedSnapshotPath: 'source/admitted.graphql',
      schemaPath: authority.schemaPath,
      canonicalSchemaPath: authority.canonicalSchemaPath,
      repository: authority.repository,
      ref: authority.ref,
      commit: authority.commit
    },
    sourceHash: summary.schemaHash,
    compiler: compilerVersion,
    targets: buildTargetEntries({ selectedTargets, summary }),
    realization: {
      path: 'realization/manifest.json',
      kind: realizationManifest.kind,
      integrityStatus: realizationManifest.integrity?.status ?? null,
      digest: realizationDigest
    },
    witness: {
      path: 'witness/conformance.json',
      kind: witnessReport.kind,
      scope: witnessReport.scope,
      status: witnessReport.status,
      digest: witnessDigest,
      summary: witnessReport.summary,
      judgmentProfile: witnessReport.judgmentProfile
    },
    compatibility: {
      consumers: profile.consumers.map((consumer) => ({
        consumer: consumer.consumer,
        description: consumer.description,
        projections: consumer.projections
      }))
    },
    proves: [
      'one versioned contract bundle binds semver, source identity, realization, and bounded witness output together',
      'consumer sync projections are declared from the bundle rather than inferred from compiler internals',
      'neighboring repositories can consume generated projections without importing Wesley compiler packages directly'
    ],
    doesNotProve: [
      'runtime semantics',
      'storage semantics',
      'debugger semantics',
      'consumer runtime compatibility beyond the emitted contract projections'
    ]
  };
}

function buildAuthorityDescriptor({
  profile,
  schemaPath,
  sourceHash
}) {
  return {
    kind: CONTRACT_AUTHORITY_KIND,
    profile: profile.profile,
    family: profile.family,
    release: profile.release,
    schemaPath,
    canonicalSchemaPath: canonicalizeSchemaPath(schemaPath),
    sourceHash,
    repository: profile.authority.repository,
    ref: profile.authority.ref,
    commit: profile.authority.commit,
    authorityPath: profile.authority.path,
    admittedSnapshotPath: 'source/admitted.graphql',
    disclaimer:
      'The admitted snapshot is a reproducible compile input, not a retroactive claim that the bundle owns the authored contract.'
  };
}

function buildTargetEntries({ selectedTargets, summary }) {
  const entries = [];
  for (const target of selectedTargets) {
    if (target === 'warp-ttd' && summary.warpTtd) {
      entries.push({
        target,
        root: 'targets/warp-ttd',
        schemaHash: summary.warpTtd.schemaHash,
        files: summary.warpTtd.files.map((file) => ({
          path: relativizeToRoot({
            root: joinPath(summary.outDir, 'warp-ttd'),
            targetPath: file.path
          }) ?? file.path,
          size: file.size
        }))
      });
    }
    if (target === 'echo' && summary.echo) {
      entries.push({
        target,
        root: 'targets/echo',
        schemaHash: summary.echo.schemaHash,
        files: summary.echo.echo.files.map((file) => ({
          path: file.path,
          size: file.size
        })).concat([
          {
            path: relativizeToRoot({
              root: joinPath(summary.outDir, 'echo'),
              targetPath: summary.echo.mock.outputPath
            }),
            size: null
          },
          {
            path: relativizeToRoot({
              root: joinPath(summary.outDir, 'echo'),
              targetPath: summary.echo.mock.summaryPath
            }),
            size: null
          }
        ])
      });
    }
  }
  return entries;
}

function ensureRequiredTargets({ selectedTargets, requiredTargets }) {
  const missingTargets = requiredTargets.filter((target) => !selectedTargets.includes(target));
  if (missingTargets.length > 0) {
    throw new WesleyError(
      'CONTRACT_RELEASE_TARGETS_INVALID',
      `Continuum contract release requires targets "${requiredTargets.join(', ')}". Missing: ${missingTargets.join(', ')}.`
    );
  }
}

function ensureRequiredWarpTtdEmits(rawEmitTargets) {
  const selected = String(rawEmitTargets)
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const missing = REQUIRED_WARP_TTD_EMITS.filter((emit) => !selected.includes(emit));
  if (missing.length > 0) {
    throw new WesleyError(
      'CONTRACT_RELEASE_EMITS_INVALID',
      `Continuum contract release requires warp-ttd emits "${REQUIRED_WARP_TTD_EMITS.join(', ')}". Missing: ${missing.join(', ')}.`
    );
  }
}

function parseTargets(rawTargets) {
  const targets = String(rawTargets)
    .split(',')
    .map((target) => LEGACY_TARGET_ALIASES.get(target.trim().toLowerCase()) ?? target.trim().toLowerCase())
    .filter(Boolean);

  if (targets.length === 0) {
    throw new WesleyError(
      'INVALID_TARGET',
      `At least one target is required. Valid targets: ${VALID_TARGETS.join(', ')}.`
    );
  }

  for (const target of targets) {
    if (!VALID_TARGETS.includes(target)) {
      throw new WesleyError(
        'INVALID_TARGET',
        `Invalid target: "${target}". Valid targets: ${VALID_TARGETS.join(', ')}.`
      );
    }
  }

  return [...new Set(targets)];
}

function resolveContractProfile(options) {
  const requestedProfile = normalizeOptionalText(options.profile) ?? CONTINUUM_CONTRACT_PROFILE;
  if (requestedProfile !== CONTINUUM_CONTRACT_PROFILE) {
    throw new WesleyError(
      'CONTRACT_PROFILE_INVALID',
      `Unsupported contract profile "${requestedProfile}". Currently supported: ${CONTINUUM_CONTRACT_PROFILE}.`
    );
  }

  return resolveContinuumContractBundleProfile({
    family: options.family,
    release: options.release,
    schemaPath: options.schemaPath,
    bundleOut: options.bundleOut,
    authorityRepository: options.authorityRepository,
    authorityRef: options.authorityRef,
    authorityCommit: options.authorityCommit,
    authorityPath: options.authorityPath
  });
}

function resolveBundleConsumer(bundle, consumerName) {
  const consumer = bundle.compatibility?.consumers?.find((entry) => entry.consumer === consumerName) ?? null;
  if (consumer != null) {
    return consumer;
  }

  throw new WesleyError(
    'CONTRACT_SYNC_CONSUMER_INVALID',
    `Contract bundle does not declare consumer "${consumerName}".`
  );
}

async function syncDirectoryProjection({ fs, bundleRoot, repoRoot, projection, dryRun }) {
  const sourceRoot = joinPath(bundleRoot, projection.fromRoot);
  if (!(await fs.exists(sourceRoot))) {
    throw new WesleyError(
      'CONTRACT_SYNC_SOURCE_MISSING',
      `Contract bundle projection root not found: ${sourceRoot}.`
    );
  }
  const sourceFiles = await listFilesRecursive(fs, sourceRoot);
  const writes = [];
  for (const filePath of sourceFiles) {
    const relativePath = normalizeSeparators(path.relative(path.resolve(sourceRoot), path.resolve(filePath)));
    const destinationPath = joinPath(repoRoot, projection.toRoot, relativePath);
    const content = await fs.read(filePath);
    if (!dryRun) {
      await fs.write(destinationPath, content);
    }
    writes.push({
      source: normalizeSeparators(joinPath(projection.fromRoot, relativePath)),
      destination: normalizeSeparators(joinPath(projection.toRoot, relativePath))
    });
  }
  return writes;
}

async function syncFileProjection({ fs, bundleRoot, repoRoot, projection, dryRun }) {
  const sourcePath = joinPath(bundleRoot, projection.from);
  if (!(await fs.exists(sourcePath))) {
    throw new WesleyError(
      'CONTRACT_SYNC_SOURCE_MISSING',
      `Contract bundle projection file not found: ${sourcePath}.`
    );
  }

  const content = await fs.read(sourcePath);
  const destinationPath = joinPath(repoRoot, projection.to);
  if (!dryRun) {
    await fs.write(destinationPath, content);
  }
  return [{
    source: projection.from,
    destination: projection.to
  }];
}

async function listFilesRecursive(fs, root) {
  if (!fs.readDir) {
    throw new WesleyError(
      'CONTRACT_SYNC_UNSUPPORTED_FS',
      'The active filesystem adapter does not support recursive directory inspection.'
    );
  }

  const entries = await fs.readDir(root);
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.isDirectory) {
      files.push(...await listFilesRecursive(fs, entry.path));
      continue;
    }
    if (entry.isFile) {
      files.push(entry.path);
    }
  }
  return files;
}

function validateBundleManifest(bundle, bundlePath) {
  if (bundle?.kind !== CONTRACT_BUNDLE_KIND) {
    throw new WesleyError(
      'CONTRACT_BUNDLE_KIND_INVALID',
      `Contract bundle at ${bundlePath} must declare kind "${CONTRACT_BUNDLE_KIND}".`
    );
  }
  if (normalizeOptionalText(bundle.profile) == null) {
    throw new WesleyError(
      'CONTRACT_BUNDLE_PROFILE_MISSING',
      `Contract bundle at ${bundlePath} is missing profile metadata.`
    );
  }
}

async function computeTextDigest({ crypto, text }) {
  const subtle = crypto?.subtle ?? globalThis.crypto?.subtle;
  if (subtle == null) {
    throw new WesleyError(
      'CONTRACT_DIGEST_UNAVAILABLE',
      'WebCrypto subtle.digest is required to build contract bundle digests.'
    );
  }

  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Buffer.from(digest).toString('hex');
}

function relativizeToRoot({ root, targetPath }) {
  if (typeof root !== 'string' || typeof targetPath !== 'string') {
    return null;
  }
  return normalizeSeparators(path.relative(path.resolve(root), path.resolve(targetPath)));
}

function resolveGitHeadCommit() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    return null;
  }
  return normalizeOptionalText(result.stdout);
}

function ensureTrailingNewline(text) {
  return text.endsWith('\n') ? text : `${text}\n`;
}

function normalizeRequiredText(value, label) {
  const text = normalizeOptionalText(value);
  if (text == null) {
    throw new WesleyError('CONTRACT_ARGUMENT_INVALID', `${label} is required.`);
  }
  return text;
}

function normalizeOptionalText(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const text = value.trim();
  return text.length === 0 ? null : text;
}

function normalizeSeparators(value) {
  return value.replace(/\\/g, '/');
}

function mergeCommandOptions(command) {
  if (!command) return {};
  if (typeof command.optsWithGlobals === 'function') {
    return command.optsWithGlobals();
  }

  const merged = {};
  let current = command;
  while (current) {
    if (typeof current.opts === 'function') {
      Object.assign(merged, current.opts());
    }
    current = current.parent;
  }
  return merged;
}
