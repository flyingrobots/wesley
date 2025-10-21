#!/usr/bin/env node
import { rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const directories = [
  '.wesley',
  'out',
  'coverage',
  'dist',
  'tests/generated',
  'test/fixtures/examples/.wesley',
  'test/fixtures/examples/out',
  'test/fixtures/blade/out',
];

const filePatterns = [
  {
    directory: 'test/fixtures/blade',
    shouldRemove: (name) => name.endsWith('.key') || name.endsWith('.pub'),
  },
];

async function removePath(path) {
  try {
    await rm(path, { recursive: true, force: true });
    console.log(`removed ${path}`);
  } catch (error) {
    console.warn(`warning: could not remove ${path}: ${error.message}`);
  }
}

async function removePattern({ directory, shouldRemove }) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    await Promise.all(
      entries
        .filter((entry) => entry.isFile() && shouldRemove(entry.name))
        .map((entry) => removePath(join(directory, entry.name))),
    );
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`warning: could not inspect ${directory}: ${error.message}`);
    }
  }
}

async function main() {
  await Promise.all(directories.map(removePath));
  await Promise.all(filePatterns.map(removePattern));
  console.log('workspace cleaned');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
