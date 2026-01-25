/**
 * TTD Determinism Integration Tests
 *
 * Verifies that the TTD compiler produces identical output for identical input.
 * "Same SDL + same clock → identical output bytes"
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileTtdProtocol, hashSchema } from '@wesley/core/ttd';
import { FakeClock } from '@wesley/core/ports';
import { testCrypto } from '../setup.mjs';
import { normalizeOutputTree, compareOutputTrees } from '../helpers/normalize.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(__dirname, '../fixtures/basic-protocol');
const basicProtocolSdl = readFileSync(join(fixtureDir, 'basic-protocol.graphql'), 'utf-8');
const expectedSchemaHash = readFileSync(join(fixtureDir, 'expected.schema_hash.txt'), 'utf-8').trim();

describe('Determinism', () => {
  describe('Byte-for-byte Output Stability', () => {
    it('produces identical outputs for identical inputs', async () => {
      // Use identical FakeClock instances with same timestamp
      const clock1 = new FakeClock('2025-01-01T00:00:00.000Z');
      const clock2 = new FakeClock('2025-01-01T00:00:00.000Z');

      const result1 = await compileTtdProtocol({
        sdl: basicProtocolSdl,
        targets: ['manifest', 'typescript'],
        deps: { clock: clock1, crypto: testCrypto },
      });

      const result2 = await compileTtdProtocol({
        sdl: basicProtocolSdl,
        targets: ['manifest', 'typescript'],
        deps: { clock: clock2, crypto: testCrypto },
      });

      // Schema hashes must match
      expect(result1.schemaHash).toBe(result2.schemaHash);

      // Normalize both output trees
      const normalized1 = normalizeOutputTree(result1.files);
      const normalized2 = normalizeOutputTree(result2.files);

      // Compare trees
      const comparison = compareOutputTrees(normalized1, normalized2);

      expect(comparison.identical, 'Output trees should be identical').toBe(true);
      expect(comparison.onlyIn1).toHaveLength(0);
      expect(comparison.onlyIn2).toHaveLength(0);
      expect(comparison.contentDiffs).toHaveLength(0);
    });

    it('produces identical JSON manifest content', async () => {
      const clock = new FakeClock('2025-01-01T00:00:00.000Z');
      const deps = { clock, crypto: testCrypto };

      const result1 = await compileTtdProtocol({ sdl: basicProtocolSdl, targets: ['manifest'], deps });
      const result2 = await compileTtdProtocol({ sdl: basicProtocolSdl, targets: ['manifest'], deps });

      for (const file1 of result1.files) {
        const file2 = result2.files.find(f => f.path === file1.path);
        expect(file2, `File ${file1.path} should exist in both results`).toBeDefined();
        expect(file1.content, `Content of ${file1.path} should match`).toBe(file2.content);
      }
    });

    it('produces identical TypeScript content', async () => {
      const clock = new FakeClock('2025-01-01T00:00:00.000Z');
      const deps = { clock, crypto: testCrypto };

      const result1 = await compileTtdProtocol({ sdl: basicProtocolSdl, targets: ['typescript'], deps });
      const result2 = await compileTtdProtocol({ sdl: basicProtocolSdl, targets: ['typescript'], deps });

      for (const file1 of result1.files) {
        const file2 = result2.files.find(f => f.path === file1.path);
        expect(file2, `File ${file1.path} should exist in both results`).toBeDefined();
        expect(file1.content, `Content of ${file1.path} should match`).toBe(file2.content);
      }
    });
  });

  describe('Golden Schema Hash', () => {
    it('schema hash matches expected golden value', () => {
      const hash = hashSchema(basicProtocolSdl, { crypto: testCrypto });
      expect(hash).toBe(expectedSchemaHash);
    });

    it('schema hash is 64 character hex string', () => {
      const hash = hashSchema(basicProtocolSdl, { crypto: testCrypto });
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('compileTtdProtocol returns same hash as hashSchema', async () => {
      const clock = new FakeClock('2025-01-01T00:00:00.000Z');
      const deps = { clock, crypto: testCrypto };

      const result = await compileTtdProtocol({ sdl: basicProtocolSdl, deps });
      const directHash = hashSchema(basicProtocolSdl, { crypto: testCrypto });

      expect(result.schemaHash).toBe(directHash);
    });
  });

  describe('JSON Canonical Ordering', () => {
    it('manifest JSON is valid and parseable', async () => {
      const clock = new FakeClock('2025-01-01T00:00:00.000Z');
      const deps = { clock, crypto: testCrypto };

      const result = await compileTtdProtocol({ sdl: basicProtocolSdl, targets: ['manifest'], deps });

      for (const file of result.files.filter(f => f.path.endsWith('.json'))) {
        // Should be valid JSON
        const obj = JSON.parse(file.content);
        expect(obj).toBeDefined();
      }
    });

    it('ops array is sorted by op_id', async () => {
      const clock = new FakeClock('2025-01-01T00:00:00.000Z');
      const deps = { clock, crypto: testCrypto };

      const result = await compileTtdProtocol({ sdl: basicProtocolSdl, targets: ['manifest'], deps });
      const schemaFile = result.files.find(f => f.path === 'manifest/schema.json');
      const schema = JSON.parse(schemaFile.content);

      const opIds = schema.ops.map(o => o.op_id);
      const sorted = [...opIds].sort((a, b) => a - b);
      expect(opIds).toEqual(sorted);
    });

    it('registry entries are sorted by id', async () => {
      const clock = new FakeClock('2025-01-01T00:00:00.000Z');
      const deps = { clock, crypto: testCrypto };

      const result = await compileTtdProtocol({ sdl: basicProtocolSdl, targets: ['manifest'], deps });
      const manifestFile = result.files.find(f => f.path === 'manifest/manifest.json');
      const manifest = JSON.parse(manifestFile.content);

      const ids = manifest.registry.entries.map(e => e.id);
      const sorted = [...ids].sort((a, b) => a - b);
      expect(ids).toEqual(sorted);
    });
  });

  describe('Timestamp Handling', () => {
    it('different timestamps produce different raw output', async () => {
      const clock1 = new FakeClock('2025-01-01T00:00:00.000Z');
      const clock2 = new FakeClock('2025-12-31T23:59:59.000Z');

      const result1 = await compileTtdProtocol({
        sdl: basicProtocolSdl,
        targets: ['manifest'],
        deps: { clock: clock1, crypto: testCrypto },
      });

      const result2 = await compileTtdProtocol({
        sdl: basicProtocolSdl,
        targets: ['manifest'],
        deps: { clock: clock2, crypto: testCrypto },
      });

      // Schema hash should be the same (doesn't include timestamp)
      expect(result1.schemaHash).toBe(result2.schemaHash);

      // But raw content differs due to generatedAt
      const schema1 = result1.files.find(f => f.path === 'manifest/schema.json');
      const schema2 = result2.files.find(f => f.path === 'manifest/schema.json');
      expect(schema1.content).not.toBe(schema2.content);
    });

    it('schema hash is independent of timestamp', async () => {
      const clock1 = new FakeClock('2025-01-01T00:00:00.000Z');
      const clock2 = new FakeClock('2025-12-31T23:59:59.000Z');

      const result1 = await compileTtdProtocol({
        sdl: basicProtocolSdl,
        targets: ['manifest'],
        deps: { clock: clock1, crypto: testCrypto },
      });

      const result2 = await compileTtdProtocol({
        sdl: basicProtocolSdl,
        targets: ['manifest'],
        deps: { clock: clock2, crypto: testCrypto },
      });

      // Schema hash should be identical regardless of timestamp
      expect(result1.schemaHash).toBe(result2.schemaHash);

      // Same number of files should be generated
      expect(result1.files.length).toBe(result2.files.length);
    });
  });
});

