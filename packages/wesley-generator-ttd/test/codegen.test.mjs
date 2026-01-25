/**
 * TTD Codegen Tests
 *
 * These tests define the specification for TypeScript code generation.
 *
 * NOTE: Rust code generation is NOT done in Wesley. Instead, Wesley outputs
 * TTD IR (JSON) which is consumed by external Rust tools (e.g., echo-ttd-gen)
 * that use syn/quote/prettyplease for proper AST-based codegen.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractTtdSchema,
  generateTsTypes,
  generateTsZod,
  generateTsRegistry,
  compileTtdProtocol,
} from '@wesley/core/ttd';
import { FakeClock } from '@wesley/core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const basicProtocolSdl = readFileSync(join(__dirname, 'fixtures/basic-protocol.graphql'), 'utf-8');

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

      expect(code).toMatch(/counterId.*string/);
      expect(code).toMatch(/previousValue.*number/);
      expect(code).toMatch(/newValue.*number/);
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
    expect(paths).toContain('manifest/ttd-ir.json');
  });

  it('generates TTD IR for external Rust tools', async () => {
    const result = await compileTtdProtocol({
      sdl: basicProtocolSdl,
      targets: ['manifest'],
    });

    const irFile = result.files.find(f => f.path === 'manifest/ttd-ir.json');
    expect(irFile).toBeDefined();

    const ir = JSON.parse(irFile.content);
    expect(ir.ir_version).toBe('ttd-ir/v1');
    expect(ir.schema_sha256).toBeDefined();
    expect(ir.generated_by.tool).toBe('@wesley/generator-ttd');
  });

  it('generates manifest and typescript by default', async () => {
    const result = await compileTtdProtocol({
      sdl: basicProtocolSdl,
    });

    const paths = result.files.map(f => f.path);

    // Should have typescript and manifest
    expect(paths.some(p => p.startsWith('typescript/'))).toBe(true);
    expect(paths.some(p => p.startsWith('manifest/'))).toBe(true);
  });

  it('generates README for rust target explaining external tooling', async () => {
    const result = await compileTtdProtocol({
      sdl: basicProtocolSdl,
      targets: ['rust'],
    });

    const readme = result.files.find(f => f.path === 'rust/README.md');
    expect(readme).toBeDefined();
    expect(readme.content).toContain('echo-ttd-gen');
    expect(readme.content).toContain('ttd-ir.json');
  });

  it('includes schema hash in result', async () => {
    const result = await compileTtdProtocol({
      sdl: basicProtocolSdl,
    });

    expect(result.schemaHash).toBeDefined();
    expect(result.schemaHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces deterministic output', async () => {
    // Use FakeClock for deterministic timestamps
    const clock = new FakeClock('2024-01-01T00:00:00.000Z');
    const deps = { clock };

    const result1 = await compileTtdProtocol({ sdl: basicProtocolSdl, deps });
    const result2 = await compileTtdProtocol({ sdl: basicProtocolSdl, deps });

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
  it('TypeScript types output is stable', async () => {
    const schema = extractTtdSchema(basicProtocolSdl);
    const code1 = generateTsTypes(schema);
    const code2 = generateTsTypes(schema);

    expect(code1).toBe(code2);
  });

  it('Zod schemas output is stable', async () => {
    const schema = extractTtdSchema(basicProtocolSdl);
    const code1 = generateTsZod(schema);
    const code2 = generateTsZod(schema);

    expect(code1).toBe(code2);
  });

  it('Registry output is stable', async () => {
    const schema = extractTtdSchema(basicProtocolSdl);
    const code1 = generateTsRegistry(schema);
    const code2 = generateTsRegistry(schema);

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
