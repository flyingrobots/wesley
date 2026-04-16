import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const STACK_RELEASE_KIND = 'continuum.stack-release.v1';
const WARPSPACE_LOCK_KIND = 'warpspace.lock.v1';
const WARPSPACE_KIND = 'wesley.warpspace.v1';
const WESLEY_BIN_PATH = fileURLToPath(new URL('../../bin/wesley.mjs', import.meta.url));

export async function initWarpspace({
  ctx,
  manifestPath,
  projectDir,
  authorityRoot = null,
  force = false,
  generate = true,
  now = () => new Date(),
  runCommand = defaultRunCommand
}) {
  if (!ctx?.fs) {
    throw new TypeError('initWarpspace requires a runtime context with fs');
  }
  const fs = ctx.fs;
  const crypto = ctx.crypto;

  const resolvedManifestPath = path.resolve(normalizeRequiredText(manifestPath, 'manifest path'));
  const resolvedProjectDir = path.resolve(normalizeRequiredText(projectDir, 'project directory'));

  const manifestContent = await fs.read(resolvedManifestPath);
  const manifest = parseManifest(manifestContent, resolvedManifestPath);
  validateManifest(manifest, resolvedManifestPath);

  await ensureProjectDirectory({
    fs,
    projectDir: resolvedProjectDir,
    force
  });

  const resolvedAuthorityRoot = authorityRoot == null
    ? await findRepoRoot({ fs, startPath: resolvedManifestPath })
    : path.resolve(authorityRoot);

  if (resolvedAuthorityRoot == null) {
    throw new Error(
      `Could not infer the authored-home repository root from ${resolvedManifestPath}. ` +
      'Pass --authority-root explicitly.'
    );
  }

  const materializedFamilies = [];
  for (const family of manifest.families) {
    const sourceFile = path.resolve(resolvedAuthorityRoot, family.sourcePath);
    const targetFile = path.resolve(resolvedProjectDir, family.materializeTo);
    const sourceContent = await fs.read(sourceFile);
    const sourceHash = crypto?.sha256?.(sourceContent) ?? null;
    if (family.sha256 && sourceHash && family.sha256 !== sourceHash) {
      throw new Error(
        `Family digest mismatch for ${family.id}: manifest declares ${family.sha256}, ` +
        `but ${sourceFile} hashes to ${sourceHash}.`
      );
    }
    await fs.write(targetFile, ensureTrailingNewline(sourceContent));
    materializedFamilies.push({
      id: family.id,
      version: family.version,
      sourceFile,
      targetFile,
      sha256: sourceHash
    });
  }

  const warpspacePath = path.join(resolvedProjectDir, 'warpspace.toml');
  await fs.write(
    warpspacePath,
    renderWarpspaceToml({ manifest })
  );

  const generatedCommands = [];
  if (generate) {
    for (const family of manifest.families) {
      const schemaPath = family.materializeTo;
      const projections = new Set(Array.isArray(family.defaultProjections) ? family.defaultProjections : []);

      if (projections.has('typescript')) {
        generatedCommands.push(await invokeWesley({
          cwd: resolvedProjectDir,
          runCommand,
          args: ['typescript', '--schema', schemaPath, '--json']
        }));
      }
      if (projections.has('zod')) {
        generatedCommands.push(await invokeWesley({
          cwd: resolvedProjectDir,
          runCommand,
          args: ['zod', '--schema', schemaPath, '--json']
        }));
      }
      if (projections.has('echo-ir')) {
        generatedCommands.push(await invokeWesley({
          cwd: resolvedProjectDir,
          runCommand,
          args: ['bundle-echo', '--schema', schemaPath, '--json']
        }));
      }
      if (projections.has('warp-ttd')) {
        generatedCommands.push(await invokeWesley({
          cwd: resolvedProjectDir,
          runCommand,
          args: ['compile-ttd', '--schema', schemaPath, '--target', 'manifest,typescript', '--json']
        }));
      }
    }
  }

  const manifestHash = crypto?.sha256?.(manifestContent) ?? null;
  const initializedAt = now().toISOString();
  const lock = buildWarpspaceLock({
    manifest,
    manifestPath: resolvedManifestPath,
    manifestHash,
    authorityRoot: resolvedAuthorityRoot,
    initializedAt,
    generatedCommands
  });
  const lockPath = path.join(resolvedProjectDir, 'warpspace.lock.json');
  await fs.write(lockPath, JSON.stringify(lock, null, 2) + '\n');

  return {
    kind: 'warpspace.init.result.v1',
    profile: manifest.profile,
    releaseId: manifest.releaseId,
    projectDir: resolvedProjectDir,
    manifestPath: resolvedManifestPath,
    authorityRoot: resolvedAuthorityRoot,
    warpspacePath,
    lockPath,
    materializedFamilies,
    generatedCommands,
    generated: generate
  };
}

function parseManifest(content, manifestPath) {
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to parse stack release manifest at ${manifestPath}: ${error.message}`);
  }
}

function validateManifest(manifest, manifestPath) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error(`Stack release manifest at ${manifestPath} must be a JSON object.`);
  }
  if (manifest.kind !== STACK_RELEASE_KIND) {
    throw new Error(
      `Stack release manifest at ${manifestPath} must declare kind "${STACK_RELEASE_KIND}".`
    );
  }
  if (!Array.isArray(manifest.families) || manifest.families.length === 0) {
    throw new Error(`Stack release manifest at ${manifestPath} must declare at least one family.`);
  }
  if (!manifest.bootstrap || typeof manifest.bootstrap !== 'object') {
    throw new Error(`Stack release manifest at ${manifestPath} must declare bootstrap settings.`);
  }
  if (!manifest.bootstrap.defaultOutputs || typeof manifest.bootstrap.defaultOutputs !== 'object') {
    throw new Error(
      `Stack release manifest at ${manifestPath} must declare bootstrap.defaultOutputs.`
    );
  }
  for (const family of manifest.families) {
    if (!family.id || !family.version || !family.sourcePath || !family.materializeTo) {
      throw new Error(
        `Family entries in ${manifestPath} must declare id, version, sourcePath, and materializeTo.`
      );
    }
  }
}

async function ensureProjectDirectory({ fs, projectDir, force }) {
  const exists = await fs.exists(projectDir);
  if (!exists) {
    await fs.mkdir(projectDir, { recursive: true });
    return;
  }

  const entries = await fs.readDir(projectDir);
  if (entries.length > 0 && !force) {
    throw new Error(
      `Project directory ${projectDir} is not empty. Pass --force to initialize into an existing directory.`
    );
  }
}

async function findRepoRoot({ fs, startPath }) {
  let current = path.dirname(path.resolve(startPath));
  while (true) {
    if (await fs.exists(path.join(current, '.git'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function renderWarpspaceToml({ manifest }) {
  const lines = [
    'version = 1',
    `profile = ${tomlString(manifest.profile)}`,
    '',
    '[stack]',
    `release_id = ${tomlString(manifest.releaseId)}`,
    '',
    '[toolchain]',
    `wesley_package = ${tomlString(manifest.toolchain?.wesley?.package ?? 'unknown')}`,
    `wesley_version = ${tomlString(manifest.toolchain?.wesley?.version ?? 'unknown')}`,
    '',
    '[outputs]'
  ];

  for (const [name, outputPath] of Object.entries(manifest.bootstrap.defaultOutputs)) {
    lines.push(`${tomlKey(name)} = ${tomlString(outputPath)}`);
  }

  lines.push('', '[runtimes]');
  lines.push(`echo = ${tomlString(manifest.runtimes?.echo?.crate ?? 'unknown')}`);
  lines.push(`git_warp = ${tomlString(manifest.runtimes?.['git-warp']?.package ?? 'unknown')}`);
  lines.push(`warp_ttd = ${tomlString(manifest.runtimes?.['warp-ttd']?.package ?? 'unknown')}`);

  for (const family of manifest.families) {
    lines.push('', '[[family]]');
    lines.push(`id = ${tomlString(family.id)}`);
    lines.push(`version = ${tomlString(family.version)}`);
    lines.push(`source = ${tomlString(family.materializeTo)}`);
    lines.push(`projections = ${tomlArray(family.defaultProjections ?? [])}`);
  }

  lines.push('');
  return lines.join('\n');
}

function tomlKey(key) {
  return /^[A-Za-z0-9_-]+$/.test(key)
    ? key.replaceAll('-', '_')
    : tomlString(key);
}

function tomlArray(values) {
  return `[${values.map((value) => tomlString(String(value))).join(', ')}]`;
}

function tomlString(value) {
  return JSON.stringify(String(value));
}

function buildWarpspaceLock({
  manifest,
  manifestPath,
  manifestHash,
  authorityRoot,
  initializedAt,
  generatedCommands
}) {
  return {
    kind: WARPSPACE_LOCK_KIND,
    profile: manifest.profile,
    releaseId: manifest.releaseId,
    initializedAt,
    manifest: {
      path: manifestPath,
      sha256: manifestHash,
      deliveryMode: manifest.deliveryMode,
      status: manifest.status
    },
    authorityRoot,
    toolchain: manifest.toolchain ?? {},
    runtimes: manifest.runtimes ?? {},
    families: manifest.families.map(family => ({
      id: family.id,
      version: family.version,
      sha256: family.sha256,
      materializeTo: family.materializeTo,
      projections: family.defaultProjections
    })),
    localOverrides: manifest.localOverrides ?? null,
    generatedCommands
  };
}

async function invokeWesley({ cwd, runCommand, args }) {
  const result = await runCommand({
    command: process.execPath,
    args: [WESLEY_BIN_PATH, ...args],
    cwd
  });

  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join('\n').trim();
    throw new Error(
      `Wesley subcommand failed: wesley ${args.join(' ')}${detail ? `\n${detail}` : ''}`
    );
  }

  let parsed = null;
  if (result.stdout?.trim()) {
    try {
      parsed = JSON.parse(result.stdout);
    } catch {
      parsed = null;
    }
  }

  return {
    args,
    cwd,
    stdout: result.stdout,
    result: parsed?.result ?? null
  };
}

function defaultRunCommand({ command, args, cwd }) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8'
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? ''
  };
}

function ensureTrailingNewline(content) {
  return content.endsWith('\n') ? content : `${content}\n`;
}

function normalizeRequiredText(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${label} is required`);
  }
  return value.trim();
}

export {
  STACK_RELEASE_KIND,
  WARPSPACE_LOCK_KIND,
  WARPSPACE_KIND
};
