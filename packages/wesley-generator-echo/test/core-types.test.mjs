import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateEcho } from '../src/index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load the canonical SDL from schemas/ and append a dummy Query root
// (GraphQL requires at least one Query field for valid ops extraction).
const coreSDL = readFileSync(
  resolve(__dirname, '../../../schemas/echo-core-types.graphql'),
  'utf-8'
);
const directivesSDL = readFileSync(
  resolve(__dirname, '../../../schemas/directives.graphql'),
  'utf-8'
);
const fullSDL = directivesSDL + '\n' + coreSDL + '\ntype Query { _ping: Boolean }';

/** Helper: parse IR from generateEcho output. */
const getIR = async () => {
  const result = await generateEcho({ sdl: fullSDL });
  return JSON.parse(result.files.find((f) => f.path === 'ir.json').content);
};

describe('echo-core-types SDL → IR', () => {
  it('compiles without error', async () => {
    await expect(generateEcho({ sdl: fullSDL })).resolves.toBeDefined();
  });

  it('emits all 6 types in IR', async () => {
    const ir = await getIR();
    const names = ir.types.map((t) => t.name);
    expect(names).toContain('FieldPatch');
    expect(names).toContain('WorldlineTickPatchV1');
    expect(names).toContain('SnapshotManifest');
    expect(names).toContain('ClaimRecord');
    expect(names).toContain('PrivateAtomRefV1');
    expect(names).toContain('OpaqueRefV1');
  });

  it('all types have type_id and layout_hash (v2 fields)', async () => {
    const ir = await getIR();
    const coreNames = [
      'FieldPatch', 'WorldlineTickPatchV1', 'SnapshotManifest',
      'ClaimRecord', 'PrivateAtomRefV1', 'OpaqueRefV1',
    ];
    for (const name of coreNames) {
      const t = ir.types.find((x) => x.name === name);
      expect(t, `${name} missing from IR`).toBeDefined();
      expect(t).toHaveProperty('type_id');
      expect(t).toHaveProperty('layout_hash');
    }
  });

  describe('WorldlineTickPatchV1 fields', () => {
    it('has correct fields and types', async () => {
      const ir = await getIR();
      const t = ir.types.find((x) => x.name === 'WorldlineTickPatchV1');
      expect(t.kind).toBe('OBJECT');

      const fieldMap = Object.fromEntries(t.fields.map((f) => [f.name, f]));
      expect(fieldMap.tick_id).toMatchObject({ type: 'Int', required: true, list: false });
      expect(fieldMap.entity_id).toMatchObject({ type: 'String', required: true, list: false });
      expect(fieldMap.patches).toMatchObject({ type: 'FieldPatch', required: true, list: true });
      expect(fieldMap.timestamp_us).toMatchObject({ type: 'String', required: true, list: false });
      expect(fieldMap.payload).toMatchObject({ type: 'String', required: false, list: false });
    });
  });

  describe('FieldPatch fields', () => {
    it('has correct fields and types', async () => {
      const ir = await getIR();
      const t = ir.types.find((x) => x.name === 'FieldPatch');
      const fieldMap = Object.fromEntries(t.fields.map((f) => [f.name, f]));
      expect(fieldMap.field_name).toMatchObject({ type: 'String', required: true });
      expect(fieldMap.old_value).toMatchObject({ type: 'String', required: false });
      expect(fieldMap.new_value).toMatchObject({ type: 'String', required: false });
    });
  });

  describe('SnapshotManifest fields', () => {
    it('has correct fields and types', async () => {
      const ir = await getIR();
      const t = ir.types.find((x) => x.name === 'SnapshotManifest');
      const fieldMap = Object.fromEntries(t.fields.map((f) => [f.name, f]));
      expect(fieldMap.segment_count).toMatchObject({ type: 'Int', required: true });
      expect(fieldMap.segment_hashes).toMatchObject({ type: 'String', required: true, list: true });
      expect(fieldMap.total_bytes).toMatchObject({ type: 'Int', required: true });
      expect(fieldMap.schema_hash).toMatchObject({ type: 'String', required: true });
      expect(fieldMap.created_at).toMatchObject({ type: 'String', required: true });
    });
  });

  describe('ClaimRecord fields', () => {
    it('has correct fields and types', async () => {
      const ir = await getIR();
      const t = ir.types.find((x) => x.name === 'ClaimRecord');
      expect(t.fields).toHaveLength(8);
      const fieldMap = Object.fromEntries(t.fields.map((f) => [f.name, f]));
      expect(fieldMap.claim_key).toMatchObject({ type: 'String', required: true });
      expect(fieldMap.proof_hash).toMatchObject({ type: 'String', required: false });
      expect(fieldMap.private_ref).toMatchObject({ type: 'String', required: false });
      expect(fieldMap.policy_hash).toMatchObject({ type: 'String', required: true });
    });
  });

  describe('PrivateAtomRefV1 fields', () => {
    it('has correct fields and types', async () => {
      const ir = await getIR();
      const t = ir.types.find((x) => x.name === 'PrivateAtomRefV1');
      expect(t.fields).toHaveLength(5);
      const fieldMap = Object.fromEntries(t.fields.map((f) => [f.name, f]));
      expect(fieldMap.commit).toMatchObject({ type: 'String', required: true });
      expect(fieldMap.zk_evidence).toMatchObject({ type: 'String', required: false });
      expect(fieldMap.opaque_ref).toMatchObject({ type: 'String', required: false });
    });
  });

  describe('OpaqueRefV1 fields', () => {
    it('has correct fields and types', async () => {
      const ir = await getIR();
      const t = ir.types.find((x) => x.name === 'OpaqueRefV1');
      expect(t.fields).toHaveLength(5);
      const fieldMap = Object.fromEntries(t.fields.map((f) => [f.name, f]));
      expect(fieldMap.vault_id).toMatchObject({ type: 'String', required: true });
      expect(fieldMap.locator).toMatchObject({ type: 'String', required: true });
      expect(fieldMap.commit).toMatchObject({ type: 'String', required: true });
      expect(fieldMap.alg_id).toMatchObject({ type: 'String', required: true });
      expect(fieldMap.policy_hash).toMatchObject({ type: 'String', required: true });
    });
  });
});
