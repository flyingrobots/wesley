import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { schemaHash, WesleyError } from '@wesley/core';
import { canonicalizeSchemaPath, joinPath } from './path-utils.mjs';
import { createCheck, summarizeChecks } from './continuum-witness-support.mjs';

export const REALIZATION_MANIFEST_KIND = 'wesley.realization.manifest.v1';
export const REALIZATION_SIGNATURE_ALGORITHM = 'hmac-sha256';

const DEFAULT_SIGNING_KEY = 'wesley-v0.1.0-local-dev-hmac-key';
const DEFAULT_SIGNING_KEY_ID = 'builtin:wesley-v0.1.0-local-dev-hmac-key';
const DEFAULT_SIGNATURE_SCOPE = 'generated-leg-files';
const SHA256_LABEL = 'sha256';
const textEncoder = new TextEncoder();

export async function buildRealizationManifest({
  fs,
  crypto,
  schemaContent,
  schemaPath,
  outDir,
  targets,
  summary,
  dryRun = false,
  env = process.env
}) {
  const sourceHash = summary.schemaHash ?? await schemaHash(schemaContent);
  const signing = resolveRealizationSigningConfig({ env });
  const manifest = {
    kind: REALIZATION_MANIFEST_KIND,
    schemaPath,
    canonicalSchemaPath: canonicalizeSchemaPath(schemaPath),
    schemaHash: sourceHash,
    sourceHash,
    outDir,
    targets,
    integrity: {
      status: dryRun ? 'dry-run-unsealed' : 'sealed',
      scope: DEFAULT_SIGNATURE_SCOPE,
      hashAlgorithm: SHA256_LABEL,
      signatureAlgorithm: REALIZATION_SIGNATURE_ALGORITHM,
      signatureKeyId: signing.keyId
    },
    generatedLegs: {
      warpTtd: summary.warpTtd == null
        ? null
        : {
          outDir: joinPath(outDir, 'warp-ttd'),
          schemaHash: summary.warpTtd.schemaHash,
          sourceHash: summary.warpTtd.schemaHash,
          targets: summary.warpTtd.targets,
          files: normalizeLegFiles({
            outDir: joinPath(outDir, 'warp-ttd'),
            files: summary.warpTtd.files
          })
        },
      echo: summary.echo == null
        ? null
        : {
          outDir: summary.echo.outDir,
          schemaHash: summary.echo.schemaHash,
          sourceHash: summary.echo.schemaHash,
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

  if (dryRun) {
    return manifest;
  }

  return sealRealizationManifest({ fs, crypto, manifest, env });
}

export async function sealRealizationManifest({ fs, crypto, manifest, env = process.env }) {
  const signing = resolveRealizationSigningConfig({ env });
  const sealedLegs = {
    warpTtd: await sealLeg({
      fs,
      crypto,
      signingKey: signing.key,
      leg: manifest.generatedLegs?.warpTtd
    }),
    echo: await sealLeg({
      fs,
      crypto,
      signingKey: signing.key,
      leg: manifest.generatedLegs?.echo
    })
  };

  return {
    ...manifest,
    integrity: {
      ...(manifest.integrity ?? {}),
      status: 'sealed',
      scope: DEFAULT_SIGNATURE_SCOPE,
      hashAlgorithm: SHA256_LABEL,
      signatureAlgorithm: REALIZATION_SIGNATURE_ALGORITHM,
      signatureKeyId: signing.keyId
    },
    generatedLegs: sealedLegs
  };
}

export async function inspectRealizationManifest({
  fs,
  crypto,
  schemaPath,
  realizationRoot,
  ttdDir,
  echoDir,
  env = process.env,
  manifestPath = realizationRoot == null ? null : joinPath(realizationRoot, 'manifest.json')
}) {
  if (manifestPath == null || !(await fs.exists(manifestPath))) {
    return null;
  }

  const manifest = JSON.parse(await fs.read(manifestPath));
  const signing = resolveRealizationSigningConfig({ env });
  const effectiveSchemaPath = schemaPath ?? manifest.schemaPath;
  const checks = [];

  const kindValid = manifest.kind === REALIZATION_MANIFEST_KIND;
  checks.push(createCheck(
    'realization.manifest-kind',
    kindValid,
    kindValid
      ? 'Realization manifest kind is recognized.'
      : `Realization manifest kind mismatch: expected ${REALIZATION_MANIFEST_KIND}, got ${manifest.kind ?? 'null'}.`,
    {
      manifestPath,
      expectedKind: REALIZATION_MANIFEST_KIND,
      actualKind: manifest.kind ?? null
    }
  ));

  let actualSourceHash = null;
  let sourceHashError = null;
  try {
    const schemaContent = await fs.read(effectiveSchemaPath);
    actualSourceHash = await schemaHash(schemaContent);
  } catch (error) {
    sourceHashError = error instanceof Error ? error.message : String(error);
  }

  const canonicalSchemaPath = canonicalizeSchemaPath(effectiveSchemaPath);
  const sourceHashMatches = sourceHashError == null &&
    typeof manifest.sourceHash === 'string' &&
    manifest.sourceHash === actualSourceHash &&
    (manifest.schemaHash == null || manifest.schemaHash === actualSourceHash);
  checks.push(createCheck(
    'realization.source-traceability',
    sourceHashMatches,
    sourceHashMatches
      ? 'Realization manifest sourceHash matches the authored schema input.'
      : sourceHashError == null
        ? 'Realization manifest sourceHash does not match the authored schema input.'
        : `Realization manifest sourceHash could not be verified: ${sourceHashError}`,
    {
      manifestPath,
      schemaPath: effectiveSchemaPath,
      expectedSourceHash: actualSourceHash,
      manifestSourceHash: manifest.sourceHash ?? null,
      manifestSchemaHash: manifest.schemaHash ?? null,
      expectedCanonicalSchemaPath: canonicalSchemaPath,
      manifestCanonicalSchemaPath: manifest.canonicalSchemaPath ?? null,
      error: sourceHashError
    }
  ));

  const keyIdMatches = manifest.integrity?.signatureKeyId === signing.keyId;
  checks.push(createCheck(
    'realization.signature-key-id',
    keyIdMatches,
    keyIdMatches
      ? 'Realization manifest signature key id matches the active verifier key.'
      : 'Realization manifest signature key id does not match the active verifier key.',
    {
      manifestPath,
      expectedKeyId: signing.keyId,
      manifestKeyId: manifest.integrity?.signatureKeyId ?? null
    }
  ));

  const legReports = {};
  for (const [legName, currentOutDir] of [['warpTtd', ttdDir], ['echo', echoDir]]) {
    const leg = manifest.generatedLegs?.[legName];
    if (leg == null) {
      continue;
    }

    const report = await inspectLeg({
      fs,
      crypto,
      signingKey: signing.key,
      leg,
      currentOutDir: currentOutDir ?? leg.outDir
    });
    legReports[legName] = report;

    checks.push(createCheck(
      `realization.${legName}.files-present`,
      report.missingFiles.length === 0,
      report.missingFiles.length === 0
        ? `Realization manifest can resolve all ${legName} artifacts.`
        : `Realization manifest is missing ${legName} artifacts: ${report.missingFiles.join(', ')}`,
      {
        manifestPath,
        outDir: report.outDir,
        missingFiles: report.missingFiles
      }
    ));

    const signaturesPass = report.unsignedFiles.length === 0 &&
      report.hashMismatches.length === 0 &&
      report.signatureMismatches.length === 0;
    checks.push(createCheck(
      `realization.${legName}.artifact-signatures`,
      signaturesPass,
      signaturesPass
        ? `Realization manifest HMAC signatures match all ${legName} artifacts.`
        : `Realization manifest HMAC signatures drift for ${legName} artifacts.`,
      {
        manifestPath,
        outDir: report.outDir,
        unsignedFiles: report.unsignedFiles,
        hashMismatches: report.hashMismatches,
        signatureMismatches: report.signatureMismatches
      }
    ));
  }

  const summary = summarizeChecks(checks);
  return {
    manifestPath,
    schemaPath: effectiveSchemaPath,
    manifest,
    summary,
    status: summary.failed === 0 ? 'pass' : 'fail',
    checks,
    legs: legReports
  };
}

export async function verifyRealizationManifestsInRepo({
  fs,
  crypto,
  repoRoot = '.',
  env = process.env
}) {
  const manifests = listGitKnownManifestPaths(repoRoot);
  const reports = [];

  for (const manifestPath of manifests) {
    const report = await inspectRealizationManifest({
      fs,
      crypto,
      env,
      manifestPath
    });
    if (report != null) {
      reports.push(report);
    }
  }

  const checks = reports.flatMap((report) => report.checks);
  const summary = summarizeChecks(checks);
  return {
    mode: 'tracked',
    repoRoot: path.resolve(repoRoot),
    manifestCount: reports.length,
    manifestPaths: reports.map((report) => report.manifestPath),
    status: summary.failed === 0 ? 'pass' : 'fail',
    summary,
    reports
  };
}

export function resolveRealizationManifestPath({ outDir, manifest }) {
  if (typeof manifest === 'string' && manifest.trim().length > 0) {
    return manifest.trim();
  }
  if (typeof outDir === 'string' && outDir.trim().length > 0) {
    return joinPath(outDir.trim(), 'realization', 'manifest.json');
  }
  return null;
}

export function resolveRealizationSigningConfig({ env = process.env } = {}) {
  const envKey = normalizeText(env.WESLEY_REALIZATION_HMAC_KEY);
  const envKeyId = normalizeText(env.WESLEY_REALIZATION_HMAC_KEY_ID);
  return {
    key: envKey ?? DEFAULT_SIGNING_KEY,
    keyId: envKey == null
      ? DEFAULT_SIGNING_KEY_ID
      : envKeyId ?? 'env:WESLEY_REALIZATION_HMAC_KEY',
    source: envKey == null ? 'builtin-dev' : 'environment'
  };
}

function buildEchoLegFiles(echoSummary) {
  return normalizeLegFiles({
    outDir: echoSummary.outDir,
    files: [
      ...echoSummary.echo.files,
      {
        path: relativeToOutDir(echoSummary.outDir, echoSummary.mock.outputPath),
        size: null
      },
      {
        path: relativeToOutDir(echoSummary.outDir, echoSummary.mock.summaryPath),
        size: null
      }
    ]
  });
}

function normalizeLegFiles({ outDir, files }) {
  return files
    .map((file) => {
      const relativePath = relativeToOutDir(outDir, file?.path);
      if (relativePath == null) {
        return null;
      }
      return {
        path: relativePath,
        size: file?.size ?? null
      };
    })
    .filter(Boolean);
}

async function sealLeg({ fs, crypto, signingKey, leg }) {
  if (leg == null) {
    return null;
  }

  const files = [];
  for (const file of leg.files ?? []) {
    const targetPath = joinPath(leg.outDir, file.path);
    const content = await fs.read(targetPath);
    const size = Buffer.byteLength(content, 'utf8');
    const { contentHash, signature } = await computeIntegrity({
      crypto,
      signingKey,
      content
    });
    files.push({
      ...file,
      size,
      contentHash,
      signature
    });
  }

  return {
    ...leg,
    files
  };
}

async function inspectLeg({ fs, crypto, signingKey, leg, currentOutDir }) {
  const missingFiles = [];
  const unsignedFiles = [];
  const hashMismatches = [];
  const signatureMismatches = [];

  for (const file of leg.files ?? []) {
    const relativePath = normalizeManifestPath(file.path);
    if (relativePath == null) {
      continue;
    }
    const targetPath = joinPath(currentOutDir, relativePath);
    if (!(await fs.exists(targetPath))) {
      missingFiles.push(relativePath);
      continue;
    }

    if (typeof file.contentHash !== 'string' || typeof file.signature !== 'string') {
      unsignedFiles.push(relativePath);
      continue;
    }

    const content = await fs.read(targetPath);
    const actual = await computeIntegrity({
      crypto,
      signingKey,
      content
    });
    if (actual.contentHash !== file.contentHash) {
      hashMismatches.push({
        path: relativePath,
        expected: file.contentHash,
        actual: actual.contentHash
      });
    }
    if (actual.signature !== file.signature) {
      signatureMismatches.push({
        path: relativePath,
        expected: file.signature,
        actual: actual.signature
      });
    }
  }

  return {
    outDir: currentOutDir,
    missingFiles,
    unsignedFiles,
    hashMismatches,
    signatureMismatches
  };
}

async function computeIntegrity({ crypto, signingKey, content }) {
  const subtle = resolveSubtle(crypto);
  const bytes = textEncoder.encode(content);
  const digest = await subtle.digest('SHA-256', bytes);
  const key = await subtle.importKey(
    'raw',
    textEncoder.encode(signingKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await subtle.sign('HMAC', key, bytes);
  return {
    contentHash: bufferToHex(digest),
    signature: bufferToHex(signature)
  };
}

function resolveSubtle(crypto) {
  const subtle = crypto?.subtle ?? globalThis.crypto?.subtle;
  if (subtle == null) {
    throw new WesleyError(
      'REALIZATION_CRYPTO_UNAVAILABLE',
      'Crypto.subtle is required for realization integrity checks.'
    );
  }
  return subtle;
}

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
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

function normalizeManifestPath(targetPath) {
  if (typeof targetPath !== 'string' || targetPath.trim().length === 0) {
    return null;
  }
  return targetPath.trim().replace(/^\.\/+/, '');
}

function listGitKnownManifestPaths(repoRoot) {
  const tracked = listGitPaths({
    repoRoot,
    args: ['ls-files', '-z']
  });
  const staged = listGitPaths({
    repoRoot,
    args: ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']
  });
  const suffixes = new Set(['realization/manifest.json', 'realization\\manifest.json']);
  const paths = [...tracked, ...staged]
    .filter((filePath) => {
      const normalized = filePath.replace(/\\/g, '/');
      return suffixes.has(normalized) || normalized.endsWith('/realization/manifest.json');
    })
    .map((filePath) => path.resolve(repoRoot, filePath));
  return [...new Set(paths)].sort((left, right) => left.localeCompare(right));
}

function listGitPaths({ repoRoot, args }) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    throw new WesleyError(
      'REALIZATION_GIT_QUERY_FAILED',
      `Git command failed while discovering realization manifests: git ${args.join(' ')}`,
      {
        repoRoot,
        stderr: result.stderr?.trim() || null
      }
    );
  }
  return result.stdout
    .split('\0')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeText(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const text = value.trim();
  return text.length === 0 ? null : text;
}
