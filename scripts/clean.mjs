#!/usr/bin/env node
import { readdir, rm } from 'node:fs/promises';
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

async function cleanStateDirectory(path, log) {
  let entries;
  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`warning: could not inspect ${path}: ${error.message}`);
    }
    return;
  }
  const keepsManifest = entries.some((entry) => entry.isFile() && entry.name === AUTHORED_MANIFEST);
  if (!keepsManifest) {
    await removePath(path, log);
    return;
  }
  await Promise.all(
    entries
      .filter((entry) => !(entry.isFile() && entry.name === AUTHORED_MANIFEST))
      .map((entry) => removePath(join(path, entry.name), log))
  );
  log(`kept ${join(path, AUTHORED_MANIFEST)} (authored project manifest)`);
}

/**
 * Removes generated state under `root`. An authored `.wesley/config.json` is kept.
 *
 * @param {string} root workspace root
 * @param {{ log?: (message: string) => void }} [options]
 */
export async function cleanWorkspace(root, { log = console.log } = {}) {
  await Promise.all(directories.map((directory) => removePath(join(root, directory), log)));
  await Promise.all(
    stateDirectories.map((directory) => cleanStateDirectory(join(root, directory), log))
  );
  await Promise.all(filePatterns.map((pattern) => removePattern(root, pattern, log)));
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedDirectly) {
  cleanWorkspace(process.cwd())
    .then(() => console.log('workspace cleaned'))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
