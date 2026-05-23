import test from 'node:test';
import assert from 'node:assert/strict';

import { ArtifactWriter } from '../../src/application/ArtifactWriter.mjs';
import { ArtifactWriterPort, detectConflicts } from '../../src/ports/ArtifactWriter.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Capture a thrown error for assertion. */
function catchError(fn) {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error('Expected function to throw');
}

/** Capture a rejected promise for assertion. */
async function catchReject(fn) {
  try {
    await fn();
  } catch (e) {
    return e;
  }
  throw new Error('Expected promise to reject');
}

/**
 * In-memory filesystem mock.
 * Stores files as { [path]: string|Uint8Array }.
 * Tracks mkdir calls and supports rename, stat, rm.
 */
function createMemoryFs() {
  /** @type {Map<string, string|Uint8Array>} */
  const files = new Map();
  /** @type {Set<string>} */
  const dirs = new Set();
  /** @type {string[]} */
  const ops = []; // operation log for debugging

  return {
    files,
    dirs,
    ops,
    async writeFile(path, data) {
      ops.push(`writeFile:${path}`);
      files.set(path, data);
    },
    async mkdir(path, _options) {
      ops.push(`mkdir:${path}`);
      dirs.add(path);
    },
    async rename(oldPath, newPath) {
      ops.push(`rename:${oldPath}->${newPath}`);
      if (!files.has(oldPath)) {
        throw new Error(`ENOENT: rename source not found: ${oldPath}`);
      }
      files.set(newPath, files.get(oldPath));
      files.delete(oldPath);
    },
    async stat(path) {
      ops.push(`stat:${path}`);
      if (files.has(path))
        return {
          isFile() {
            return true;
          }
        };
      throw Object.assign(new Error(`ENOENT: ${path}`), { code: 'ENOENT' });
    },
    async rm(path, _options) {
      ops.push(`rm:${path}`);
      // Remove files under this path
      for (const key of [...files.keys()]) {
        if (key.startsWith(path)) files.delete(key);
      }
      for (const key of [...dirs]) {
        if (key.startsWith(path)) dirs.delete(key);
      }
    }
  };
}

/** Build a minimal RunResult for testing */
function makeRunResult(pluginArtifacts = []) {
  const results = pluginArtifacts.map(({ name, artifacts }) => ({
    name,
    status: 'ok',
    artifacts,
    artifactCount: Object.keys(artifacts).length,
    durationMs: 1
  }));
  return {
    results,
    success: true,
    totalArtifacts: results.reduce((sum, r) => sum + r.artifactCount, 0),
    runId: 'run-test-abc123'
  };
}

const nullLogger = {
  info() {},
  warn() {},
  error() {},
  debug() {},
  child() {
    return nullLogger;
  },
  setLevel() {},
  async flush() {}
};

/** Collecting logger that stores warn calls */
function collectingLogger() {
  const warnings = [];
  const logger = {
    info() {},
    warn(...args) {
      warnings.push(args);
    },
    error() {},
    debug() {},
    child() {
      return logger;
    },
    setLevel() {},
    async flush() {}
  };
  return { logger, warnings };
}

// ===========================================================================
// ArtifactWriterPort (abstract port)
// ===========================================================================

test('ArtifactWriterPort — abstract method throws', async () => {
  const port = new ArtifactWriterPort();
  const err = await catchReject(() => port.writeArtifacts({}, '/out'));
  assert.match(err.message, /must be implemented/);
});

// ===========================================================================
// detectConflicts (pure function)
// ===========================================================================

test('detectConflicts — no conflicts when plugins have disjoint paths', () => {
  const runResult = makeRunResult([
    { name: 'alpha', artifacts: { 'a.txt': 'aaa' } },
    { name: 'beta', artifacts: { 'b.txt': 'bbb' } }
  ]);
  const conflicts = detectConflicts(runResult);
  assert.equal(conflicts.length, 0);
});

test('detectConflicts — detects conflict when two plugins share a path', () => {
  const runResult = makeRunResult([
    { name: 'alpha', artifacts: { 'shared.txt': 'from-alpha' } },
    { name: 'beta', artifacts: { 'shared.txt': 'from-beta' } }
  ]);
  const conflicts = detectConflicts(runResult);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].path, 'shared.txt');
  assert.deepEqual(conflicts[0].plugins, ['alpha', 'beta']);
});

test('detectConflicts — skips error results', () => {
  const runResult = {
    results: [
      { name: 'ok-plugin', status: 'ok', artifacts: { 'a.txt': 'aaa' } },
      { name: 'err-plugin', status: 'error', artifacts: { 'a.txt': 'eee' } }
    ],
    success: true,
    totalArtifacts: 1,
    runId: 'run-test-123'
  };
  const conflicts = detectConflicts(runResult);
  assert.equal(conflicts.length, 0);
});

test('detectConflicts — handles null/undefined runResult gracefully', () => {
  assert.deepEqual(detectConflicts(null), []);
  assert.deepEqual(detectConflicts(undefined), []);
  assert.deepEqual(detectConflicts({}), []);
});

test('detectConflicts — three plugins on same path', () => {
  const runResult = makeRunResult([
    { name: 'a', artifacts: { 'x.txt': '1' } },
    { name: 'b', artifacts: { 'x.txt': '2' } },
    { name: 'c', artifacts: { 'x.txt': '3' } }
  ]);
  const conflicts = detectConflicts(runResult);
  assert.equal(conflicts.length, 1);
  assert.deepEqual(conflicts[0].plugins, ['a', 'b', 'c']);
});

// ===========================================================================
// ArtifactWriter — constructor
// ===========================================================================

test('ArtifactWriter — constructor throws on missing fs', () => {
  const err = catchError(() => new ArtifactWriter({}));
  assert.match(err.message, /fs/i);
});

test('ArtifactWriter — constructor throws on invalid fs.writeFile', () => {
  const err = catchError(
    () => new ArtifactWriter({ fs: { writeFile: 'nope', mkdir() {}, rename() {} } })
  );
  assert.match(err.message, /writeFile/);
});

test('ArtifactWriter — constructor throws on invalid fs.mkdir', () => {
  const err = catchError(
    () => new ArtifactWriter({ fs: { writeFile() {}, mkdir: null, rename() {} } })
  );
  assert.match(err.message, /mkdir/);
});

test('ArtifactWriter — constructor throws on invalid fs.rename', () => {
  const err = catchError(
    () => new ArtifactWriter({ fs: { writeFile() {}, mkdir() {}, rename: 42 } })
  );
  assert.match(err.message, /rename/);
});

// ===========================================================================
// ArtifactWriter — golden path
// ===========================================================================

test('ArtifactWriter — golden path: writes artifacts from RunResult', async () => {
  const memFs = createMemoryFs();
  const writer = new ArtifactWriter({ fs: memFs, logger: nullLogger });

  const runResult = makeRunResult([
    { name: 'gen-sql', artifacts: { 'schema.sql': 'CREATE TABLE t();' } },
    { name: 'gen-ts', artifacts: { 'types.ts': 'export type T = {};' } }
  ]);

  const result = await writer.writeArtifacts(runResult, '/output');

  assert.deepEqual(result.written.sort(), ['schema.sql', 'types.ts']);
  assert.deepEqual(result.skipped, []);
  assert.deepEqual(result.conflicts, []);

  // Verify files are at final locations
  assert.equal(memFs.files.get('/output/schema.sql'), 'CREATE TABLE t();');
  assert.equal(memFs.files.get('/output/types.ts'), 'export type T = {};');
});

test('ArtifactWriter — writes binary Uint8Array artifacts', async () => {
  const memFs = createMemoryFs();
  const writer = new ArtifactWriter({ fs: memFs, logger: nullLogger });

  const binaryData = new Uint8Array([0x00, 0xff, 0x42]);
  const runResult = makeRunResult([{ name: 'gen-bin', artifacts: { 'data.bin': binaryData } }]);

  const result = await writer.writeArtifacts(runResult, '/out');

  assert.deepEqual(result.written, ['data.bin']);
  assert.ok(memFs.files.get('/out/data.bin') instanceof Uint8Array);
  assert.deepEqual(memFs.files.get('/out/data.bin'), binaryData);
});

test('ArtifactWriter — handles nested artifact paths', async () => {
  const memFs = createMemoryFs();
  const writer = new ArtifactWriter({ fs: memFs, logger: nullLogger });

  const runResult = makeRunResult([
    { name: 'gen', artifacts: { 'deep/nested/file.txt': 'content' } }
  ]);

  const result = await writer.writeArtifacts(runResult, '/out');
  assert.deepEqual(result.written, ['deep/nested/file.txt']);
  assert.equal(memFs.files.get('/out/deep/nested/file.txt'), 'content');
});

// ===========================================================================
// ArtifactWriter — conflict detection
// ===========================================================================

test('ArtifactWriter — reports conflicts but writes last-wins by default', async () => {
  const { logger, warnings } = collectingLogger();
  const memFs = createMemoryFs();
  const writer = new ArtifactWriter({ fs: memFs, logger });

  const runResult = makeRunResult([
    { name: 'alpha', artifacts: { 'shared.txt': 'from-alpha' } },
    { name: 'beta', artifacts: { 'shared.txt': 'from-beta' } }
  ]);

  const result = await writer.writeArtifacts(runResult, '/out');

  assert.deepEqual(result.conflicts, ['shared.txt']);
  assert.deepEqual(result.written, ['shared.txt']);
  // Last-wins: beta overwrites alpha
  assert.equal(memFs.files.get('/out/shared.txt'), 'from-beta');
  // Warning was logged
  assert.ok(warnings.length > 0);
});

// ===========================================================================
// ArtifactWriter — dry run
// ===========================================================================

test('ArtifactWriter — dry run: reports but writes nothing', async () => {
  const memFs = createMemoryFs();
  const writer = new ArtifactWriter({ fs: memFs, logger: nullLogger });

  const runResult = makeRunResult([{ name: 'gen', artifacts: { 'a.txt': 'aaa', 'b.txt': 'bbb' } }]);

  const result = await writer.writeArtifacts(runResult, '/out', { dryRun: true });

  assert.deepEqual(result.written, []);
  assert.deepEqual(result.skipped.sort(), ['a.txt', 'b.txt']);
  // No files written to disk
  assert.equal(memFs.files.size, 0);
});

test('ArtifactWriter — dry run still reports conflicts', async () => {
  const memFs = createMemoryFs();
  const writer = new ArtifactWriter({ fs: memFs, logger: nullLogger });

  const runResult = makeRunResult([
    { name: 'a', artifacts: { 'x.txt': '1' } },
    { name: 'b', artifacts: { 'x.txt': '2' } }
  ]);

  const result = await writer.writeArtifacts(runResult, '/out', { dryRun: true });
  assert.deepEqual(result.conflicts, ['x.txt']);
});

// ===========================================================================
// ArtifactWriter — overwrite behavior
// ===========================================================================

test('ArtifactWriter — overwrite=true (default) overwrites existing files', async () => {
  const memFs = createMemoryFs();
  // Pre-populate an existing file
  memFs.files.set('/out/existing.txt', 'old-content');
  const writer = new ArtifactWriter({ fs: memFs, logger: nullLogger });

  const runResult = makeRunResult([{ name: 'gen', artifacts: { 'existing.txt': 'new-content' } }]);

  const result = await writer.writeArtifacts(runResult, '/out', { overwrite: true });
  assert.deepEqual(result.written, ['existing.txt']);
  assert.equal(memFs.files.get('/out/existing.txt'), 'new-content');
});

test('ArtifactWriter — overwrite=false skips existing files', async () => {
  const memFs = createMemoryFs();
  // Pre-populate an existing file at the final path
  memFs.files.set('/out/existing.txt', 'old-content');
  const writer = new ArtifactWriter({ fs: memFs, logger: nullLogger });

  const runResult = makeRunResult([
    { name: 'gen', artifacts: { 'existing.txt': 'new-content', 'fresh.txt': 'brand-new' } }
  ]);

  const result = await writer.writeArtifacts(runResult, '/out', { overwrite: false });

  assert.ok(result.skipped.includes('existing.txt'));
  assert.ok(result.written.includes('fresh.txt'));
  // Original file preserved
  assert.equal(memFs.files.get('/out/existing.txt'), 'old-content');
  assert.equal(memFs.files.get('/out/fresh.txt'), 'brand-new');
});

// ===========================================================================
// ArtifactWriter — atomic: cleanup on failure
// ===========================================================================

test('ArtifactWriter — cleans up temp dir on write failure', async () => {
  let writeCount = 0;
  const memFs = createMemoryFs();
  const originalWriteFile = memFs.writeFile.bind(memFs);
  memFs.writeFile = async (path, data) => {
    writeCount++;
    if (writeCount === 2) {
      throw new Error('Simulated disk full');
    }
    return originalWriteFile(path, data);
  };

  const writer = new ArtifactWriter({ fs: memFs, logger: nullLogger });

  const runResult = makeRunResult([{ name: 'gen', artifacts: { 'a.txt': 'aaa', 'b.txt': 'bbb' } }]);

  const err = await catchReject(() => writer.writeArtifacts(runResult, '/out'));
  assert.match(err.message, /disk full/i);

  // Temp directory should have been cleaned up
  const tmpKeys = [...memFs.files.keys()].filter((k) => k.includes('.wesley-tmp-'));
  assert.equal(tmpKeys.length, 0, 'Temp files should be cleaned up after failure');
});

// ===========================================================================
// ArtifactWriter — edge cases
// ===========================================================================

test('ArtifactWriter — empty RunResult (no artifacts) → empty result', async () => {
  const memFs = createMemoryFs();
  const writer = new ArtifactWriter({ fs: memFs, logger: nullLogger });

  const runResult = makeRunResult([]);
  const result = await writer.writeArtifacts(runResult, '/out');

  assert.deepEqual(result.written, []);
  assert.deepEqual(result.skipped, []);
  assert.deepEqual(result.conflicts, []);
});

test('ArtifactWriter — skips error-status plugins in RunResult', async () => {
  const memFs = createMemoryFs();
  const writer = new ArtifactWriter({ fs: memFs, logger: nullLogger });

  const runResult = {
    results: [
      { name: 'good', status: 'ok', artifacts: { 'a.txt': 'ok' }, artifactCount: 1, durationMs: 1 },
      {
        name: 'bad',
        status: 'error',
        artifactCount: 0,
        errorCode: 'WPLY002',
        errorMessage: 'boom',
        phase: 'plan',
        durationMs: 1
      }
    ],
    success: true,
    totalArtifacts: 1,
    runId: 'run-test-err'
  };

  const result = await writer.writeArtifacts(runResult, '/out');
  assert.deepEqual(result.written, ['a.txt']);
  assert.ok(!memFs.files.has('/out/boom'));
});

test('ArtifactWriter — throws on invalid runResult', async () => {
  const memFs = createMemoryFs();
  const writer = new ArtifactWriter({ fs: memFs });

  const err = await catchReject(() => writer.writeArtifacts(null, '/out'));
  assert.match(err.message, /runResult/);
});

test('ArtifactWriter — throws on empty outputDir', async () => {
  const memFs = createMemoryFs();
  const writer = new ArtifactWriter({ fs: memFs });

  const err = await catchReject(() => writer.writeArtifacts(makeRunResult([]), ''));
  assert.match(err.message, /outputDir/);
});

test('ArtifactWriter — works without logger (uses internal noop)', async () => {
  const memFs = createMemoryFs();
  const writer = new ArtifactWriter({ fs: memFs });

  const runResult = makeRunResult([{ name: 'gen', artifacts: { 'a.txt': 'hello' } }]);

  const result = await writer.writeArtifacts(runResult, '/out');
  assert.deepEqual(result.written, ['a.txt']);
});

test('ArtifactWriter — works without fs.rm (cleanup is best-effort)', async () => {
  const memFs = createMemoryFs();
  delete memFs.rm;
  const writer = new ArtifactWriter({ fs: memFs, logger: nullLogger });

  const runResult = makeRunResult([{ name: 'gen', artifacts: { 'a.txt': 'hello' } }]);

  // Should not throw even though rm is not available
  const result = await writer.writeArtifacts(runResult, '/out');
  assert.deepEqual(result.written, ['a.txt']);
});

// ===========================================================================
// ArtifactWriter — path traversal protection
// ===========================================================================

test('ArtifactWriter — rejects artifact keys with path traversal (..)', async () => {
  const memFs = createMemoryFs();
  const writer = new ArtifactWriter({ fs: memFs, logger: nullLogger });

  const runResult = makeRunResult([{ name: 'evil', artifacts: { '../../etc/passwd': 'pwned' } }]);

  const err = await catchReject(() => writer.writeArtifacts(runResult, '/out'));
  assert.match(err.message, /traversal|outside/i);
});

test('ArtifactWriter — rejects absolute artifact paths', async () => {
  const memFs = createMemoryFs();
  const writer = new ArtifactWriter({ fs: memFs, logger: nullLogger });

  const runResult = makeRunResult([{ name: 'evil', artifacts: { '/etc/passwd': 'pwned' } }]);

  const err = await catchReject(() => writer.writeArtifacts(runResult, '/out'));
  assert.match(err.message, /traversal|outside|absolute/i);
});

test('ArtifactWriter — allows legitimate nested paths', async () => {
  const memFs = createMemoryFs();
  const writer = new ArtifactWriter({ fs: memFs, logger: nullLogger });

  const runResult = makeRunResult([{ name: 'gen', artifacts: { 'sub/dir/file.txt': 'ok' } }]);

  const result = await writer.writeArtifacts(runResult, '/out');
  assert.deepEqual(result.written, ['sub/dir/file.txt']);
  assert.equal(memFs.files.get('/out/sub/dir/file.txt'), 'ok');
});

test('ArtifactWriter — works without fs.stat (overwrite=false always writes)', async () => {
  const memFs = createMemoryFs();
  delete memFs.stat;
  const writer = new ArtifactWriter({ fs: memFs, logger: nullLogger });

  const runResult = makeRunResult([{ name: 'gen', artifacts: { 'a.txt': 'hello' } }]);

  // Without stat, cannot detect existing files, so always writes
  const result = await writer.writeArtifacts(runResult, '/out', { overwrite: false });
  assert.deepEqual(result.written, ['a.txt']);
});
