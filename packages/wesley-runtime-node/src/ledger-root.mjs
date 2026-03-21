import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function resolveLedgerRootDir({
  repoRoot = process.cwd(),
  env = process.env,
  configPath = null
} = {}) {
  const requested = normalizeOptionalString(env?.WESLEY_LEDGER_PATH);
  if (requested) {
    return resolveFromRoot(repoRoot, requested);
  }

  const candidateConfigPath = await resolveConfigPath(repoRoot, configPath);
  if (candidateConfigPath) {
    const loaded = await import(pathToFileURL(candidateConfigPath).href);
    const configured = normalizeOptionalString(loaded?.default?.ledger?.repoPath);
    if (configured) {
      return resolveFromRoot(repoRoot, configured);
    }
  }

  return path.join(repoRoot, '.wesley', 'ledger');
}

async function resolveConfigPath(repoRoot, configPath) {
  const explicit = normalizeOptionalString(configPath);
  if (explicit) {
    const resolved = resolveFromRoot(repoRoot, explicit);
    return existsSync(resolved) ? resolved : null;
  }

  const localConfig = path.join(repoRoot, 'wesley.config.mjs');
  return existsSync(localConfig) ? localConfig : null;
}

function resolveFromRoot(repoRoot, target) {
  return path.isAbsolute(target) ? target : path.resolve(repoRoot, target);
}

function normalizeOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
