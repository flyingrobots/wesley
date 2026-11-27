#!/usr/bin/env node
import { lstat, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const directories = [
  '.wesley-cache',
  'out',
  'coverage',
  'dist',
  'tests/generated',
  'test/fixtures/examples/.wesley-cache',
  'test/fixtures/examples/out',
  'test/fixtures/blade/out'
];

// `.wesley/` mixes generated state with an authored project manifest:
// `wesley` discovers `.wesley/config.json` (crates/wesley-cli/src/main.rs,
// `discover_manifest_path`). Clean empties these directories but keeps the
// manifest.
const stateDirectories = ['.wesley', 'test/fixtures/examples/.wesley'];
const AUTHORED_MANIFEST = 'config.json';

const filePatterns = [
  {
    directory: 'test/fixtures/blade',
    shouldRemove: (name) => name.endsWith('.key') || name.endsWith('.pub')
  }
];

async function removePath(path, log) {
  try {
    await rm(path, { recursive: true, force: true });
    log(`removed ${path}`);
  } catch (error) {
    console.warn(`warning: could not remove ${path}: ${error.message}`);
  }
}

async function removePattern(root, { directory, shouldRemove }, log) {
  const path = join(root, directory);
  try {
    const entries = await readdir(path, { withFileTypes: true });
    await Promise.all(
      entries
        .filter((entry) => entry.isFile() && shouldRemove(entry.name))
        .map((entry) => removePath(join(path, entry.name), log))
    );
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`warning: could not inspect ${path}: ${error.message}`);
    }
  }
}

/**
 * Cleans one `.wesley/` directory. Returns a refusal message instead of
 * touching anything when a symbolic link makes the outcome unsafe: following
 * the directory link would delete files in its target, and `wesley` accepts a
 * symlinked `config.json` that this script could not otherwise tell apart.
 */
async function cleanStateDirectory(path, log) {
  let status;
  try {
    status = await lstat(path);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`warning: could not inspect ${path}: ${error.message}`);
    }
    return null;
  }
  if (status.isSymbolicLink()) {
    return `${path}: .wesley is a symbolic link; clean it by hand, or remove the link`;
  }
  if (!status.isDirectory()) {
    return null;
  }

  const entries = await readdir(path, { withFileTypes: true });
  const manifest = entries.find((entry) => entry.name === AUTHORED_MANIFEST);
  if (manifest?.isSymbolicLink()) {
    return `${join(path, AUTHORED_MANIFEST)}: config.json is a symbolic link; clean ${path} by hand`;
  }
  const keepsManifest = manifest?.isFile() ?? false;
  if (!keepsManifest) {
    await removePath(path, log);
    return null;
  }
  await Promise.all(
    entries
      .filter((entry) => entry !== manifest)
      .map((entry) => removePath(join(path, entry.name), log))
  );
  log(`kept ${join(path, AUTHORED_MANIFEST)} (authored project manifest)`);
  return null;
}

/**
 * Removes generated state under `root`. An authored `.wesley/config.json` is
 * kept, and a `.wesley/` that involves a symbolic link is left alone.
 *
 * @param {string} root workspace root
 * @param {{ log?: (message: string) => void }} [options]
 * @returns {Promise<{ refused: string[] }>} paths left untouched, with reasons
 */
export async function cleanWorkspace(root, { log = console.log } = {}) {
  await Promise.all(directories.map((directory) => removePath(join(root, directory), log)));
  const outcomes = await Promise.all(
    stateDirectories.map((directory) => cleanStateDirectory(join(root, directory), log))
  );
  await Promise.all(filePatterns.map((pattern) => removePattern(root, pattern, log)));
  return { refused: outcomes.filter((outcome) => outcome !== null) };
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

async function main() {
  const { refused } = await cleanWorkspace(process.cwd());
  for (const reason of refused) {
    console.error(`refused: ${reason}`);
  }
  if (refused.length > 0) {
    process.exitCode = 1;
  } else {
    console.log('workspace cleaned');
  }
}

if (invokedDirectly) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
