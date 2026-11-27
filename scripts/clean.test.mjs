import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { cleanWorkspace } from './clean.mjs';

async function workspace(files) {
  const root = await mkdtemp(join(tmpdir(), 'wesley-clean-'));
  for (const [path, contents] of Object.entries(files)) {
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), contents);
  }
  return root;
}

test('clean keeps an authored .wesley/config.json and removes generated .wesley state', async () => {
  const root = await workspace({
    '.wesley/config.json': '{"schema":"schema.graphql"}\n',
    '.wesley/bundle.json': '{}\n',
    '.wesley/history/run.json': '{}\n',
    'out/generated.ts': 'export {};\n'
  });
  try {
    await cleanWorkspace(root, { log: () => {} });

    assert.equal(
      await readFile(join(root, '.wesley/config.json'), 'utf8'),
      '{"schema":"schema.graphql"}\n'
    );
    assert.equal(existsSync(join(root, '.wesley/bundle.json')), false);
    assert.equal(existsSync(join(root, '.wesley/history')), false);
    assert.equal(existsSync(join(root, 'out')), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('clean removes a .wesley directory that holds no authored manifest', async () => {
  const root = await workspace({ '.wesley/bundle.json': '{}\n' });
  try {
    await cleanWorkspace(root, { log: () => {} });

    assert.equal(existsSync(join(root, '.wesley')), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('clean keeps the authored manifest in the examples fixture too', async () => {
  const root = await workspace({
    'test/fixtures/examples/.wesley/config.json': '{}\n',
    'test/fixtures/examples/.wesley/bundle.json': '{}\n'
  });
  try {
    await cleanWorkspace(root, { log: () => {} });

    assert.equal(existsSync(join(root, 'test/fixtures/examples/.wesley/config.json')), true);
    assert.equal(existsSync(join(root, 'test/fixtures/examples/.wesley/bundle.json')), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('clean refuses a symlinked .wesley and leaves the link target untouched', async () => {
  const root = await workspace({
    'elsewhere/config.json': '{}\n',
    'elsewhere/notes.txt': 'authored\n'
  });
  try {
    await symlink(join(root, 'elsewhere'), join(root, '.wesley'));

    const { refused } = await cleanWorkspace(root, { log: () => {} });

    assert.equal(existsSync(join(root, 'elsewhere/notes.txt')), true);
    assert.equal(existsSync(join(root, 'elsewhere/config.json')), true);
    assert.equal(existsSync(join(root, '.wesley')), true);
    assert.equal(refused.length, 1);
    assert.match(refused[0], /\.wesley is a symbolic link/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('clean refuses a .wesley whose config.json is a symbolic link', async () => {
  const root = await workspace({
    '.wesley/authored.json': '{"schema":"schema.graphql"}\n',
    '.wesley/bundle.json': '{}\n'
  });
  try {
    await symlink('authored.json', join(root, '.wesley/config.json'));

    const { refused } = await cleanWorkspace(root, { log: () => {} });

    assert.equal(
      await readFile(join(root, '.wesley/authored.json'), 'utf8'),
      '{"schema":"schema.graphql"}\n'
    );
    assert.equal(existsSync(join(root, '.wesley/config.json')), true);
    assert.equal(existsSync(join(root, '.wesley/bundle.json')), true);
    assert.equal(refused.length, 1);
    assert.match(refused[0], /config\.json is a symbolic link/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
