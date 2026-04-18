/**
 * TTD Manifest Generator Tests
 * These tests define the specification for generating TTD manifests.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateManifest,
  generateSchemaJson,
  generateContractsJson,
  extractTtdSchema
} from '@wesley/core/ttd';
import { FakeClock } from '@wesley/core/ports';
import { testCrypto } from './setup.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const basicProtocolSdl = readFileSync(join(__dirname, 'fixtures/basic-protocol/basic-protocol.graphql'), 'utf-8');

/** Helper to extract with crypto adapter */
const extract = (sdl) => extractTtdSchema(sdl, { crypto: testCrypto });

/** Crypto deps for manifest generation */
const deps = { crypto: testCrypto };

/** Fixed clock for deterministic tests */
const fakeClock = new FakeClock('2025-01-01T00:00:00.000Z');
const schemaJsonDeps = { clock: fakeClock };

describe('TTD Manifest Generator', () => {
  describe('generateSchemaJson', () => {
    it('outputs schema.json with all TTD components', () => {
      const schema = extract(basicProtocolSdl);
      const schemaJson = generateSchemaJson(schema);

      expect(schemaJson.version).toBe('1.0.0');
      expect(schemaJson.channels).toBeDefined();
      expect(schemaJson.ops).toBeDefined();
      expect(schemaJson.rules).toBeDefined();
      expect(schemaJson.invariants).toBeDefined();
      expect(schemaJson.types).toBeDefined();
      expect(schemaJson.enums).toBeDefined();
    });

    it('includes schema hash in output', () => {
      const schema = extract(basicProtocolSdl);
      const schemaJson = generateSchemaJson(schema);

      expect(schemaJson.hash).toBeDefined();
      expect(schemaJson.hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('includes generation metadata', () => {
      const schema = extract(basicProtocolSdl);
      const schemaJson = generateSchemaJson(schema);

      expect(schemaJson.generatedAt).toBeDefined();
      expect(schemaJson.generatedBy).toBe('@wesley/generator-ttd');
    });

    it('produces deterministic output', () => {
      const schema = extract(basicProtocolSdl);
      const json1 = JSON.stringify(generateSchemaJson(schema, schemaJsonDeps));
      const json2 = JSON.stringify(generateSchemaJson(schema, schemaJsonDeps));

      expect(json1).toBe(json2);
    });
  });

  describe('generateContractsJson', () => {
    it('outputs contracts.json with emission contracts', () => {
      const schema = extract(basicProtocolSdl);
      const contractsJson = generateContractsJson(schema);

      expect(contractsJson.emissions).toBeDefined();
      expect(Array.isArray(contractsJson.emissions)).toBe(true);
      expect(contractsJson.emissions.length).toBeGreaterThan(0);
    });

    it('includes invariants in contracts', () => {
      const schema = extract(basicProtocolSdl);
      const contractsJson = generateContractsJson(schema);

      expect(contractsJson.invariants).toBeDefined();
      expect(Array.isArray(contractsJson.invariants)).toBe(true);
    });

    it('includes footprints in contracts', () => {
      const schema = extract(basicProtocolSdl);
      const contractsJson = generateContractsJson(schema);

      expect(contractsJson.footprints).toBeDefined();
      expect(Array.isArray(contractsJson.footprints)).toBe(true);
    });

    it('includes state machine rules', () => {
      const schema = extract(basicProtocolSdl);
      const contractsJson = generateContractsJson(schema);

      expect(contractsJson.stateMachines).toBeDefined();

      // Should group rules by entity/state type
      const counterMachine = contractsJson.stateMachines.find(sm => sm.stateType === 'CounterState');
      expect(counterMachine).toBeDefined();
      expect(counterMachine.transitions).toBeDefined();
      expect(counterMachine.transitions.length).toBeGreaterThan(0);
    });

    it('validates emission timing constraints', () => {
      const schema = extract(basicProtocolSdl);
      const contractsJson = generateContractsJson(schema);

      const incrementEmission = contractsJson.emissions.find(
        e => e.opName === 'increment' && e.event === 'CounterIncremented'
      );
      expect(incrementEmission.withinMs).toBe(100);
    });

    it('includes structured footprint fields when present', () => {
      const schema = extract(`
        type BufferWorldline { id: ID! }
        type RopeHead { id: ID! }
        type RopeBranch { id: ID! }
        type RopeLeaf { id: ID! }
        type TextBlob { id: ID! }
        type Tick { id: ID! }
        type TickReceipt { id: ID! }
        type ReplaceRangeAsTickResult { id: ID! }

        type Mutation {
          replaceRangeAsTick(
            worldlineId: ID!
            baseHeadId: ID!
            startByte: Int!
            endByte: Int!
            insertText: String!
          ): ReplaceRangeAsTickResult!
            @wes_op(name: "replaceRangeAsTick")
            @wes_footprint(
              reads: ["BufferWorldline", "RopeHead"]
              writes: ["BufferWorldline"]
              slots: [
                { slot: "worldline", kind: "BufferWorldline", bindFromArg: "worldlineId", access: [READ, WRITE] }
                { slot: "baseHead", kind: "RopeHead", bindFromArg: "baseHeadId", access: [READ] }
              ]
              closures: [
                { slot: "touchedRope", fromSlot: "baseHead", operator: "ropeRangeClosure", argBindings: ["startByte", "endByte"], reads: ["RopeBranch", "RopeLeaf", "TextBlob"], cardinality: MANY }
              ]
              createSlots: [
                { slot: "tick", kind: "Tick" }
              ]
              updates: [
                { slot: "worldline", fields: ["canonicalHead"] }
              ]
              forbids: ["AstState", "Diagnostics"]
            )
        }
      `);
      const contractsJson = generateContractsJson(schema);
      const fp = contractsJson.footprints.find(f => f.opName === 'replaceRangeAsTick');

      expect(fp.slots).toEqual([
        {
          slot: 'worldline',
          kind: 'BufferWorldline',
          bindFromArg: 'worldlineId',
          bindFromSlot: undefined,
          bindRelation: undefined,
          access: ['READ', 'WRITE'],
          cardinality: 'ONE'
        },
        {
          slot: 'baseHead',
          kind: 'RopeHead',
          bindFromArg: 'baseHeadId',
          bindFromSlot: undefined,
          bindRelation: undefined,
          access: ['READ'],
          cardinality: 'ONE'
        }
      ]);
      expect(fp.closures).toEqual([
        {
          slot: 'touchedRope',
          fromSlot: 'baseHead',
          operator: 'ropeRangeClosure',
          argBindings: ['endByte', 'startByte'],
          reads: ['RopeBranch', 'RopeLeaf', 'TextBlob'],
          cardinality: 'MANY'
        }
      ]);
      expect(fp.createSlots).toEqual([
        { slot: 'tick', kind: 'Tick', cardinality: 'ONE' }
      ]);
      expect(fp.updates).toEqual([
        { slot: 'worldline', fields: ['canonicalHead'] }
      ]);
      expect(fp.forbids).toEqual(['AstState', 'Diagnostics']);
    });
  });

  describe('generateManifest', () => {
    it('outputs manifest.json with registry', () => {
      const schema = extract(basicProtocolSdl);
      const manifest = generateManifest(schema, deps);

      expect(manifest.registry).toBeDefined();
      expect(manifest.registry.version).toBe(1);
      expect(manifest.registry.entries).toBeDefined();
      expect(Array.isArray(manifest.registry.entries)).toBe(true);
    });

    it('includes operation registry', () => {
      const schema = extract(basicProtocolSdl);
      const manifest = generateManifest(schema, deps);

      expect(manifest.ops).toBeDefined();
      expect(Array.isArray(manifest.ops)).toBe(true);

      const incrementOp = manifest.ops.find(o => o.name === 'increment');
      expect(incrementOp).toBeDefined();
      expect(incrementOp.op_id).toBeDefined();
      expect(typeof incrementOp.op_id).toBe('number');
    });

    it('includes channel registry', () => {
      const schema = extract(basicProtocolSdl);
      const manifest = generateManifest(schema, deps);

      expect(manifest.channels).toBeDefined();
      expect(Array.isArray(manifest.channels)).toBe(true);

      const counterChannel = manifest.channels.find(c => c.name === 'counter');
      expect(counterChannel).toBeDefined();
      expect(counterChannel.version).toBe(1);
    });

    it('includes codec specifications', () => {
      const schema = extract(basicProtocolSdl);
      const manifest = generateManifest(schema, deps);

      expect(manifest.codecs).toBeDefined();

      const incrementedCodec = manifest.codecs.find(c => c.typeName === 'CounterIncremented');
      expect(incrementedCodec).toBeDefined();
      expect(incrementedCodec.format).toBe('cbor');
      expect(incrementedCodec.canonical).toBe(true);
    });

    it('includes schema hash for integrity verification', () => {
      const schema = extract(basicProtocolSdl);
      const manifest = generateManifest(schema, deps);

      expect(manifest.schemaHash).toBeDefined();
      expect(manifest.schemaHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('includes content hashes for each component', () => {
      const schema = extract(basicProtocolSdl);
      const manifest = generateManifest(schema, deps);

      // Each op should have a signature hash
      for (const op of manifest.ops) {
        expect(op.signatureHash).toBeDefined();
        expect(op.signatureHash).toMatch(/^[a-f0-9]{64}$/);
      }

      // Each type should have a hash
      for (const entry of manifest.registry.entries) {
        expect(entry.typeHash).toBeDefined();
        expect(entry.typeHash).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    it('produces sorted and deterministic output', () => {
      const schema = extract(basicProtocolSdl);

      const manifest1 = generateManifest(schema, deps);
      const manifest2 = generateManifest(schema, deps);

      expect(JSON.stringify(manifest1)).toBe(JSON.stringify(manifest2));

      // Ops should be sorted by op_id
      const opIds = manifest1.ops.map(o => o.op_id);
      const sortedOpIds = [...opIds].sort((a, b) => a - b);
      expect(opIds).toEqual(sortedOpIds);

      // Registry entries should be sorted by id
      const regIds = manifest1.registry.entries.map(e => e.id);
      const sortedRegIds = [...regIds].sort((a, b) => a - b);
      expect(regIds).toEqual(sortedRegIds);
    });
  });

  describe('manifest file generation', () => {
    it('generates all three manifest files', () => {
      const schema = extract(basicProtocolSdl);

      const schemaJson = generateSchemaJson(schema);
      const contractsJson = generateContractsJson(schema);
      const manifest = generateManifest(schema, deps);

      // All should be valid JSON objects
      expect(typeof schemaJson).toBe('object');
      expect(typeof contractsJson).toBe('object');
      expect(typeof manifest).toBe('object');

      // Schema hash should match across files
      expect(schemaJson.hash).toBe(manifest.schemaHash);
    });
  });
});
