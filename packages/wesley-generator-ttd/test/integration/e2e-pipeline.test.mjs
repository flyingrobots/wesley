/**
 * TTD End-to-End Pipeline Integration Tests
 *
 * Tests the complete flow: SDL → Extract → Validate → Codegen → Verify
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import {
  compileTtdProtocol,
  extractTtdSchema
} from '@wesley/core/ttd';
import { createVerifier } from '@wesley/core/ttd/invariants';
import { FakeClock } from '@wesley/core/ports';
import { testCrypto } from '../setup.mjs';
import { assertNoAbsolutePaths } from '../helpers/normalize.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(__dirname, '../fixtures/basic-protocol');
const basicProtocolSdl = readFileSync(join(fixtureDir, 'basic-protocol.graphql'), 'utf-8');

const clock = new FakeClock('2025-01-01T00:00:00.000Z');
const deps = { clock, crypto: testCrypto };

describe('E2E Pipeline Integration', () => {
  describe('Full Pipeline', () => {
    it('compiles SDL to all target outputs', async () => {
      const result = await compileTtdProtocol({
        sdl: basicProtocolSdl,
        targets: ['manifest', 'typescript'],
        deps
      });

      expect(result.files.length).toBeGreaterThan(0);
      expect(result.schemaHash).toBeDefined();
      expect(result.validation.valid).toBe(true);
    });

    it('generates expected manifest files', async () => {
      const result = await compileTtdProtocol({
        sdl: basicProtocolSdl,
        targets: ['manifest'],
        deps
      });

      const paths = result.files.map(f => f.path);
      expect(paths).toContain('manifest/schema.json');
      expect(paths).toContain('manifest/contracts.json');
      expect(paths).toContain('manifest/manifest.json');
      expect(paths).toContain('manifest/ttd-ir.json');
    });

    it('generates expected typescript files', async () => {
      const result = await compileTtdProtocol({
        sdl: basicProtocolSdl,
        targets: ['typescript'],
        deps
      });

      const paths = result.files.map(f => f.path);
      expect(paths).toContain('typescript/types.ts');
      expect(paths).toContain('typescript/zod.ts');
      expect(paths).toContain('typescript/registry.ts');
      expect(paths).toContain('typescript/index.ts');
    });

    it('outputs contain no absolute paths', async () => {
      const result = await compileTtdProtocol({
        sdl: basicProtocolSdl,
        targets: ['manifest', 'typescript'],
        deps
      });

      // Should not throw
      assertNoAbsolutePaths(result.files);
    });
  });

  describe('Schema.json Content Shape', () => {
    it('contains required top-level fields', async () => {
      const result = await compileTtdProtocol({
        sdl: basicProtocolSdl,
        targets: ['manifest'],
        deps
      });

      const schemaFile = result.files.find(f => f.path === 'manifest/schema.json');
      const schema = JSON.parse(schemaFile.content);

      expect(schema).toHaveProperty('version');
      expect(schema).toHaveProperty('hash');
      expect(schema).toHaveProperty('channels');
      expect(schema).toHaveProperty('ops');
      expect(schema).toHaveProperty('rules');
      expect(schema).toHaveProperty('types');
      expect(schema).toHaveProperty('enums');
    });

    it('channels array contains expected channel', async () => {
      const result = await compileTtdProtocol({
        sdl: basicProtocolSdl,
        targets: ['manifest'],
        deps
      });

      const schemaFile = result.files.find(f => f.path === 'manifest/schema.json');
      const schema = JSON.parse(schemaFile.content);

      expect(schema.channels.length).toBe(1);
      expect(schema.channels[0].name).toBe('counter');
      expect(schema.channels[0].eventTypes).toContain('CounterIncremented');
    });

    it('ops array contains expected operations', async () => {
      const result = await compileTtdProtocol({
        sdl: basicProtocolSdl,
        targets: ['manifest'],
        deps
      });

      const schemaFile = result.files.find(f => f.path === 'manifest/schema.json');
      const schema = JSON.parse(schemaFile.content);

      const opNames = schema.ops.map(o => o.name);
      expect(opNames).toContain('increment');
      expect(opNames).toContain('decrement');
      expect(opNames).toContain('reset');
    });

    it('ops array is sorted by op_id', async () => {
      const result = await compileTtdProtocol({
        sdl: basicProtocolSdl,
        targets: ['manifest'],
        deps
      });

      const schemaFile = result.files.find(f => f.path === 'manifest/schema.json');
      const schema = JSON.parse(schemaFile.content);

      const opIds = schema.ops.map(o => o.op_id);
      const sorted = [...opIds].sort((a, b) => a - b);
      expect(opIds).toEqual(sorted);
    });
  });

  describe('TypeScript Types Content Shape', () => {
    it('exports expected interfaces', async () => {
      const result = await compileTtdProtocol({
        sdl: basicProtocolSdl,
        targets: ['typescript'],
        deps
      });

      const typesFile = result.files.find(f => f.path === 'typescript/types.ts');
      const content = typesFile.content;

      expect(content).toContain('export interface Counter');
      expect(content).toContain('export interface CounterIncremented');
      expect(content).toContain('export enum CounterState');
      expect(content).toContain('export interface IncrementArgs');
    });

    it('generated TypeScript has valid syntax structure', async () => {
      const result = await compileTtdProtocol({
        sdl: basicProtocolSdl,
        targets: ['typescript'],
        deps
      });

      const typesContent = result.files.find(f => f.path === 'typescript/types.ts').content;
      const zodContent = result.files.find(f => f.path === 'typescript/zod.ts').content;
      const registryContent = result.files.find(f => f.path === 'typescript/registry.ts').content;

      // Verify basic structure (not full compilation since that requires zod types)
      expect(typesContent).toContain('export interface');
      expect(typesContent).toContain('export enum');
      expect(zodContent).toContain('import { z }');
      expect(zodContent).toContain('z.object');
      expect(registryContent).toContain('export const');
    });
  });

  describe('Registry Content Shape', () => {
    it('contains type registry with expected entries', async () => {
      const result = await compileTtdProtocol({
        sdl: basicProtocolSdl,
        targets: ['typescript'],
        deps
      });

      const registryFile = result.files.find(f => f.path === 'typescript/registry.ts');
      const content = registryFile.content;

      expect(content).toContain('TYPE_REGISTRY');
      expect(content).toContain('COUNTER_INCREMENTED_TYPE_ID');
    });

    it('contains op registry with expected entries', async () => {
      const result = await compileTtdProtocol({
        sdl: basicProtocolSdl,
        targets: ['typescript'],
        deps
      });

      const registryFile = result.files.find(f => f.path === 'typescript/registry.ts');
      const content = registryFile.content;

      expect(content).toContain('OP_REGISTRY');
      expect(content).toContain('INCREMENT_OP_ID');
      expect(content).toContain('DECREMENT_OP_ID');
    });
  });

  describe('Manifest Consistency', () => {
    it('manifest.json registry entries match schema.json types', async () => {
      const result = await compileTtdProtocol({
        sdl: basicProtocolSdl,
        targets: ['manifest'],
        deps
      });

      const schemaFile = result.files.find(f => f.path === 'manifest/schema.json');
      const manifestFile = result.files.find(f => f.path === 'manifest/manifest.json');

      const schema = JSON.parse(schemaFile.content);
      const manifest = JSON.parse(manifestFile.content);

      // Registry entries should reference types that exist in schema
      for (const entry of manifest.registry.entries) {
        const typeExists = schema.types.some(t => t.name === entry.typeName);
        expect(typeExists, `Type ${entry.typeName} should exist in schema`).toBe(true);
      }
    });

    it('manifest schemaHash matches schema.json hash', async () => {
      const result = await compileTtdProtocol({
        sdl: basicProtocolSdl,
        targets: ['manifest'],
        deps
      });

      const schemaFile = result.files.find(f => f.path === 'manifest/schema.json');
      const manifestFile = result.files.find(f => f.path === 'manifest/manifest.json');

      const schema = JSON.parse(schemaFile.content);
      const manifest = JSON.parse(manifestFile.content);

      expect(manifest.schemaHash).toBe(schema.hash);
    });
  });

  describe('Verifier Integration', () => {
    it('creates verifier from schema', () => {
      const schema = extractTtdSchema(basicProtocolSdl, deps);
      const verifier = createVerifier(schema, deps);

      expect(verifier).toBeDefined();
      expect(typeof verifier.verifyAll).toBe('function');
      expect(typeof verifier.specs).not.toBe('undefined');
    });

    it('verifier has compiled obligation specs', () => {
      const schema = extractTtdSchema(basicProtocolSdl, deps);
      const verifier = createVerifier(schema, deps);

      // Check that specs exist for the invariants we defined
      const specs = verifier.specs;
      expect(specs.length).toBeGreaterThan(0);

      // Check that specs have expected structure
      const spec = specs[0];
      expect(spec).toHaveProperty('name');
      expect(spec).toHaveProperty('expr');
      expect(spec).toHaveProperty('bytecode');
    });

    it('verifier can run verification without crashing', () => {
      const schema = extractTtdSchema(basicProtocolSdl, deps);
      const verifier = createVerifier(schema, deps);

      // Just verify it can run - the actual invariant checking
      // requires proper context setup which is tested elsewhere
      const context = { Counter: [] };

      // Should not throw
      const result = verifier.verifyAll(context);
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('totalChecked');
      expect(result).toHaveProperty('failures');
    });

    it('verification results are deterministic', () => {
      const schema = extractTtdSchema(basicProtocolSdl, deps);
      const verifier = createVerifier(schema, deps);

      const context = { Counter: [] };

      const result1 = verifier.verifyAll(context);
      const result2 = verifier.verifyAll(context);

      // Same result structure
      expect(result1.passed).toBe(result2.passed);
      expect(result1.totalChecked).toBe(result2.totalChecked);
      expect(result1.failures.length).toBe(result2.failures.length);
    });
  });
});

/**
 * Compile TypeScript code and return diagnostics
 */
function _compileTypeScript(code, filename = 'test.ts') {
  const compilerOptions = {
    noEmit: true,
    strict: true,
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    skipLibCheck: true
  };

  // Create a virtual file system for the compiler
  const sourceFile = ts.createSourceFile(
    filename,
    code,
    ts.ScriptTarget.ES2020,
    true
  );

  // Create a minimal compiler host
  const host = {
    getSourceFile: (name) => name === filename ? sourceFile : undefined,
    getDefaultLibFileName: () => 'lib.d.ts',
    writeFile: () => {},
    getCurrentDirectory: () => '/',
    getCanonicalFileName: (f) => f,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    fileExists: (f) => f === filename,
    readFile: () => undefined
  };

  const program = ts.createProgram([filename], compilerOptions, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);

  return diagnostics.map(d => ({
    message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
    line: d.start ? sourceFile.getLineAndCharacterOfPosition(d.start).line : 0
  }));
}
