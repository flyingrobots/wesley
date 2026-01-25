/**
 * TTD Codegen Tests
 * These tests define the specification for Rust and TypeScript code generation.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractTtdSchema,
  generateRustTypes,
  generateRustCbor,
  generateRustRegistry,
  generateRustHash,
  generateTsTypes,
  generateTsZod,
  generateTsRegistry,
  compileTtdProtocol,
} from '@wesley/core/ttd';

const __dirname = dirname(fileURLToPath(import.meta.url));
const basicProtocolSdl = readFileSync(join(__dirname, 'fixtures/basic-protocol.graphql'), 'utf-8');

describe('TTD Rust Codegen', () => {
  describe('generateRustTypes', () => {
    it('generates Rust structs for event types', () => {
      const schema = extractTtdSchema(basicProtocolSdl);
      const code = generateRustTypes(schema);

      expect(code).toContain('pub struct CounterIncremented');
      expect(code).toContain('pub struct CounterDecremented');
      expect(code).toContain('pub struct CounterReset');
    });

    it('includes serde derives', () => {
      const schema = extractTtdSchema(basicProtocolSdl);
      const code = generateRustTypes(schema);

      expect(code).toContain('#[derive(');
      expect(code).toContain('Serialize');
      expect(code).toContain('Deserialize');
    });

    it('generates correct field types', () => {
      const schema = extractTtdSchema(basicProtocolSdl);
      const code = generateRustTypes(schema);

      // CounterIncremented fields
      expect(code).toMatch(/counter_id:\s*String/);
      expect(code).toMatch(/previous_value:\s*i64/);
      expect(code).toMatch(/new_value:\s*i64/);
      expect(code).toMatch(/timestamp:\s*String/);
    });

    it('generates enums for GraphQL enums', () => {
      const schema = extractTtdSchema(basicProtocolSdl);
      const code = generateRustTypes(schema);

      expect(code).toContain('pub enum CounterState');
      expect(code).toContain('Idle');
      expect(code).toContain('Counting');
      expect(code).toContain('Paused');
      expect(code).toContain('Completed');
    });

    it('uses snake_case for field names', () => {
      const schema = extractTtdSchema(basicProtocolSdl);
      const code = generateRustTypes(schema);

      expect(code).toContain('counter_id');
      expect(code).toContain('previous_value');
      expect(code).toContain('new_value');
      expect(code).toContain('last_modified');
    });

    it('adds serde rename attributes for camelCase serialization', () => {
      const schema = extractTtdSchema(basicProtocolSdl);
      const code = generateRustTypes(schema);

      expect(code).toContain('#[serde(rename = "counterId")]');
      expect(code).toContain('#[serde(rename = "previousValue")]');
    });

    it('generates state type with proper fields', () => {
      const schema = extractTtdSchema(basicProtocolSdl);
      const code = generateRustTypes(schema);

      expect(code).toContain('pub struct Counter');
      expect(code).toMatch(/id:\s*String/);
      expect(code).toMatch(/value:\s*i64/);
      expect(code).toMatch(/state:\s*CounterState/);
    });
  });

  describe('generateRustCbor', () => {
    it('generates minicbor encode/decode implementations', () => {
      const schema = extractTtdSchema(basicProtocolSdl);
      const code = generateRustCbor(schema);

      expect(code).toContain('impl minicbor::Encode');
      expect(code).toContain('impl minicbor::Decode');
    });

    it('generates canonical CBOR encoding', () => {
      const schema = extractTtdSchema(basicProtocolSdl);
      const code = generateRustCbor(schema);

      // Should encode fields in sorted order for canonical CBOR
      expect(code).toContain('// Canonical CBOR: fields encoded in sorted key order');
    });

    it('includes type markers for registry types', () => {
      const schema = extractTtdSchema(basicProtocolSdl);
      const code = generateRustCbor(schema);

      // Registry types should include their ID for disambiguation
      expect(code).toContain('const TYPE_ID: u32');
    });
  });

  describe('generateRustRegistry', () => {
    it('generates registry lookup tables', () => {
      const schema = extractTtdSchema(basicProtocolSdl);
      const code = generateRustRegistry(schema);

      expect(code).toContain('pub static TYPE_REGISTRY');
      expect(code).toContain('pub static OP_REGISTRY');
    });

    it('includes type name to ID mappings', () => {
      const schema = extractTtdSchema(basicProtocolSdl);
      const code = generateRustRegistry(schema);

      expect(code).toContain('"CounterIncremented"');
      expect(code).toContain('=> 1');
    });

    it('includes op name to ID mappings', () => {
      const schema = extractTtdSchema(basicProtocolSdl);
      const code = generateRustRegistry(schema);

      expect(code).toContain('"increment"');
    });

    it('generates lookup functions', () => {
      const schema = extractTtdSchema(basicProtocolSdl);
      const code = generateRustRegistry(schema);

      expect(code).toContain('pub fn type_id_for_name');
      expect(code).toContain('pub fn type_name_for_id');
      expect(code).toContain('pub fn op_id_for_name');
      expect(code).toContain('pub fn op_name_for_id');
    });
  });

  describe('generateRustHash', () => {
    it('generates hash helper functions', () => {
      const schema = extractTtdSchema(basicProtocolSdl);
      const code = generateRustHash(schema);

      expect(code).toContain('pub fn hash_event');
      expect(code).toContain('pub fn verify_event_hash');
    });

    it('includes schema hash constant', () => {
      const schema = extractTtdSchema(basicProtocolSdl);
      const code = generateRustHash(schema);

      expect(code).toContain('pub const SCHEMA_HASH');
      expect(code).toMatch(/SCHEMA_HASH:\s*&str\s*=\s*"[a-f0-9]{64}"/);
    });

    it('generates content-addressable digest functions', () => {
      const schema = extractTtdSchema(basicProtocolSdl);
      const code = generateRustHash(schema);

      expect(code).toContain('fn compute_digest');
      expect(code).toContain('sha256');
    });
  });
});

describe('TTD TypeScript Codegen', () => {
  describe('generateTsTypes', () => {
    it('generates TypeScript interfaces for types', () => {
      const schema = extractTtdSchema(basicProtocolSdl);
      const code = generateTsTypes(schema);

      expect(code).toContain('export interface CounterIncremented');
      expect(code).toContain('export interface CounterDecremented');
      expect(code).toContain('export interface Counter');
    });

    it('generates correct property types', () => {
      const schema = extractTtdSchema(basicProtocolSdl);
      const code = generateTsTypes(schema);

      expect(code).toMatch(/counterId:\s*string/);
      expect(code).toMatch(/previousValue:\s*number/);
      expect(code).toMatch(/newValue:\s*number/);
    });

    it('generates enum types', () => {
      const schema = extractTtdSchema(basicProtocolSdl);
      const code = generateTsTypes(schema);

      expect(code).toContain('export enum CounterState');
      expect(code).toContain("IDLE = 'IDLE'");
      expect(code).toContain("COUNTING = 'COUNTING'");
    });

    it('marks required vs optional properties', () => {
      const schema = extractTtdSchema(basicProtocolSdl);
      const code = generateTsTypes(schema);

      // Required fields should not have ?
      expect(code).toMatch(/counterId:\s*string;/);

      // The Counter type in Query.getCounter returns optional
      // This is based on the GraphQL schema
    });

    it('generates operation type interfaces', () => {
      const schema = extractTtdSchema(basicProtocolSdl);
      const code = generateTsTypes(schema);

      expect(code).toContain('export interface IncrementArgs');
      expect(code).toContain('export interface DecrementArgs');
    });

    it('includes JSDoc comments', () => {
      const schema = extractTtdSchema(basicProtocolSdl);
      const code = generateTsTypes(schema);

      expect(code).toContain('/**');
      expect(code).toContain('*/');
    });
  });

  describe('generateTsZod', () => {
    it('generates Zod schemas for types', () => {
      const schema = extractTtdSchema(basicProtocolSdl);
      const code = generateTsZod(schema);

      expect(code).toContain("import { z } from 'zod'");
      expect(code).toContain('export const CounterIncrementedSchema');
      expect(code).toContain('export const CounterSchema');
    });

    it('uses correct Zod validators', () => {
      const schema = extractTtdSchema(basicProtocolSdl);
      const code = generateTsZod(schema);

      expect(code).toContain('z.string()');
      expect(code).toContain('z.number()');
    });

    it('includes constraint validations', () => {
      const schema = extractTtdSchema(basicProtocolSdl);
      const code = generateTsZod(schema);

      // Counter.value has min: 0, max: 1000000
      expect(code).toContain('.min(0)');
      expect(code).toContain('.max(1000000)');
    });

    it('generates enum validators', () => {
      const schema = extractTtdSchema(basicProtocolSdl);
      const code = generateTsZod(schema);

      expect(code).toContain('export const CounterStateSchema');
      expect(code).toContain('z.enum(');
    });

    it('generates inferred types', () => {
      const schema = extractTtdSchema(basicProtocolSdl);
      const code = generateTsZod(schema);

      expect(code).toContain('z.infer<typeof CounterIncrementedSchema>');
    });
  });

  describe('generateTsRegistry', () => {
    it('generates registry maps', () => {
      const schema = extractTtdSchema(basicProtocolSdl);
      const code = generateTsRegistry(schema);

      expect(code).toContain('export const TYPE_REGISTRY');
      expect(code).toContain('export const OP_REGISTRY');
    });

    it('includes type ID constants', () => {
      const schema = extractTtdSchema(basicProtocolSdl);
      const code = generateTsRegistry(schema);

      expect(code).toContain('COUNTER_INCREMENTED_TYPE_ID');
    });

    it('includes op ID constants', () => {
      const schema = extractTtdSchema(basicProtocolSdl);
      const code = generateTsRegistry(schema);

      expect(code).toContain('INCREMENT_OP_ID');
      expect(code).toContain('DECREMENT_OP_ID');
    });

    it('generates lookup functions', () => {
      const schema = extractTtdSchema(basicProtocolSdl);
      const code = generateTsRegistry(schema);

      expect(code).toContain('export function getTypeById');
      expect(code).toContain('export function getOpById');
    });
  });
});

describe('compileTtdProtocol (orchestrator)', () => {
  it('generates all output files', async () => {
    const result = await compileTtdProtocol({
      sdl: basicProtocolSdl,
      targets: ['rust', 'typescript', 'manifest'],
    });

    expect(result.files).toBeDefined();
    expect(Array.isArray(result.files)).toBe(true);
  });

  it('generates Rust files when target includes rust', async () => {
    const result = await compileTtdProtocol({
      sdl: basicProtocolSdl,
      targets: ['rust'],
    });

    const paths = result.files.map(f => f.path);
    expect(paths).toContain('rust/types.rs');
    expect(paths).toContain('rust/cbor.rs');
    expect(paths).toContain('rust/registry.rs');
    expect(paths).toContain('rust/hash.rs');
    expect(paths).toContain('rust/mod.rs');
  });

  it('generates TypeScript files when target includes typescript', async () => {
    const result = await compileTtdProtocol({
      sdl: basicProtocolSdl,
      targets: ['typescript'],
    });

    const paths = result.files.map(f => f.path);
    expect(paths).toContain('typescript/types.ts');
    expect(paths).toContain('typescript/zod.ts');
    expect(paths).toContain('typescript/registry.ts');
    expect(paths).toContain('typescript/index.ts');
  });

  it('generates manifest files when target includes manifest', async () => {
    const result = await compileTtdProtocol({
      sdl: basicProtocolSdl,
      targets: ['manifest'],
    });

    const paths = result.files.map(f => f.path);
    expect(paths).toContain('manifest/schema.json');
    expect(paths).toContain('manifest/manifest.json');
    expect(paths).toContain('manifest/contracts.json');
  });

  it('generates all targets by default', async () => {
    const result = await compileTtdProtocol({
      sdl: basicProtocolSdl,
    });

    const paths = result.files.map(f => f.path);

    // Should have rust, typescript, and manifest
    expect(paths.some(p => p.startsWith('rust/'))).toBe(true);
    expect(paths.some(p => p.startsWith('typescript/'))).toBe(true);
    expect(paths.some(p => p.startsWith('manifest/'))).toBe(true);
  });

  it('includes schema hash in result', async () => {
    const result = await compileTtdProtocol({
      sdl: basicProtocolSdl,
    });

    expect(result.schemaHash).toBeDefined();
    expect(result.schemaHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces deterministic output', async () => {
    const result1 = await compileTtdProtocol({ sdl: basicProtocolSdl });
    const result2 = await compileTtdProtocol({ sdl: basicProtocolSdl });

    expect(result1.schemaHash).toBe(result2.schemaHash);

    for (const file1 of result1.files) {
      const file2 = result2.files.find(f => f.path === file1.path);
      expect(file2).toBeDefined();
      expect(file1.content).toBe(file2.content);
    }
  });

  it('validates schema before generation', async () => {
    const invalidSdl = `
      type Mutation {
        bad: Result! @wes_rule(name: "test")
      }
    `;

    await expect(compileTtdProtocol({ sdl: invalidSdl })).rejects.toThrow();
  });

  it('includes validation result in output', async () => {
    const result = await compileTtdProtocol({
      sdl: basicProtocolSdl,
    });

    expect(result.validation).toBeDefined();
    expect(result.validation.valid).toBe(true);
  });
});

describe('Codegen Golden Tests', () => {
  it('Rust types output is stable', async () => {
    const schema = extractTtdSchema(basicProtocolSdl);
    const code1 = generateRustTypes(schema);
    const code2 = generateRustTypes(schema);

    expect(code1).toBe(code2);
  });

  it('TypeScript types output is stable', async () => {
    const schema = extractTtdSchema(basicProtocolSdl);
    const code1 = generateTsTypes(schema);
    const code2 = generateTsTypes(schema);

    expect(code1).toBe(code2);
  });

  it('manifest JSON is stable', async () => {
    const result1 = await compileTtdProtocol({ sdl: basicProtocolSdl, targets: ['manifest'] });
    const result2 = await compileTtdProtocol({ sdl: basicProtocolSdl, targets: ['manifest'] });

    const manifest1 = result1.files.find(f => f.path === 'manifest/manifest.json');
    const manifest2 = result2.files.find(f => f.path === 'manifest/manifest.json');

    expect(manifest1.content).toBe(manifest2.content);
  });
});
