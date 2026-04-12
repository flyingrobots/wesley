import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { parse, Kind } from 'graphql';
import { createCheck } from './continuum-witness-support.mjs';

const CONTRACT_FILE_EXTENSIONS = new Set([
  '.graphql',
  '.gql',
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.rs',
  '.json',
  '.jsonl'
]);
const IGNORED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  '.pnpm',
  '.wesley-cache',
  'coverage',
  'dist',
  '.next',
  'out'
]);
const ROOT_OPERATION_TYPE_NAMES = new Set(['Query', 'Mutation', 'Subscription']);

export async function inspectContinuumPublicationBoundary({
  fs,
  repoRoot,
  rules,
  reservedRoots = [],
  checks
}) {
  const derivedRules = [];
  for (const rule of rules) {
    derivedRules.push(await deriveRuleMetadata(fs, rule));
  }
  const derivedReservedRoots = await Promise.all(reservedRoots.map((item) => resolvePath(fs, item)));

  const files = await collectCandidateFiles(fs, repoRoot);
  const reservedBoundaries = buildReservedBoundaries(derivedRules);
  const results = [];

  for (const derived of derivedRules) {
    const compatMirrors = (await collectCompatMirrorFiles(fs, derived.compatRoots))
      .map((item) => describeFile(repoRoot, item));
    const shadowContracts = [];
    const staleGeneratedArtifacts = [];

    for (const filePath of files) {
      const authority = classifyAuthority(filePath, derived);
      if (authority === 'authored' || authority === 'generated' || authority === 'compat') {
        continue;
      }

      if (derivedReservedRoots.some((root) => samePath(filePath, root) || isWithin(filePath, root))) {
        continue;
      }

      if (belongsToForeignReservedBoundary(filePath, derived.id, reservedBoundaries)) {
        continue;
      }

      const content = await fs.read(filePath);
      const contractShadow = looksLikeShadowContract(filePath, content, derived.familyNames);
      const generatedLeak = looksLikeGeneratedArtifactLeak(filePath, content, derived);

      if (contractShadow) {
        shadowContracts.push(describeFile(repoRoot, filePath));
        continue;
      }

      if (generatedLeak) {
        staleGeneratedArtifacts.push(describeFile(repoRoot, filePath));
      }
    }

    const pass = shadowContracts.length === 0 && staleGeneratedArtifacts.length === 0;
    checks.push(createCheck(
      `publication-boundary.${derived.id}`,
      pass,
      pass
        ? `Publication boundary holds for ${derived.id}; no handwritten shadows or leaked generated artifacts were found.`
        : `Publication boundary drift detected for ${derived.id}.`,
      {
        ruleId: derived.id,
        authoredHomes: derived.authoredHomes.map((item) => describeFile(repoRoot, item)),
        generatedRoots: derived.generatedRoots.map((item) => describePath(repoRoot, item)),
        compatRoots: derived.compatRoots.map((item) => describePath(repoRoot, item)),
        familyNames: [...derived.familyNames].sort(),
        declaredCompatMirrors: compatMirrors,
        shadowContracts,
        staleGeneratedArtifacts
      }
    ));

    results.push({
      id: derived.id,
      authoredHomes: derived.authoredHomes.map((item) => describeFile(repoRoot, item)),
      generatedRoots: derived.generatedRoots.map((item) => describePath(repoRoot, item)),
      compatRoots: derived.compatRoots.map((item) => describePath(repoRoot, item)),
      declaredCompatMirrors: compatMirrors,
      shadowContracts,
      staleGeneratedArtifacts
    });
  }

  return {
    repoRoot,
    rules: results
  };
}

async function deriveRuleMetadata(fs, rule) {
  const authoredHomes = await Promise.all(rule.authoredHomes.map((item) => resolvePath(fs, item)));
  const generatedRoots = await Promise.all((rule.generatedRoots ?? []).map((item) => resolvePath(fs, item)));
  const compatRoots = await Promise.all((rule.compatRoots ?? []).map((item) => resolvePath(fs, item)));
  const familyNames = new Set();
  for (const authoredHome of authoredHomes) {
    const schemaContent = await fs.read(authoredHome);
    for (const name of extractContractNames(schemaContent)) {
      familyNames.add(name);
    }
  }

  return {
    id: rule.id,
    authoredHomes,
    generatedRoots,
    compatRoots,
    generatedArtifactBasenames: new Set((rule.generatedArtifacts ?? []).map((item) => path.basename(item))),
    familyNames
  };
}

async function collectCandidateFiles(fs, rootDir) {
  const files = [];

  const walk = async (dir) => {
    const entries = await fs.readDir?.(dir);
    if (!Array.isArray(entries)) {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) {
          await walk(entry.path);
        }
        continue;
      }

      if (!entry.isFile) {
        continue;
      }

      if (CONTRACT_FILE_EXTENSIONS.has(path.extname(entry.name))) {
        files.push(entry.path);
      }
    }
  };

  await walk(rootDir);
  files.sort();
  return files;
}

async function collectCompatMirrorFiles(fs, compatRoots) {
  const mirrors = [];
  const seen = new Set();

  for (const root of compatRoots) {
    const normalizedRoot = await canonicalizePath(root);
    if (seen.has(normalizedRoot) || !(await fs.exists(root))) {
      continue;
    }

    if (CONTRACT_FILE_EXTENSIONS.has(path.extname(root))) {
      seen.add(normalizedRoot);
      mirrors.push(root);
      continue;
    }

    const files = await collectCandidateFiles(fs, root);
    for (const filePath of files) {
      const normalized = await canonicalizePath(filePath);
      if (seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      mirrors.push(filePath);
    }
  }

  mirrors.sort();
  return mirrors;
}

function buildReservedBoundaries(rules) {
  const boundaries = [];

  for (const rule of rules) {
    for (const authoredHome of rule.authoredHomes) {
      boundaries.push(new AuthoredHomeBoundary(rule.id, authoredHome));
    }
    for (const generatedRoot of rule.generatedRoots) {
      boundaries.push(new GeneratedRootBoundary(rule.id, generatedRoot));
    }
    for (const compatRoot of rule.compatRoots) {
      boundaries.push(new CompatRootBoundary(rule.id, compatRoot));
    }
  }

  return boundaries;
}

function belongsToForeignReservedBoundary(filePath, ownerId, boundaries) {
  return boundaries.some((boundary) => boundary.belongsToForeignRule(ownerId) && boundary.contains(filePath));
}

function classifyAuthority(filePath, rule) {
  if (rule.authoredHomes.some((root) => samePath(filePath, root))) {
    return 'authored';
  }
  if (rule.generatedRoots.some((root) => isWithin(filePath, root))) {
    return 'generated';
  }
  if (rule.compatRoots.some((root) => isWithin(filePath, root))) {
    return 'compat';
  }
  return 'unknown';
}

function extractContractNames(schemaContent) {
  const document = parse(schemaContent, { noLocation: true });
  const names = [];
  for (const definition of document.definitions) {
    if (!definition.name?.value) {
      continue;
    }

    if (
      definition.kind === Kind.OBJECT_TYPE_DEFINITION ||
      definition.kind === Kind.INTERFACE_TYPE_DEFINITION ||
      definition.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION ||
      definition.kind === Kind.UNION_TYPE_DEFINITION ||
      definition.kind === Kind.ENUM_TYPE_DEFINITION ||
      definition.kind === Kind.SCALAR_TYPE_DEFINITION
    ) {
      if (!ROOT_OPERATION_TYPE_NAMES.has(definition.name.value)) {
        names.push(definition.name.value);
      }
    }
  }
  return names;
}

function looksLikeShadowContract(filePath, content, familyNames) {
  if (familyNames.size === 0) {
    return false;
  }

  const extension = path.extname(filePath);
  for (const familyName of familyNames) {
    const declaration = declarationPatternForExtension(extension, familyName);
    if (declaration != null && declaration.test(content)) {
      return true;
    }
  }
  return false;
}

function declarationPatternForExtension(extension, familyName) {
  const name = escapeRegExp(familyName);
  if (extension === '.graphql' || extension === '.gql') {
    return new RegExp(`\\b(type|enum|input|interface|union|scalar)\\s+${name}\\b`, 'm');
  }
  if (extension === '.ts' || extension === '.tsx' || extension === '.js' || extension === '.mjs' || extension === '.cjs') {
    return new RegExp(`\\b(export\\s+)?(type|interface|class|enum)\\s+${name}\\b`, 'm');
  }
  if (extension === '.rs') {
    return new RegExp(`\\b(pub\\s+)?(struct|enum|type)\\s+${name}\\b`, 'm');
  }
  return null;
}

function looksLikeGeneratedArtifactLeak(filePath, content, rule) {
  const basename = path.basename(filePath);
  const generatedNameMatch =
    rule.generatedArtifactBasenames.has(basename) ||
    basename.endsWith('.generated.ts') ||
    basename.endsWith('.generated.rs');
  if (!generatedNameMatch) {
    return false;
  }

  if (containsAny(content, rule.familyNames)) {
    return true;
  }

  return rule.authoredHomes.some((item) => content.includes(path.basename(item)));
}

function containsAny(content, values) {
  for (const value of values) {
    if (content.includes(value)) {
      return true;
    }
  }
  return false;
}

function describeFile(repoRoot, filePath) {
  return {
    path: describePath(repoRoot, filePath),
    basename: path.basename(filePath)
  };
}

function describePath(repoRoot, targetPath) {
  const relative = path.relative(repoRoot, targetPath);
  return relative === '' ? '.' : normalizeSeparators(relative);
}

function samePath(left, right) {
  return normalizeSeparators(path.resolve(left)) === normalizeSeparators(path.resolve(right));
}

function isWithin(candidate, root) {
  const normalizedCandidate = normalizeSeparators(path.resolve(candidate));
  const normalizedRoot = normalizeSeparators(path.resolve(root));
  return normalizedCandidate === normalizedRoot ||
    normalizedCandidate.startsWith(`${normalizedRoot}/`);
}

function normalizeSeparators(value) {
  return value.replace(/\\/g, '/');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function resolvePath(fs, targetPath) {
  const resolved = fs.resolve
    ? await fs.resolve(targetPath)
    : path.resolve(targetPath);
  return canonicalizePath(resolved);
}

async function canonicalizePath(targetPath) {
  try {
    return normalizeSeparators(await realpath(targetPath));
  } catch {
    return normalizeSeparators(path.resolve(targetPath));
  }
}

class PublicationBoundary {
  constructor(ownerId, boundaryPath) {
    this.ownerId = ownerId;
    this.boundaryPath = boundaryPath;
  }

  belongsToForeignRule(ruleId) {
    return this.ownerId !== ruleId;
  }
}

class AuthoredHomeBoundary extends PublicationBoundary {
  contains(filePath) {
    return samePath(filePath, this.boundaryPath);
  }
}

class RootPublicationBoundary extends PublicationBoundary {
  contains(filePath) {
    return isWithin(filePath, this.boundaryPath);
  }
}

class GeneratedRootBoundary extends RootPublicationBoundary {}

class CompatRootBoundary extends RootPublicationBoundary {}
